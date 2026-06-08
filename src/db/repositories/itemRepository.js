// 🤖 src/db/repositories/itemRepository.js
// items 表的 CRUD 與業務查詢
// 對應 [todo_progress.md F-06](../../todo_progress.md) 購物車功能

'use strict';

const BaseRepository = require('./baseRepository');

/**
 * 商品 Repository
 * 提供：create / findByFingerprint / sumByFingerprint / updateById
 */
class ItemRepository extends BaseRepository {
  constructor(db) {
    super(db, 'items');
  }

  /**
   * 新增商品
   * @param {Object} data
   * @param {string} data.fingerprint
   * @param {string} data.name
   * @param {number} data.price
   * @param {string} [data.currency='TWD']
   * @param {string|null} [data.imagePath=null]
   * @param {string|null} [data.vlmRawResponse=null]
   * @returns {import('better-sqlite3').RunResult}
   */
  create({ fingerprint, name, price, currency = 'TWD', imagePath = null, vlmRawResponse = null }) {
    if (!fingerprint) throw new Error('fingerprint 不可為空');
    if (!name) throw new Error('name 不可為空');
    if (typeof price !== 'number' || price < 0) throw new Error('price 必須為非負數');

    const now = Date.now();
    return this.db
      .prepare(
        `INSERT INTO items (fingerprint, name, price, currency, image_path, vlm_raw_response, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(fingerprint, name, price, currency, imagePath, vlmRawResponse, now, now);
  }

  /**
   * 查詢特定 fingerprint 的所有商品（依時間倒序）
   * @param {string} fingerprint
   * @param {Object} [options]
   * @param {number} [options.limit=100]
   * @param {number} [options.offset=0]
   * @returns {Object[]}
   */
  findByFingerprint(fingerprint, { limit = 100, offset = 0 } = {}) {
    return this.db
      .prepare(
        `SELECT * FROM items WHERE fingerprint = ?
         ORDER BY created_at DESC LIMIT ? OFFSET ?`
      )
      .all(fingerprint, limit, offset);
  }

  /**
   * 依幣別分組加總某 fingerprint 的商品價格
   * @param {string} fingerprint
   * @returns {Array<{currency: string, total: number, count: number}>}
   */
  sumByFingerprint(fingerprint) {
    return this.db
      .prepare(
        `SELECT currency, SUM(price) AS total, COUNT(*) AS count
         FROM items WHERE fingerprint = ?
         GROUP BY currency`
      )
      .all(fingerprint);
  }

  /**
   * 更新商品（部分欄位）
   * @param {number} id
   * @param {Object} updates
   * @param {string} [updates.name]
   * @param {number} [updates.price]
   * @param {string} [updates.currency]
   * @returns {import('better-sqlite3').RunResult}
   */
  updateById(id, { name, price, currency }) {
    const now = Date.now();
    return this.db
      .prepare(
        `UPDATE items SET
         name = COALESCE(?, name),
         price = COALESCE(?, price),
         currency = COALESCE(?, currency),
         updated_at = ?
         WHERE id = ?`
      )
      .run(name, price, currency, now, id);
  }

  /**
   * 刪除特定 fingerprint 的所有商品（清空購物車）
   * @param {string} fingerprint
   * @returns {import('better-sqlite3').RunResult}
   */
  deleteAllByFingerprint(fingerprint) {
    return this.db.prepare('DELETE FROM items WHERE fingerprint = ?').run(fingerprint);
  }
}

module.exports = ItemRepository;
