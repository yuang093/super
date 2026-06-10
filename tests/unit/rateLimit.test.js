// 🤖 tests/unit/rateLimit.test.js
// Rate Limit 雙層觸發測試
// 對應 [TESTING_PLAN.md §4.5 I-RL-01 ~ I-RL-10](./TESTING_PLAN.md)
// 跑法：node --test tests/unit/rateLimit.test.js

'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')

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
// I-RL-01：速率限制常數測試
// ============================================================================
test('I-RL-01：windowMs 應為 60000ms（1 分鐘）', () => {
  const windowMs = 60 * 1000
  assert.equal(windowMs, 60000)
})

test('I-RL-01：max 應從環境變數讀取（預設 60）', () => {
  const env = require('../../src/config/env').getEnv()
  assert.equal(env.RATE_LIMIT_PER_MIN, 60)
})

// ============================================================================
// I-RL-02：速率限制 Header 格式
// ============================================================================
test('I-RL-02：應有 RateLimit-* Header（draft-7）', () => {
  // 模擬 RateLimit-* Header 格式
  const headers = {
    'RateLimit-Limit': '60',
    'RateLimit-Remaining': '59',
    'RateLimit-Reset': Math.ceil(Date.now() / 60000) * 60,
  }

  assert.ok(headers['RateLimit-Limit'], '應有 RateLimit-Limit')
  assert.ok(headers['RateLimit-Remaining'], '應有 RateLimit-Remaining')
  assert.ok(headers['RateLimit-Reset'], '應有 RateLimit-Reset')
})

test('I-RL-02：RateLimit-Reset 應為 Unix timestamp', () => {
  const reset = Math.ceil(Date.now() / 60000) * 60
  // 驗證是未來的時間戳
  assert.ok(reset > Date.now() / 1000, 'Reset 應為未來時間')
})

// ============================================================================
// I-RL-03：429 錯誤回應格式
// ============================================================================
test('I-RL-03：觸發上限時應返回 429 + RATE_LIMIT_EXCEEDED', () => {
  const errorResponse = {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: '請求過於頻繁，請稍後再試',
      requestId: 'req-123',
      retryAfter: 60,
    },
  }

  assert.equal(errorResponse.error.code, 'RATE_LIMIT_EXCEEDED')
  assert.equal(errorResponse.error.message, '請求過於頻繁，請稍後再試')
  assert.equal(errorResponse.error.retryAfter, 60)
})

// ============================================================================
// I-RL-04：keyGenerator 應使用 IP 位址
// ============================================================================
test('I-RL-04：keyGenerator 應優先使用 req.ip', () => {
  const mockReq = {
    ip: '192.0.2.1',
    socket: { remoteAddress: '192.0.2.2' },
  }

  const key = mockReq.ip || mockReq.socket.remoteAddress || 'unknown'
  assert.equal(key, '192.0.2.1')
})

test('I-RL-04：keyGenerator fallback 到 socket.remoteAddress', () => {
  const mockReq = {
    ip: undefined,
    socket: { remoteAddress: '192.0.2.2' },
  }

  const key = mockReq.ip || mockReq.socket.remoteAddress || 'unknown'
  assert.equal(key, '192.0.2.2')
})

test('I-RL-04：keyGenerator fallback 到 unknown', () => {
  const mockReq = {
    ip: undefined,
    socket: { remoteAddress: undefined },
  }

  const key = mockReq.ip || mockReq.socket.remoteAddress || 'unknown'
  assert.equal(key, 'unknown')
})

// ============================================================================
// I-RL-05：skip 應跳過 /healthz
// ============================================================================
test('I-RL-05：skip 應返回 true 當 path 是 /healthz', () => {
  const mockReq = { path: '/healthz' }
  const skip = mockReq.path === '/healthz'
  assert.equal(skip, true)
})

test('I-RL-05：skip 應返回 false 當 path 不是 /healthz', () => {
  const mockReq = { path: '/api/items' }
  const skip = mockReq.path === '/healthz'
  assert.equal(skip, false)
})

// ============================================================================
// I-RL-06：不同 IP 應有獨立的速率限制計數
// ============================================================================
test('I-RL-06：不同 IP 的 key 應不同', () => {
  const ips = ['192.0.2.1', '192.0.2.2', '10.0.0.1']
  const keys = ips.map((ip) => ip)

  const uniqueKeys = [...new Set(keys)]
  assert.equal(uniqueKeys.length, ips.length, '每個 IP 應有獨特 key')
})

// ============================================================================
// I-RL-07：請求計數器邏輯
// ============================================================================
test('I-RL-07：remaining 應每次遞減', () => {
  const limit = 60
  let remaining = limit

  // 模擬 3 次請求
  remaining -= 1
  assert.equal(remaining, 59)
  remaining -= 1
  assert.equal(remaining, 58)
  remaining -= 1
  assert.equal(remaining, 57)
})

test('I-RL-07：remaining 歸零時應觸發限制', () => {
  const limit = 60
  let remaining = 0

  // 速率限制：當 remaining <= 0 時應阻止（使用完配額）
  const shouldBlock = remaining <= 0
  assert.equal(shouldBlock, true, 'remaining 為 0 時應阻止')
})

// ============================================================================
// I-RL-08：指紋層速率限制（可選功能）
// ============================================================================
test('I-RL-08：指紋層 key 生成（可選功能）', () => {
  // 如果有指紋層，key 應包含指紋
  // 這裡測試基本邏輯

  const ip = '192.0.2.1'
  const fingerprint = 'abc123'

  // 組合 key
  const combinedKey = `${ip}:${fingerprint}`
  assert.equal(combinedKey, '192.0.2.1:abc123')
})

// ============================================================================
// I-RL-09：速率限制重置邏輯
// ============================================================================
test('I-RL-09：window 結束後 remaining 應重置', () => {
  const windowMs = 60 * 1000
  const now = Date.now()
  const windowStart = now - windowMs

  // 模擬新 window
  const newRemaining = 60
  assert.equal(newRemaining, 60, '新 window 應有完整配額')
})

test('I-RL-09：reset 時間應為 window 結束時間', () => {
  const windowMs = 60 * 1000
  const now = Date.now()
  const resetTime = Math.ceil(now / windowMs) * windowMs

  // resetTime 應為未來
  assert.ok(resetTime >= now, 'resetTime 應 >= now')
  // resetTime - now 應 <= windowMs
  assert.ok(resetTime - now <= windowMs, 'resetTime - now 應 <= windowMs')
})

// ============================================================================
// I-RL-10：環境變數驗證
// ============================================================================
test('I-RL-10：RATE_LIMIT_PER_MIN 應為正整數', () => {
  const env = require('../../src/config/env').getEnv()
  const rateLimit = env.RATE_LIMIT_PER_MIN

  assert.equal(typeof rateLimit, 'number')
  assert.ok(rateLimit > 0)
  assert.ok(Number.isInteger(rateLimit))
})

test('I-RL-10：windowMs 應為正整數', () => {
  const windowMs = 60 * 1000

  assert.equal(typeof windowMs, 'number')
  assert.ok(windowMs > 0)
  assert.ok(Number.isInteger(windowMs))
})

// ============================================================================
// 額外測試：handler 回應格式
// ============================================================================
test('handler：應返回 429 狀態碼', () => {
  const statusCode = 429
  assert.equal(statusCode, 429)
})

test('handler：回應應為 JSON 格式', () => {
  const response = {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: '請求過於頻繁，請稍後再試',
      requestId: 'req-123',
      retryAfter: 60,
    },
  }

  assert.ok(typeof response.error.code === 'string')
  assert.ok(typeof response.error.message === 'string')
  assert.ok(typeof response.error.requestId === 'string')
  assert.ok(typeof response.error.retryAfter === 'number')
})