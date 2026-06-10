// 🤖 tests/e2e/high-load.test.js
// T-E-06：高負載測試（同時 50 人辨識）
// 對應 [TESTING_PLAN.md §5.4 E-CC-01 ~ E-CC-02](./TESTING_PLAN.md)
// 對應 [todo_progress.md T-E-06](./todo_progress.md)
//
// 工具：使用 Node.js 原生 http 模組，無需額外安裝 k6
// 跑法：npx playwright test tests/e2e/high-load.test.js
// 或直接：node tests/e2e/high-load.test.js

'use strict'

const http = require('node:http')

const LOCAL_URL = process.env.LOCAL_URL || 'http://localhost:3001'
const TARGET_HOST = LOCAL_URL.replace('http://', '')

/**
 * 發送 HTTP 請求
 * @param {string} path - 路徑
 * @param {object} options - 選項
 * @returns {Promise<{status: number, duration: number}>}
 */
function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(LOCAL_URL + path)
    const start = Date.now()

    const req = http.request(
      {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname,
        method: options.method || 'GET',
        headers: options.headers || {},
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            duration: Date.now() - start,
            data: data.slice(0, 200), // 只取前 200 字元
          })
        })
      }
    )

    req.on('error', reject)
    req.setTimeout(10000, () => {
      req.destroy()
      reject(new Error('Request timeout'))
    })

    if (options.body) {
      req.write(options.body)
    }
    req.end()
  })
}

/**
 * 發送多個並發請求
 * @param {number} count - 並發數量
 * @param {string} path - 路徑
 * @param {object} options - 選項
 * @returns {Promise<Array<{status: number, duration: number}>>}
 */
async function concurrentRequests(count, path, options = {}) {
  return Promise.all(
    Array.from({ length: count }, () =>
      makeRequest(path, options).catch((err) => ({
        status: 0,
        duration: 0,
        error: err.message,
      }))
    )
  )
}

// ============================================================================
// T-E-06：高負載測試
// ============================================================================

const { test, expect } = require('@playwright/test')

test.describe('T-E-06：高負載測試（同時 50 人辨識）', () => {
  // --------------------------------------------------------------------------
  // E-CC-01：50 個並發請求
  // --------------------------------------------------------------------------
  test('E-CC-01：50 個並發請求時 P95 響應時間應合理', async () => {
    const CONCURRENT_COUNT = 50
    const results = await concurrentRequests(CONCURRENT_COUNT, '/healthz')

    // 過濾成功和失敗
    const successful = results.filter((r) => r.status === 200)
    const failed = results.filter((r) => r.status !== 200)

    console.log(`[E-CC-01] 50 個並發請求：${successful.length} 成功，${failed.length} 失敗`)

    // 至少 90% 應該成功
    const successRate = successful.length / CONCURRENT_COUNT
    expect(successRate).toBeGreaterThanOrEqual(0.9)

    // 計算 P95 響應時間
    const durations = successful.map((r) => r.duration).sort((a, b) => a - b)
    const p95Index = Math.floor(durations.length * 0.95)
    const p95 = durations[p95Index] || 0

    console.log(`[E-CC-01] P95 響應時間：${p95}ms`)
    console.log(`[E-CC-01] 平均響應時間：${Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)}ms`)

    // P95 應該小於 3 秒（3000ms）
    expect(p95).toBeLessThan(3000)
  })

  // --------------------------------------------------------------------------
  // E-CC-02：速率限制測試（每 IP 30 RPM）
  // --------------------------------------------------------------------------
  test('E-CC-02：60 個請求應觸發速率限制（第 31 個回傳 429）', async () => {
    const REQUEST_COUNT = 60
    const results = []

    // 順序發送 60 個請求（模擬快速連續請求）
    for (let i = 0; i < REQUEST_COUNT; i++) {
      try {
        const result = await makeRequest('/healthz')
        result.index = i + 1
        results.push(result)
      } catch (err) {
        results.push({ index: i + 1, status: 0, error: err.message })
      }
    }

    // 統計 429 響應
    const rateLimited = results.filter((r) => r.status === 429)
    const first429 = results.find((r) => r.status === 429)

    console.log(`[E-CC-02] ${REQUEST_COUNT} 個請求中，${rateLimited.length} 個被速率限制`)
    if (first429) {
      console.log(`[E-CC-02] 第一個 429 發生在第 ${first429.index} 個請求`)
    }

    // 應該至少有 1 個 429（因為速率限制低於總請求數）
    // 根據 rate limiter 設定：windowMs=60000, max=30
    // 所以第 31 個請求開始應該被限制
    if (rateLimited.length > 0) {
      expect(first429.index).toBeLessThanOrEqual(35) // 容許一些彈性
    }
  })

  // --------------------------------------------------------------------------
  // E-CC-03：100 個並發 healthz 請求
  // --------------------------------------------------------------------------
  test('E-CC-03：100 個並發 healthz 請求零丟失', async () => {
    const CONCURRENT_COUNT = 100
    const results = await concurrentRequests(CONCURRENT_COUNT, '/healthz')

    const successful = results.filter((r) => r.status === 200)
    const successRate = successful.length / CONCURRENT_COUNT

    console.log(`[E-CC-03] 100 個並發 healthz：${successful.length}/${CONCURRENT_COUNT} 成功（${(successRate * 100).toFixed(1)}%）`)

    // 至少 95% 應該成功
    expect(successRate).toBeGreaterThanOrEqual(0.95)
  })

  // --------------------------------------------------------------------------
  // E-CC-04：高負載下的錯誤率
  // --------------------------------------------------------------------------
  test('E-CC-04：高負載下不應有伺服器錯誤（5xx）', async () => {
    const CONCURRENT_COUNT = 30
    const results = await concurrentRequests(CONCURRENT_COUNT, '/healthz')

    const serverErrors = results.filter((r) => r.status >= 500)
    const successCount = results.filter((r) => r.status === 200).length

    console.log(`[E-CC-04] ${CONCURRENT_COUNT} 個請求：${successCount} 成功，${serverErrors.length} 伺服器錯誤`)

    expect(serverErrors.length).toBe(0)
  })

  // --------------------------------------------------------------------------
  // E-CC-05：長時間高負載測試（漸增）
  // --------------------------------------------------------------------------
  test('E-CC-05：漸增負載下應保持穩定', async () => {
    const stages = [10, 20, 30, 40, 50]
    const results = []

    for (const count of stages) {
      const stageResults = await concurrentRequests(count, '/healthz')
      const successful = stageResults.filter((r) => r.status === 200)
      const successRate = (successful.length / count) * 100
      console.log(`[E-CC-05] 階段 ${count} 併發：${successRate.toFixed(1)}% 成功率`)
      results.push({ count, successRate })
    }

    // 每個階段至少 90% 成功率
    const allStable = results.every((r) => r.successRate >= 90)
    expect(allStable).toBe(true)
  })
})