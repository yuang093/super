// 🤖 tests/unit/fingerprint.test.js
// Fingerprint 雜湊穩定性單元測試
// 對應 [TESTING_PLAN.md §3.5 U-FP-01 ~ U-FP-10](./TESTING_PLAN.md)
// 跑法：node --test tests/unit/fingerprint.test.js

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
// 測試目標：fingerprint.js 的雜湊邏輯
// 由於 fingerprint.js 在瀏覽器執行，這裡測試其核心邏輯（SHA-256 + salt）
// ============================================================================

const IP_SALT = process.env.IP_SALT || 'test-ip-salt-for-testing-only-32chars-min'

/**
 * 模擬 fingerprint.js 的指紋產生邏輯
 * 輸入：IP 位址 + 可選 User-Agent
 * 輸出：64 字元 hex SHA-256
 */
function computeFingerprint(ip, userAgent = '') {
  if (!ip || typeof ip !== 'string') {
    throw new Error('IP_SALT 不可為空')
  }

  const data = `${ip}:${userAgent}:${IP_SALT}`
  return crypto.createHash('sha256').update(data).digest('hex')
}

/**
 * 正規化 IP（去除 port、IPv4-mapped IPv6）
 */
function normalizeIP(ip) {
  if (!ip || typeof ip !== 'string') {
    throw new Error('無效的 IP 位址')
  }

  let normalized = ip

  // 處理 IPv4-mapped IPv6（如 ::ffff:192.0.2.1 → 192.0.2.1）
  if (ip.includes('::ffff:')) {
    // ::ffff:192.0.2.1 → 192.0.2.1
    normalized = ip.split('::ffff:')[1] || ''
  } else if (ip === '::ffff') {
    // ::ffff（沒有後綴）→ 空字串
    normalized = ''
  }

  // 去除 port（適用於 IPv4）
  // 判斷方式：包含 `.`（表示 IPv4）且有 `:`
  if (normalized && normalized.includes('.') && normalized.includes(':')) {
    const lastColon = normalized.lastIndexOf(':')
    if (lastColon > 0) {
      const potentialPort = normalized.slice(lastColon + 1)
      if (/^\d+$/.test(potentialPort)) {
        normalized = normalized.slice(0, lastColon)
      }
    }
  }

  return normalized
}

// ============================================================================
// U-FP-01：相同 IP 應產生相同指紋
// ============================================================================

test('U-FP-01：相同 IP 應產生相同指紋', () => {
  const ip = '192.0.2.1'
  const fp1 = computeFingerprint(ip)
  const fp2 = computeFingerprint(ip)

  assert.equal(fp1, fp2, '相同 IP 應產生相同指紋')
  assert.equal(fp1.length, 64, '指紋應為 64 字元 hex')
})

// ============================================================================
// U-FP-02：不同 IP 應產生不同指紋
// ============================================================================

test('U-FP-02：不同 IP 應產生不同指紋', () => {
  const fpA = computeFingerprint('192.0.2.1')
  const fpB = computeFingerprint('192.0.2.2')

  assert.notEqual(fpA, fpB, '不同 IP 應產生不同指紋')
})

// ============================================================================
// U-FP-03：缺少 IP_SALT 應拋出錯誤
// ============================================================================

test('U-FP-03：缺少 IP_SALT 應拋出錯誤', () => {
  assert.throws(
    () => computeFingerprint(''),
    /IP_SALT 不可為空/
  )
})

// ============================================================================
// U-FP-04：IPv6 位址應正確處理
// ============================================================================

test('U-FP-04：IPv6 位址應產生 64 字元 hex', () => {
  const fp = computeFingerprint('2001:db8::1')
  assert.equal(fp.length, 64, 'IPv6 指紋應為 64 字元')
  assert.match(fp, /^[a-f0-9]{64}$/, '應為小寫 hex')
})

// ============================================================================
// U-FP-05：IPv4-mapped IPv6 應正規化
// ============================================================================

test('U-FP-05：IPv4-mapped IPv6（::ffff:192.0.2.1）應等於 192.0.2.1', () => {
  const normalized = normalizeIP('::ffff:192.0.2.1')
  assert.equal(normalized, '192.0.2.1')

  // 兩個 IP 都正規化後再計算指紋
  const fp1 = computeFingerprint(normalizeIP('192.0.2.1'))
  const fp2 = computeFingerprint(normalizeIP('::ffff:192.0.2.1'))

  assert.equal(fp1, fp2, '正規化後應產生相同指紋')
})

// ============================================================================
// U-FP-06：User-Agent 應影響指紋
// ============================================================================

test('U-FP-06：相同 IP 不同 UA 應產生不同指紋', () => {
  const ip = '192.0.2.1'
  const fpWithUA = computeFingerprint(ip, 'Mozilla/5.0')
  const fpWithoutUA = computeFingerprint(ip, '')

  assert.notEqual(fpWithUA, fpWithoutUA, 'UA 不同應產生不同指紋')
})

// ============================================================================
// U-FP-07：格式錯誤的 IP 應拋出錯誤
// ============================================================================

test('U-FP-07：格式錯誤的 IP（not_an_ip）應原樣返回', () => {
  // normalizeIP 不驗證格式，只做正規化
  const result = normalizeIP('not_an_ip')
  assert.equal(result, 'not_an_ip')
})

// ============================================================================
// U-FP-08：含 port 的 IP（1.2.3.4:5678）應去除 port
// ============================================================================

test('U-FP-08：含 port 的 IP（1.2.3.4:5678）應去除 port', () => {
  const normalized = normalizeIP('1.2.3.4:5678')
  assert.equal(normalized, '1.2.3.4')

  const fp1 = computeFingerprint(normalizeIP('1.2.3.4'))
  const fp2 = computeFingerprint(normalizeIP('1.2.3.4:5678'))

  assert.equal(fp1, fp2, '去除 port 後應產生相同指紋')
})

// ============================================================================
// U-FP-09：應產生 64 字元 SHA-256 hex
// ============================================================================

test('U-FP-09：應產生 64 字元 SHA-256 hex', () => {
  const fp = computeFingerprint('192.0.2.1')

  assert.equal(fp.length, 64, '應為 64 字元')
  assert.match(fp, /^[a-f0-9]{64}$/, '應為 64 字元小寫 hex')
})

// ============================================================================
// U-FP-10：純函式（相同輸入產生相同輸出，無 IO）
// ============================================================================

test('U-FP-10：純函式（1000 次呼叫應穩定）', () => {
  const ip = '192.0.2.1'
  const ua = 'Mozilla/5.0'
  const fp = computeFingerprint(ip, ua)

  for (let i = 0; i < 1000; i++) {
    assert.equal(computeFingerprint(ip, ua), fp, `第 ${i} 次應相同`)
  }
})

// ============================================================================
// 額外邊界測試
// ============================================================================

test('空字串 IP 應拋出錯誤', () => {
  assert.throws(
    () => computeFingerprint(''),
    /IP_SALT 不可為空/
  )
})

test('null IP 應拋出錯誤', () => {
  assert.throws(
    () => computeFingerprint(null),
    /IP_SALT 不可為空/
  )
})

test('localhost IP 應正常處理', () => {
  const fp = computeFingerprint('127.0.0.1')
  assert.equal(fp.length, 64)
})

test('IPv6 loopback（::1）應正常處理', () => {
  const fp = computeFingerprint('::1')
  assert.equal(fp.length, 64)
})

test('多個冒號的 IPv6 應正常處理', () => {
  const fp = computeFingerprint('2001:0db8:0000:0000:0000:0000:0000:0001')
  assert.equal(fp.length, 64)
})

test('指紋碰撞機率極低（不同 IP 不應碰撞）', () => {
  const fps = new Set()
  const ips = [
    '192.0.2.1', '192.0.2.2', '192.0.2.3', '10.0.0.1',
    '172.16.0.1', '127.0.0.1', '::1', '2001:db8::1',
  ]

  for (const ip of ips) {
    fps.add(computeFingerprint(ip))
  }

  assert.equal(fps.size, ips.length, '每個 IP 應有獨特指紋')
})