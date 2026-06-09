// 🤖 src/db/repositories/fingerprintRepository.js
// fingerprints 表操作
// 對應 [todo_progress.md F-08](../../todo_progress.md) 與 [PROJECT_CONTEXT.md §7](../../PROJECT_CONTEXT.md)

'use strict'

const BaseRepository = require('./baseRepository')

/**
 * IP Fingerprint Repository
 * 提供：upsert（首次見到則新增，否則更新 last_seen_at）與查詢
 */
class FingerprintRepository extends BaseRepository {
  constructor(db) {
    super(db, 'fingerprints')
  }

  /**
   * 新增或更新 fingerprint
   * @param {string} fingerprintHash - SHA-256(IP + IP_SALT)
   * @returns {number} - fingerprint ID
   */
  upsert(fingerprintHash) {
    if (!fingerprintHash) throw new Error('fingerprintHash 不可為空')

    const now = Date.now()
    const existing = this.findByHash(fingerprintHash)

    if (existing) {
      this.db
        .prepare(
          'UPDATE fingerprints SET last_seen_at = ?, total_items = total_items + 1 WHERE id = ?'
        )
        .run(now, existing.id)
      return Number(existing.id)
    }

    const result = this.db
      .prepare(
        `INSERT INTO fingerprints (fingerprint_hash, first_seen_at, last_seen_at, total_items)
         VALUES (?, ?, ?, 1)`
      )
      .run(fingerprintHash, now, now)
    return Number(result.lastInsertRowid)
  }

  /**
   * 依 hash 查詢
   * @param {string} fingerprintHash
   * @returns {Object|undefined}
   */
  findByHash(fingerprintHash) {
    return this.db
      .prepare('SELECT * FROM fingerprints WHERE fingerprint_hash = ?')
      .get(fingerprintHash)
  }

  /**
   * 查詢活躍的 fingerprint（最近 30 天有活動）
   * @returns {Object[]}
   */
  findActive(daysWindow = 30) {
    const threshold = Date.now() - daysWindow * 24 * 60 * 60 * 1000
    return this.db
      .prepare('SELECT * FROM fingerprints WHERE last_seen_at >= ? ORDER BY last_seen_at DESC')
      .all(threshold)
  }
}

module.exports = FingerprintRepository
