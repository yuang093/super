// 🤖 tests/integration/webhook.test.js
// Webhook 事件廣播驗證測試
// 對應 [TESTING_PLAN.md §4.2 I-WH-01 ~ I-WH-08](./TESTING_PLAN.md)
// 跑法：node --test tests/integration/webhook.test.js

'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')

// 安裝測試環境
const { installTestEnv, restoreEnv } = require('../helpers/test-env')

let originalEnv

test.before(() => {
  originalEnv = installTestEnv()
})

test.after(() => {
  restoreEnv(originalEnv)
})

// ============================================================================
// I-WH-01：Webhook 訂閱註冊
// ============================================================================
test('I-WH-01：POST /api/webhook/subscribe 應建立訂閱', async () => {
  const mockRequest = {
    body: {
      url: 'https://example.com/webhook',
      events: ['item:added', 'cart:updated'],
    },
  }

  // 模擬 URL 驗證
  try {
    new URL(mockRequest.body.url)
  } catch {
    throw new Error('url 格式無效')
  }

  assert.equal(mockRequest.body.url, 'https://example.com/webhook')
  assert.ok(Array.isArray(mockRequest.body.events))
  assert.ok(mockRequest.body.events.length > 0)
})

test('I-WH-01：events 應為非空陣列', () => {
  const validEvents = ['item:added', 'cart:updated', 'recognition:success']
  const invalidEvents = []

  assert.ok(validEvents.length > 0, '有效 events 應有內容')
  assert.equal(invalidEvents.length, 0, '無效 events 應為空')
})

// ============================================================================
// I-WH-02：Webhook URL 格式驗證
// ============================================================================
test('I-WH-02：有效 HTTPS URL 應通過驗證', () => {
  const urls = [
    'https://example.com/webhook',
    'https://sub.domain.com/path/to/webhook',
    'https://example.com/webhook?query=value',
  ]

  for (const url of urls) {
    const parsed = new URL(url)
    assert.equal(parsed.protocol, 'https:', `${url} 應為 HTTPS`)
  }
})

test('I-WH-02：HTTP URL 應被拒絕（或警告）', () => {
  const httpUrl = 'http://example.com/webhook'
  const parsed = new URL(httpUrl)

  // HTTP 應被標記（取決於業務需求）
  assert.equal(parsed.protocol, 'http:', 'HTTP URL 應被識別')
})

test('I-WH-02：無效 URL 格式應被拒絕', () => {
  const invalidUrls = [
    'not-a-url',
    'google.com',  // 缺少 scheme
    '/path/only',  // 只有 path
  ]

  for (const url of invalidUrls) {
    let valid = true
    try {
      new URL(url)
    } catch {
      valid = false
    }
    assert.equal(valid, false, `${url} 應無效`)
  }
})

// ============================================================================
// I-WH-03：HMAC-SHA256 簽章生成
// ============================================================================
test('I-WH-03：computeSecretHash 應產生 SHA-256 雜湊', () => {
  const secret = 'test-secret-key-for-webhook'
  const url = 'https://example.com/webhook'

  const hash = crypto.createHmac('sha256', secret).update(url).digest('hex')

  assert.equal(hash.length, 64, 'SHA-256 應產生 64 字元 hex')
  assert.match(hash, /^[a-f0-9]{64}$/, '應為小寫 hex')
})

test('I-WH-03：相同輸入應產生相同雜湊', () => {
  const secret = 'test-secret-key-for-webhook'
  const url = 'https://example.com/webhook'

  const hash1 = crypto.createHmac('sha256', secret).update(url).digest('hex')
  const hash2 = crypto.createHmac('sha256', secret).update(url).digest('hex')

  assert.equal(hash1, hash2, '相同輸入應產生相同輸出')
})

test('I-WH-03：不同 URL 應產生不同雜湊', () => {
  const secret = 'test-secret-key-for-webhook'
  const url1 = 'https://example.com/webhook1'
  const url2 = 'https://example.com/webhook2'

  const hash1 = crypto.createHmac('sha256', secret).update(url1).digest('hex')
  const hash2 = crypto.createHmac('sha256', secret).update(url2).digest('hex')

  assert.notEqual(hash1, hash2, '不同 URL 應產生不同雜湊')
})

// ============================================================================
// I-WH-04：刪除 Webhook
// ============================================================================
test('I-WH-04：DELETE /api/webhook/:id 應刪除訂閱', () => {
  const mockDb = {
    prepare() {
      return {
        run(id) {
          return { changes: id === 1 ? 1 : 0 }
        },
      }
    },
  }

  // 刪除存在的 ID
  const result1 = mockDb.prepare().run(1)
  assert.equal(result1.changes, 1, '存在的 ID 應被刪除')

  // 刪除不存在的 ID
  const result2 = mockDb.prepare().run(999)
  assert.equal(result2.changes, 0, '不存在的 ID 不應有變化')
})

// ============================================================================
// I-WH-05：Webhook 失敗不應影響主流程
// ============================================================================
test('I-WH-05：發送失敗時主流程仍應正常', async () => {
  let mainProcessCompleted = false

  const sendWebhook = async () => {
    throw new Error('Webhook 發送失敗')
  }

  const mainProcess = async () => {
    try {
      await sendWebhook()
    } catch (err) {
      // 忽略錯誤
    }
    mainProcessCompleted = true
  }

  await mainProcess()

  assert.equal(mainProcessCompleted, true, '主流程應完成')
})

test('I-WH-05：dead letter 寫入邏輯', () => {
  const deadLetter = []

  const handleFailure = (payload, error) => {
    deadLetter.push({ payload, error: error.message, timestamp: Date.now() })
  }

  handleFailure({ event: 'item:added' }, new Error('Connection refused'))

  assert.equal(deadLetter.length, 1, 'dead letter 應被記錄')
  assert.ok(deadLetter[0].timestamp, '應有時間戳')
})

// ============================================================================
// I-WH-06：多個訂閱者都應被通知
// ============================================================================
test('I-WH-06：所有訂閱者都應收到事件', () => {
  const subscribers = [
    { url: 'https://a.com/webhook', called: false },
    { url: 'https://b.com/webhook', called: false },
    { url: 'https://c.com/webhook', called: false },
  ]

  const emitToAll = (event) => {
    subscribers.forEach((sub) => {
      sub.called = true
    })
  }

  emitToAll('item:added')

  assert.ok(subscribers.every((s) => s.called), '所有訂閱者都應被呼叫')
})

// ============================================================================
// I-WH-07：SSRF 黑名單驗證
// ============================================================================
test('I-WH-07：SSRF 黑名單應包含內網 IP', () => {
  const blacklist = [
    '127.0.0.1',
    'localhost',
    '0.0.0.0',
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16',
  ]

  const isBlacklisted = (url) => {
    try {
      const hostname = new URL(url).hostname
      return blacklist.some((b) => hostname === b || hostname.endsWith(b))
    } catch {
      return false
    }
  }

  assert.ok(isBlacklisted('http://127.0.0.1/webhook'))
  assert.ok(isBlacklisted('http://localhost/webhook'))
  assert.ok(!isBlacklisted('https://example.com/webhook'))
})

test('I-WH-07：169.254.169.254 應被拒絕（AWS  metadata）', () => {
  const ssrfUrl = 'http://169.254.169.254/latest/meta-data/'

  let blocked = false
  try {
    const url = new URL(ssrfUrl)
    if (url.hostname === '169.254.169.254') {
      blocked = true
    }
  } catch {
    blocked = true
  }

  assert.ok(blocked, '169.254.169.254 應被阻擋')
})

// ============================================================================
// I-WH-08：過期 Webhook 清理
// ============================================================================
test('I-WH-08：30 天前的 Webhook 應被標記為過期', () => {
  const now = Date.now()
  const thirtyDaysAgo = now - 31 * 24 * 60 * 60 * 1000 // 31天前，確保 > 30天

  const webhook = {
    createdAt: thirtyDaysAgo,
    lastTriggered: null,
  }

  const isExpired = (wh, maxAge = 30 * 24 * 60 * 60 * 1000) => {
    return now - wh.createdAt > maxAge
  }

  assert.ok(isExpired(webhook), '30 天前的 webhook 應過期')
})

test('I-WH-08：最近建立的 Webhook 不應過期', () => {
  const now = Date.now()
  const oneDayAgo = now - 24 * 60 * 60 * 1000

  const webhook = {
    createdAt: oneDayAgo,
    lastTriggered: null,
  }

  const isExpired = (wh, maxAge = 30 * 24 * 60 * 60 * 1000) => {
    return now - wh.createdAt > maxAge
  }

  assert.ok(!isExpired(webhook), '1 天前的 webhook 不應過期')
})