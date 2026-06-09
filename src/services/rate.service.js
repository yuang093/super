// 🤖 src/services/rate.service.js
// 匯率服務：從外部 API 抓取匯率，失敗時降級讀取 SQLite 快取
// 對應 [todo_progress.md B-08](../../todo_progress.md)

'use strict'

const { getEnv } = require('../config/env')
const { getDatabase } = require('../db/database')
const ExchangeRateRepository = require('../db/repositories/exchangeRateRepository')
const logger = require('../utils/logger')

/**
 * 匯率服務工廠
 * 封裝匯率抓取 + SQLite 快取更新邏輯
 */
class RateService {
  constructor() {
    const env = getEnv()
    this.apiEndpoint = env.EXCHANGE_API_ENDPOINT
    this.fallbackTtlHours = env.EXCHANGE_FALLBACK_TTL_HOURS
    this._db = null
    // 記憶體快取（1小時TTL，減少 API 請求次數）
    this._memCache = null
    this._memCacheTimestamp = 0
    this._memCacheTtlMs = 60 * 60 * 1000 // 1小時
  }

  /** 取得資料庫連線（延遲初始化） */
  get db() {
    if (!this._db) {
      this._db = getDatabase()
    }
    return this._db
  }

  /** 取得 ExchangeRateRepository 實例 */
  get repo() {
    return new ExchangeRateRepository(this.db)
  }

  /**
   * 抓取最新匯率（記憶體快取 1 小時，只在過期時才打 API）
   * @param {string} [baseCurrency='USD'] - 基準幣別
   * @returns {Promise<Object>} - 匯率對應表 { USD: 1, TWD: 31.5, JPY: 0.21, ... }
   */
  async getRates(baseCurrency = 'USD') {
    // 記憶體快取還有效：直接回傳
    if (this._memCache && Date.now() - this._memCacheTimestamp < this._memCacheTtlMs) {
      return this._memCache
    }

    // 快取過期或不存在：背景更新
    this._refreshRatesInBackground(baseCurrency)
    return this._memCache || this._getDefaultRates()
  }

  /**
   * 背景更新匯率（不打擾主流程）
   * @private
   */
  async _refreshRatesInBackground(baseCurrency = 'USD') {
    try {
      const apiResult = await this._fetchFromApi(baseCurrency)

      if (apiResult.success) {
        await this._updateCache(apiResult.rates, apiResult.source)
        this._memCache = apiResult.rates
        this._memCacheTimestamp = Date.now()
        logger.info('💱 匯率已更新（背景）', { baseCurrency })
        return
      }

      // API 失敗：降級讀取 SQLite
      const cachedRates = this._getCachedRates(baseCurrency)
      if (cachedRates) {
        this._memCache = cachedRates
        this._memCacheTimestamp = Date.now()
        logger.info('✅ 匯率已從 SQLite 快取載入（背景）')
        return
      }

      // SQLite 也沒有：用預設值
      this._memCache = this._getDefaultRates()
      this._memCacheTimestamp = Date.now()
    } catch (err) {
      logger.error('❌ 背景更新匯率失敗', { error: err.message })
      if (!this._memCache) {
        this._memCache = this._getDefaultRates()
        this._memCacheTimestamp = Date.now()
      }
    }
  }

  /**
   * 查詢特定幣別對的匯率
   * @param {string} baseCurrency -基準幣別
   * @param {string} targetCurrency - 目標幣別
   * @returns {Promise<number|null>} - 匯率值，查不到回傳 null
   */
  async getRate(baseCurrency, targetCurrency) {
    if (baseCurrency === targetCurrency) return 1

    const allRates = await this.getRates(baseCurrency)
    return allRates[targetCurrency] ?? null
  }

  /**
   * 從外部 API 抓取匯率
   * @private
   * @returns {Promise<{success: boolean, rates?: Object, source?: string, errorMessage?: string}>}
   */
  async _fetchFromApi(baseCurrency) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      const url = this.apiEndpoint.replace('/USD', `/${baseCurrency}`)
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        return {
          success: false,
          errorMessage: `HTTP ${response.status}: ${response.statusText}`,
        }
      }

      const data = await response.json()

      // 解析 exchangerate-api.com v4 回應格式
      // 回應格式：{ base: "USD", rates: { TWD: 31.5, JPY: 150.2, KRW: 1350, ... } }
      // 統一儲存為「每 1 USD = X 外幣」格式，後續在 rate.js 統一轉換
      if (data.rates && typeof data.rates === 'object') {
        return {
          success: true,
          rates: { ...data.rates, [baseCurrency]: 1 },
          source: 'exchangerate-api.com',
        }
      }

      // 解析其他常見格式（如 openexchangerates.org）
      if (data.base || data.base_code) {
        const base = data.base || data.base_code
        const rates = data.rates || data.conversion_rates || {}
        return {
          success: true,
          rates: { ...rates, [base]: 1 },
          source: 'exchange-api',
        }
      }

      return {
        success: false,
        errorMessage: 'API 回應格式不符預期',
      }
    } catch (err) {
      return {
        success: false,
        errorMessage: err.message,
      }
    }
  }

  /**
   * 更新 SQLite 快取
   * @private
   * @param {Object} rates - 匯率對應表
   * @param {string} source - 來源
   */
  async _updateCache(rates, source) {
    try {
      const repo = this.repo
      const entries = Object.entries(rates)

      for (const [currency, rate] of entries) {
        if (typeof rate === 'number' && rate > 0) {
          try {
            repo.upsert({
              baseCurrency: 'USD',
              targetCurrency: currency,
              rate,
              source,
            })
          } catch (err) {
            logger.warn('⚠️ 寫入匯率快取失敗', { currency, error: err.message })
          }
        }
      }
    } catch (err) {
      logger.error('❌ 更新匯率快取失敗', { error: err.message })
    }
  }

  /**
   * 從 SQLite 讀取快取的匯率
   * @private
   * @param {string} baseCurrency
   * @returns {Object|null} - 匯率對應表，查不到回傳 null
   */
  _getCachedRates(baseCurrency) {
    try {
      const repo = this.repo
      // 檢查是否過期
      if (repo.isStale(baseCurrency, 'TWD', this.fallbackTtlHours)) {
        return null
      }

      // 讀取所有以 baseCurrency 為基準的匯率
      const db = this.db
      const rows = db
        .prepare(
          `SELECT target_currency, rate, fetched_at
           FROM exchange_rates
           WHERE base_currency = ?
           ORDER BY fetched_at DESC`
        )
        .all(baseCurrency)

      if (rows.length === 0) return null

      // 只取每個幣別的最新一筆
      const seen = new Set()
      const rates = { [baseCurrency]: 1 }
      for (const row of rows) {
        if (!seen.has(row.target_currency)) {
          seen.add(row.target_currency)
          rates[row.target_currency] = row.rate
        }
      }

      return rates
    } catch (err) {
      logger.error('❌ 讀取匯率快取失敗', { error: err.message })
      return null
    }
  }

  /**
   * 取得預設匯率（保底值）
   * @private
   * @returns {Object}
   */
  _getDefaultRates() {
    // 回傳「每 1 USD = X 外幣」格式，與 exchangerate-api.com 一致
    // 由 rate.js 的 GET /rates 統一轉換為「每外幣換 TWD」格式
    return {
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
  }
}

//單例
let instance = null

function getRateService() {
  if (!instance) {
    instance = new RateService()
  }
  return instance
}

module.exports = { RateService, getRateService }
