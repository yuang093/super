// 🤖 src/db/repositories/baseRepository.js
// 共用 CRUD 介面，所有 Repository 繼承此類別
// 對應 [CLAUDE.md §1.1 模組邊界](../../CLAUDE.md)：Repository 隔離 SQL

'use strict';

/**
 * 基礎 Repository
 * 提供 findById / findAll / deleteById / count 等通用操作
 * 子類別可擴充自定義查詢
 */
class BaseRepository {
  /**
   * @param {import('better-sqlite3').Database} db
   * @param {string} tableName
   */
  constructor(db, tableName) {
    if (!db) throw new Error('BaseRepository 需要 db 實例');
    if (!tableName) throw new Error('BaseRepository 需要 tableName');
    this.db = db;
    this.table = tableName;
  }

  /**
   * 依 ID 查詢單筆
   * @param {number|string} id
   * @returns {Object|undefined}
   */
  findById(id) {
    return this.db.prepare(`SELECT * FROM ${this.table} WHERE id = ?`).get(id);
  }

  /**
   * 查詢所有（分頁）
   * @param {number} limit
   * @param {number} offset
   * @returns {Object[]}
   */
  findAll(limit = 100, offset = 0) {
    return this.db
      .prepare(`SELECT * FROM ${this.table} ORDER BY id DESC LIMIT ? OFFSET ?`)
      .all(limit, offset);
  }

  /**
   * 依 ID 刪除
   * @param {number|string} id
   * @returns {import('better-sqlite3').RunResult}
   */
  deleteById(id) {
    return this.db.prepare(`DELETE FROM ${this.table} WHERE id = ?`).run(id);
  }

  /**
   * 計算總筆數
   * @returns {number}
   */
  count() {
    return this.db.prepare(`SELECT COUNT(*) AS n FROM ${this.table}`).get().n;
  }

  /**
   * 在 transaction 內執行多個操作
   * @param {Function} fn
   * @returns {*}
   */
  transaction(fn) {
    return this.db.transaction(fn)();
  }
}

module.exports = BaseRepository;
