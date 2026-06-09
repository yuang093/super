// 🤖 src/routes/webhook.js
// Webhook 訂閱管理 API
// 對應 [todo_progress.md B-09](../../todo_progress.md)
// POST /api/webhook/subscribe →註冊 Webhook URL
// DELETE /api/webhook/:id → 刪除訂閱

'use strict';

const crypto = require('node:crypto');
const express = require('express');
const { getDatabase } = require('../db/database');
const WebhookRepository = require('../db/repositories/webhookRepository');
const { getEnv } = require('../config/env');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');
const { emit, WEBHOOK_EVENTS } = require('../utils/eventBus');

const router = express.Router();

/**
 * 計算 Webhook 秘密雜湊
 * @param {string} url
 * @param {string} secret
 * @returns {string}
 */
function computeSecretHash(url, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(url)
    .digest('hex');
}

/**
 * POST /api/webhook/subscribe
 *註冊新的 Webhook URL
 */
router.post('/subscribe', (req, res, next) => {
  try {
    const { url, events } = req.body;

    if (!url || typeof url !== 'string') {
      throw new AppError('url 必須是有效的 URL 字串', { code: 'INVALID_URL', status: 400 });
    }

    if (!Array.isArray(events) || events.length === 0) {
      throw new AppError('events 必須是至少包含一個事件名稱的陣列', {
        code: 'INVALID_EVENTS',
        status: 400,
      });
    }

    // 驗證 URL格式
    try {
      new URL(url);
    } catch (_) {
      throw new AppError('url格式無效', { code: 'INVALID_URL', status: 400 });
    }

    const env = getEnv();
    const secretHash = computeSecretHash(url, env.WEBHOOK_SIGNING_SECRET);

    const db = getDatabase();
    const repo = new WebhookRepository(db);
    const result = repo.create({ url, events, secretHash });

    logger.info('✅ Webhook 訂閱已建立', { id: result.lastInsertRowid, url, events });

    res.status(201).json({
      success: true,
      id: result.lastInsertRowid,
      message: 'Webhook訂閱已建立',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/webhook/:id
 * 刪除 Webhook 訂閱
 */
router.delete('/:id', (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('無效的 Webhook ID', { code: 'INVALID_ID', status: 400 });
    }

    const db = getDatabase();
    const repo = new WebhookRepository(db);
    const existing = db.prepare('SELECT id FROM webhook_subscriptions WHERE id = ?').get(id);

    if (!existing) {
      throw new AppError('Webhook訂閱不存在', { code: 'NOT_FOUND', status: 404 });
    }

    repo.deactivate(id);
    logger.info('🗑️ Webhook 訂閱已停用', { id });

    res.json({ success: true, id, message: 'Webhook 訂閱已停用' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/webhook
 * 列出所有 Webhook 訂閱（不含 secretHash）
 */
router.get('/', (req, res, next) => {
  try {
    const db = getDatabase();
    const repo = new WebhookRepository(db);
    const rows = repo.findActive();

    const subscriptions = rows.map((row) => {
      let events;
      try {
        events = JSON.parse(row.events);
      } catch (_) {
        events = [];
      }
      return {
        id: row.id,
        url: row.url,
        events,
        isActive: Boolean(row.is_active),
        createdAt: row.created_at,
        lastTriggeredAt: row.last_triggered_at,
      };
    });

    res.json({ success: true, subscriptions });
  } catch (err) {
    next(err);
  }
});

/**
 * 內部發送 Webhook（由事件匯流排觸發）
 * @param {string} eventName
 * @param {Object} payload
 */
async function triggerWebhooks(eventName, payload) {
  try {
    const db = getDatabase();
    const repo = new WebhookRepository(db);
    const subscriptions = repo.findByEvent(eventName);

    if (subscriptions.length === 0) {
      return;
    }

    const env = getEnv();
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const timestamp = Date.now();
        const body = JSON.stringify({
          event: eventName,
          timestamp,
          data: payload,
        });

        //計算 HMAC 簽名
        const signature = crypto
          .createHmac('sha256', env.WEBHOOK_SIGNING_SECRET)
          .update(`${timestamp}.${body}`)
          .digest('hex');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), env.WEBHOOK_TIMEOUT_MS);

        try {
          const response = await fetch(sub.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Signature': signature,
              'X-Webhook-Timestamp': timestamp,
              'X-Webhook-Event': eventName,
            },
            body,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          repo.updateLastTriggered(sub.id);
          logger.info('✅ Webhook 發送成功', { url: sub.url, event: eventName });
        } catch (err) {
          clearTimeout(timeoutId);
          throw err;
        }
      })
    );

    // 發送事件讓訂閱者知道結果
    const failedCount = results.filter((r) => r.status === 'rejected').length;
    if (failedCount > 0) {
      emit(WEBHOOK_EVENTS.WEBHOOK_FAILED, { eventName, failedCount, total: results.length });
    } else {
      emit(WEBHOOK_EVENTS.WEBHOOK_SENT, { eventName, count: results.length });
    }
  } catch (err) {
    logger.error('❌ Webhook觸發失敗', { event: eventName, error: err.message });
  }
}

module.exports = router;
module.exports.triggerWebhooks = triggerWebhooks;
