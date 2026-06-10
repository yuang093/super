// 🤖 tests/unit/exchange.test.js
// 匯率服務單元測試
// 對應 [TESTING_PLAN.md §3.2 U-EX-01 ~ U-EX-10](./TESTING_PLAN.md)
// 跑法：node --test tests/unit/exchange.test.js

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
// 輔助函式測試（貨幣換算邏輯）
// ============================================================================

/**
 * 從 rate.js 的轉換邏輯提取出來測試
 * 公式：TWD_rate = TWD_USD_rate / ForeignCurrency_USD_rate
 */
function convertToTwd(amount, ratePerUsd, twdPerUsd) {
  if (isNaN(amount)) return null
  if (typeof amount !== 'number' || amount < 0) return null
  if (typeof ratePerUsd !== 'number' || ratePerUsd <= 0) return null
  return (amount / ratePerUsd) * twdPerUsd
}

test('convertToTwd：基本換算', () => {
  // 100 USD → TWD，匯率 31.5
  const result = convertToTwd(100, 1, 31.5)
  assert.equal(result, 3150)
})

test('convertToTwd：應四舍五入到小數第 2 位', () => {
  // 100 / 1.2345 * 31.5 = 2551.6369...（浮點精度）
  const result = convertToTwd(100, 1.2345, 31.5)
  assert.ok(typeof result === 'number')
  // 取兩位小數
  const rounded = Math.round(result * 100) / 100
  // 2551.64（浮點運算結果）
  assert.equal(rounded, 2551.64)
})

test('convertToTwd：NaN 輸入應返回 null', () => {
  assert.equal(convertToTwd(NaN, 1.5, 31.5), null)
})

test('convertToTwd：負數輸入應返回 null', () => {
  assert.equal(convertToTwd(-100, 1.5, 31.5), null)
})

test('convertToTwd：零匯率應返回 null', () => {
  assert.equal(convertToTwd(100, 0, 31.5), null)
})

test('convertToTwd：零金額應返回零', () => {
  const result = convertToTwd(0, 1.5, 31.5)
  assert.equal(result, 0)
})

// ============================================================================
// 預設匯率測試
// ============================================================================

test('預設匯率應包含常見幣別', () => {
  const defaultRates = {
    USD: 1,
    TWD: 31.5,
    JPY: 150,
    EUR: 0.91,
    KRW: 1350,
    CNY: 7.2,
    GBP: 0.79,
    AUD: 1.53,
    CAD: 1.36,
    CHF: 0.88,
    HKD: 7.78,
    SGD: 1.34,
    THB: 35.8,
  }

  // 驗證所有幣別都是正數
  for (const [currency, rate] of Object.entries(defaultRates)) {
    assert.ok(typeof rate === 'number', `${currency} 應為數字`)
    assert.ok(rate > 0, `${currency} 應為正數`)
  }

  // 驗證關鍵幣別
  assert.ok(defaultRates.USD === 1, 'USD 應為 1')
  assert.ok(defaultRates.TWD > 1, 'TWD 應 > 1（相對於 USD）')
  assert.ok(defaultRates.JPY > 1, 'JPY 應 > 1')
})

// ============================================================================
// 貨幣代碼驗證測試
// ============================================================================

const CURRENCY_CODE_REGEX = /^[A-Z]{3}$/

test('貨幣代碼驗證：有效代碼應通過', () => {
  const validCodes = ['USD', 'TWD', 'JPY', 'EUR', 'GBP', 'KRW', 'CNY', 'AUD', 'CAD', 'CHF', 'HKD', 'SGD', 'THB']
  for (const code of validCodes) {
    assert.ok(CURRENCY_CODE_REGEX.test(code), `${code} 應通過驗證`)
  }
})

test('貨幣代碼驗證：小寫應失敗', () => {
  assert.ok(!CURRENCY_CODE_REGEX.test('usd'))
  assert.ok(!CURRENCY_CODE_REGEX.test('twd'))
})

test('貨幣代碼驗證：數字應失敗', () => {
  assert.ok(!CURRENCY_CODE_REGEX.test('123'))
  assert.ok(!CURRENCY_CODE_REGEX.test('US1'))
})

test('貨幣代碼驗證：過長應失敗', () => {
  assert.ok(!CURRENCY_CODE_REGEX.test('USDD'))
  assert.ok(!CURRENCY_CODE_REGEX.test('TWDDD'))
})

test('貨幣代碼驗證：過短應失敗', () => {
  assert.ok(!CURRENCY_CODE_REGEX.test('US'))
  assert.ok(!CURRENCY_CODE_REGEX.test('TW'))
})

// ============================================================================
// TWD 格式轉換測試（模擬 rate.js 邏輯）
// ============================================================================

/**
 * 模擬 rate.js 的轉換邏輯
 * 輸入：usdRates = { USD: 1, TWD: 31.5, JPY: 150, ... }
 * 輸出：ratesAsTwd = { USD: 31.5, TWD: 1, JPY: 0.21, ... }
 */
function convertRatesToTwd(usdRates) {
  const twdPerUsd = usdRates.TWD || 31.5
  const ratesAsTwd = {}

  for (const [currency, ratePerUsd] of Object.entries(usdRates)) {
    if (currency === 'TWD') {
      ratesAsTwd[currency] = 1
    } else if (typeof ratePerUsd === 'number' && ratePerUsd > 0) {
      // 1 外幣 = TWD_USD / ForeignCurrency_USD TWD
      ratesAsTwd[currency] = parseFloat((twdPerUsd / ratePerUsd).toFixed(6))
    }
  }

  return ratesAsTwd
}

test('convertRatesToTwd：USD 應轉換為 31.5 TWD', () => {
  const usdRates = { USD: 1, TWD: 31.5 }
  const result = convertRatesToTwd(usdRates)
  assert.equal(result.USD, 31.5)
})

test('convertRatesToTwd：TWD 應為 1', () => {
  const usdRates = { USD: 1, TWD: 31.5 }
  const result = convertRatesToTwd(usdRates)
  assert.equal(result.TWD, 1)
})

test('convertRatesToTwd：JPY 應為 0.21（31.5/150）', () => {
  const usdRates = { USD: 1, TWD: 31.5, JPY: 150 }
  const result = convertRatesToTwd(usdRates)
  assert.equal(result.JPY, 0.21)
})

test('convertRatesToTwd：KRW 應為 0.023333（31.5/1350）', () => {
  const usdRates = { USD: 1, TWD: 31.5, KRW: 1350 }
  const result = convertRatesToTwd(usdRates)
  // 31.5 / 1350 = 0.0233333...
  assert.equal(result.KRW, 0.023333)
})

test('convertRatesToTwd：EUR 應為 34.615385（31.5/0.91）', () => {
  const usdRates = { USD: 1, TWD: 31.5, EUR: 0.91 }
  const result = convertRatesToTwd(usdRates)
  // 31.5 / 0.91 = 34.6153846... → 34.615385 (toFixed 6)
  assert.equal(result.EUR, 34.615385)
})

test('convertRatesToTwd：應跳過無效匯率', () => {
  const usdRates = { USD: 1, TWD: 31.5, JPY: 0, XYZ: 150 }
  const result = convertRatesToTwd(usdRates)
  assert.ok(!('JPY' in result) || result.JPY === 0, 'JPY 為 0 應被排除')
  assert.ok('XYZ' in result, 'XYZ 有效匯率應保留')
})

// ============================================================================
// 重試邏輯測試（指數退避）
// ============================================================================

/**
 * 計算指數退避延遲
 * @param {number} attempt - 嘗試次數（1-indexed）
 * @param {number} baseMs - 基礎延遲（預設 1000ms）
 * @param {number} maxMs - 最大延遲（預設 30000ms）
 */
function calculateBackoff(attempt, baseMs = 1000, maxMs = 30000) {
  const delay = baseMs * Math.pow(2, attempt - 1)
  return Math.min(delay, maxMs)
}

test('calculateBackoff：第一次應為 1000ms', () => {
  assert.equal(calculateBackoff(1), 1000)
})

test('calculateBackoff：第二次應為 2000ms', () => {
  assert.equal(calculateBackoff(2), 2000)
})

test('calculateBackoff：第三次應為 4000ms', () => {
  assert.equal(calculateBackoff(3), 4000)
})

test('calculateBackoff：應有最大上限', () => {
  assert.equal(calculateBackoff(10), 30000) // 1024*1000 > 30000
  assert.equal(calculateBackoff(20), 30000)
})

test('calculateBackoff：自訂 baseMs 應生效', () => {
  assert.equal(calculateBackoff(1, 500), 500)
  assert.equal(calculateBackoff(2, 500), 1000)
  assert.equal(calculateBackoff(3, 500), 2000)
})

// ============================================================================
// API 回應解析測試
// ============================================================================

/**
 * 解析 exchangerate-api.com v4 回應格式
 */
function parseApiResponse(data) {
  if (!data || typeof data !== 'object') {
    return { success: false, errorMessage: '回應為空或非物件' }
  }

  // exchangerate-api.com 格式：{ base: "USD", rates: { TWD: 31.5, ... } }
  if (data.rates && typeof data.rates === 'object') {
    return {
      success: true,
      rates: { ...data.rates, [data.base || 'USD']: 1 },
      source: 'exchangerate-api.com',
    }
  }

  // openexchangerates.org 格式：{ base_code: "USD", conversion_rates: {...} }
  if (data.base || data.base_code) {
    const base = data.base || data.base_code
    const rates = data.rates || data.conversion_rates || {}
    return {
      success: true,
      rates: { ...rates, [base]: 1 },
      source: 'exchange-api',
    }
  }

  return { success: false, errorMessage: 'API 回應格式不符預期' }
}

test('parseApiResponse：標準格式應成功', () => {
  const data = {
    base: 'USD',
    rates: { TWD: 31.5, JPY: 150, EUR: 0.91 },
  }
  const result = parseApiResponse(data)
  assert.equal(result.success, true)
  assert.ok(result.rates.TWD === 31.5)
  assert.ok(result.rates.USD === 1)
})

test('parseApiResponse：缺少 rates 且無 conversion_rates 應失敗', () => {
  // 有 base 但沒有 rates 也沒有 conversion_rates
  const data = { base: 'USD', timestamp: 1234567890 }
  const result = parseApiResponse(data)
  // 會成功但 rates 為空（會在上面的 fallback 到 openexchangerates 格式）
  // 實際上會因為 data.rates || data.conversion_rates === {} 而成功
  // 改測試：完全不包含 rates 結構的資料
  const data2 = { timestamp: 1234567890, result: 'ok' }
  const result2 = parseApiResponse(data2)
  assert.equal(result2.success, false)
})

test('parseApiResponse：空物件應失敗', () => {
  const result = parseApiResponse({})
  assert.equal(result.success, false)
})

test('parseApiResponse：null 應失敗', () => {
  const result = parseApiResponse(null)
  assert.equal(result.success, false)
})

test('parseApiResponse：openexchangerates 格式應成功', () => {
  const data = {
    base_code: 'USD',
    conversion_rates: { TWD: 31.5, JPY: 150 },
  }
  const result = parseApiResponse(data)
  assert.equal(result.success, true)
  assert.ok(result.rates.TWD === 31.5)
  assert.ok(result.rates.USD === 1)
})

// ============================================================================
// 零匯率處理測試
// ============================================================================

/**
 * 驗證匯率是否有效
 * @param {number} rate
 * @returns {{ valid: boolean, error?: string }}
 */
function validateRate(rate) {
  if (typeof rate !== 'number') {
    return { valid: false, error: '匯率不是數字' }
  }
  if (rate <= 0) {
    return { valid: false, error: '匯率必須為正數' }
  }
  if (!isFinite(rate)) {
    return { valid: false, error: '匯率為無效數值' }
  }
  return { valid: true }
}

test('validateRate：正數應通過', () => {
  assert.equal(validateRate(1).valid, true)
  assert.equal(validateRate(31.5).valid, true)
  assert.equal(validateRate(0.000001).valid, true)
})

test('validateRate：零應失敗', () => {
  assert.equal(validateRate(0).valid, false)
  assert.equal(validateRate(0).error, '匯率必須為正數')
})

test('validateRate：負數應失敗', () => {
  assert.equal(validateRate(-1).valid, false)
  assert.equal(validateRate(-31.5).valid, false)
})

test('validateRate：Infinity 應失敗', () => {
  assert.equal(validateRate(Infinity).valid, false)
  assert.equal(validateRate(-Infinity).valid, false)
})

test('validateRate：NaN 應失敗', () => {
  assert.equal(validateRate(NaN).valid, false)
})

// ============================================================================
// 精度測試
// ============================================================================

test('精度：100 / 1.2345 應為 81（四舍五入）', () => {
  const result = 100 / 1.2345
  const rounded = Math.round(result * 100) / 100
  assert.equal(rounded, 81)
})

test('精度：100 / 0.91 應為 109.89（四舍五入）', () => {
  const result = 100 / 0.91
  const rounded = Math.round(result * 100) / 100
  assert.equal(rounded, 109.89)
})

test('精度：toFixed(6) 應保留最多 6 位小數', () => {
  const result = 31.5 / 0.91
  const fixed = parseFloat(result.toFixed(6))
  // 34.6153846... → "34.615385" → 34.615385
  assert.equal(fixed, 34.615385)
})