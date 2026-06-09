// 🤖 src/db/repositories/exchangeRateRepository.js
// exchange_rates 表操作
// 對應 [todo_progress.md B-08](../../todo_progress.md) 匯率 API + SQLite Fallback

'use strict'

const BaseRepository = require('./baseRepository')

/**
 * 匯率 Repository
 * 提供：upsert（更新或新增）、findByPair、isStale、cleanOld
 */
class ExchangeRateRepository extends BaseRepository {
  constructor(db) {
    super(db, 'exchange_rates')
  }

  /**
   * 新增或更新匯率（用 UNIQUE 索引）
   * @param {Object} data
   * @param {string} data.baseCurrency
   * @param {string} data.targetCurrency
   * @param {number} data.rate
   * @param {string} [data.source='exchangerate-api.com']
   * @returns {import('better-sqlite3').RunResult}
   */
  upsert({ baseCurrency, targetCurrency, rate, source = 'exchangerate-api.com' }) {
    if (!baseCurrency || !targetCurrency) throw new Error('baseCurrency 與 targetCurrency 不可為空')
    if (typeof rate !== 'number' || rate <= 0) throw new Error('rate 必須為正數')

    const now = Date.now()
    return this.db
      .prepare(
        `INSERT INTO exchange_rates (base_currency, target_currency, rate, fetched_at, source)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(base_currency, target_currency) DO UPDATE SET
           rate = excluded.rate,
           fetched_at = excluded.fetched_at,
           source = excluded.source`
      )
      .run(baseCurrency, targetCurrency, rate, now, source)
  }

  /**
   * 查詢特定幣別對的最新匯率
   * @param {string} baseCurrency
   * @param {string} targetCurrency
   * @returns {Object|undefined}
   */
  findByPair(baseCurrency, targetCurrency) {
    return this.db
      .prepare(
        `SELECT * FROM exchange_rates
         WHERE base_currency = ? AND target_currency = ?
         ORDER BY fetched_at DESC LIMIT 1`
      )
      .get(baseCurrency, targetCurrency)
  }

  /**
   * 判斷匯率是否過期
   * @param {string} baseCurrency
   * @param {string} targetCurrency
   * @param {number} [ttlHours=24]
   * @returns {boolean} - true 表示過期或不存在
   */
  isStale(baseCurrency, targetCurrency, ttlHours = 24) {
    const record = this.findByPair(baseCurrency, targetCurrency)
    if (!record) return true
    return Date.now() - record.fetched_at > ttlHours * 60 * 60 * 1000
  }

  /**
   * 清理過期匯率（預設保留 7 天）
   * @param {number} [ttlHours=168]
   * @returns {import('better-sqlite3').RunResult}
   */
  cleanOld(ttlHours = 168) {
    const threshold = Date.now() - ttlHours * 60 * 60 * 1000
    return this.db.prepare('DELETE FROM exchange_rates WHERE fetched_at < ?').run(threshold)
  }
}

module.exports = ExchangeRateRepository
