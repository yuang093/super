// 🤖 src/routes/items.js
// GET /api/items?fingerprint=X - 列出該使用者的購物車
// DELETE /api/items/:id - 刪除單筆商品
// DELETE /api/items?fingerprint=X - 清空該使用者所有商品
// 對應 [todo_progress.md F-06](../../todo_progress.md)

'use strict';

const express = require('express');

const ItemRepository = require('../db/repositories/itemRepository');
const { getDatabase } = require('../db/database');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * GET /api/items?fingerprint=X[&limit=50&offset=0]
 * 列出購物車商品（依時間倒序）
 */
router.get('/', (req, res, next) => {
  try {
    const fingerprint = req.query.fingerprint;
    if (!fingerprint) {
      throw new AppError('缺少 fingerprint 查詢參數', { code: 'MISSING_FINGERPRINT', status: 400 });
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const db = getDatabase();
    const itemRepo = new ItemRepository(db);
    const items = itemRepo.findByFingerprint(fingerprint, { limit, offset });
    const summary = itemRepo.sumByFingerprint(fingerprint);

    logger.info('📋 列出購物車', {
      fingerprint,
      count: items.length,
      totalAmount: summary.length,
    });

    res.json({
      success: true,
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        currency: item.currency,
        imagePath: item.image_path,
        createdAt: item.created_at,
      })),
      summary: summary.map((s) => ({
        currency: s.currency,
        total: s.total,
        count: s.count,
      })),
      pagination: { limit, offset, count: items.length },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/items/:id
 * 刪除單筆商品
 */
router.delete('/:id', (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('無效的商品 ID', { code: 'INVALID_ID', status: 400 });
    }

    const db = getDatabase();
    const itemRepo = new ItemRepository(db);
    const item = itemRepo.findById(id);
    if (!item) {
      throw new AppError('商品不存在', { code: 'NOT_FOUND', status: 404 });
    }

    itemRepo.deleteById(id);
    logger.info('🗑️ 刪除商品', { id, name: item.name });

    res.json({ success: true, id, deletedName: item.name });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/items?fingerprint=X
 * 清空該使用者所有商品
 */
router.delete('/', (req, res, next) => {
  try {
    const fingerprint = req.query.fingerprint;
    if (!fingerprint) {
      throw new AppError('缺少 fingerprint 查詢參數', { code: 'MISSING_FINGERPRINT', status: 400 });
    }

    const db = getDatabase();
    const itemRepo = new ItemRepository(db);
    const result = itemRepo.deleteAllByFingerprint(fingerprint);
    logger.info('🧹 清空購物車', { fingerprint, deletedCount: result.changes });

    res.json({ success: true, deletedCount: result.changes });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
