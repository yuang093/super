// 🤖 src/db/repositories/webhookRepository.js
// webhook_subscriptions 表操作
// 對應 [todo_progress.md B-09](../../todo_progress.md)

'use strict';

const BaseRepository = require('./baseRepository');

/**
 * Webhook 訂閱 Repository
 */
class WebhookRepository extends BaseRepository {
  constructor(db) {
    super(db, 'webhook_subscriptions');
  }

  /**
   * 新增訂閱
   * @param {Object} data
   * @param {string} data.url - Webhook URL
   * @param {string[]} data.events - 事件名稱陣列
   * @param {string} data.secretHash -秘密雜湊
   * @returns {import('better-sqlite3').RunResult}
   */
  create({ url, events, secretHash }) {
    if (!url || !events || !secretHash) {
      throw new Error('url、events、secretHash 不可為空');
    }
    return this.db
      .prepare(
        `INSERT INTO webhook_subscriptions (url, events, secret_hash, is_active, created_at)
         VALUES (?, ?, ?, 1, ?)`
      )
      .run(url, JSON.stringify(events), secretHash, Date.now());
  }

  /**
   * 查詢所有啟用的訂閱
   * @returns {Array}
   */
  findActive() {
    return this.db
      .prepare(`SELECT * FROM webhook_subscriptions WHERE is_active = 1`)
      .all();
  }

  /**
   * 查詢特定事件的訂閱
   * @param {string} eventName - 事件名稱
   * @returns {Array}
   */
  findByEvent(eventName) {
    const rows = this.db
      .prepare(`SELECT * FROM webhook_subscriptions WHERE is_active = 1`)
      .all();
    return rows.filter((row) => {
      try {
        const events = JSON.parse(row.events);
        return events.includes(eventName);
      } catch (_) {
        return false;
      }
    });
  }

  /**
   * 更新最後觸發時間
   * @param {number} id
   */
  updateLastTriggered(id) {
    this.db
      .prepare(`UPDATE webhook_subscriptions SET last_triggered_at = ? WHERE id = ?`)
      .run(Date.now(), id);
  }

  /**
   * 停用訂閱
   * @param {number} id
   * @returns {import('better-sqlite3').RunResult}
   */
  deactivate(id) {
    return this.db
      .prepare(`UPDATE webhook_subscriptions SET is_active = 0 WHERE id = ?`)
      .run(id);
  }
}

module.exports = WebhookRepository;
