// 🤖 src/routes/capture.js
// POST /api/capture - 拍照上傳 + VLM 辨識 + 寫入資料庫
// 對應 [todo_progress.md B-04 + F-04](../../todo_progress.md)

'use strict';

const express = require('express');
const fs = require('node:fs');

const { createUploadMiddleware, ALLOWED_MIME_TYPES } = require('../middleware/upload');
const { CaptureService } = require('../services/captureService');
const { VLMClient } = require('../ai/vlmClient');
const { ItemRepository } = require('../db/repositories/itemRepository');
const { FingerprintRepository } = require('../db/repositories/fingerprintRepository');
const { getDatabase } = require('../db/database');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();

/** VLM Client 單例（延遲初始化避免啟動時錯誤） */
let vlmClientInstance = null;
function getVLMClient() {
  if (!vlmClientInstance) {
    vlmClientInstance = new VLMClient();
  }
  return vlmClientInstance;
}

/** CaptureService 單例 */
let captureServiceInstance = null;
function getCaptureService() {
  if (!captureServiceInstance) {
    captureServiceInstance = new CaptureService({ vlmClient: getVLMClient() });
  }
  return captureServiceInstance;
}

/**
 * POST /api/capture
 * Content-Type: multipart/form-data
 * Body: image (檔案), fingerprint (字串, optional)
 */
router.post(
  '/',
  (req, res, next) => {
    // 延遲初始化 multer（讓 env 先驗證）
    try {
      const upload = createUploadMiddleware();
      upload(req, res, (err) => {
        if (err) return next(err);
        next();
      });
    } catch (err) {
      next(err);
    }
  },
  async (req, res, next) => {
    try {
      if (!req.file) {
        throw new AppError('未上傳圖片（form field "image"）', {
          code: 'NO_FILE',
          status: 400,
        });
      }

      const fingerprint = req.body.fingerprint || 'anonymous';
      logger.info('📸 收到拍照上傳', {
        size: req.file.size,
        mimetype: req.file.mimetype,
        fingerprint,
      });

      // === 步驟 1-3：Sharp 壓縮 + VLM + 三層解析 ===
      const result = await getCaptureService().processCapture({
        fileBuffer: req.file.buffer,
        mimetype: req.file.mimetype,
      });

      // === 步驟 4：寫入資料庫（僅在解析成功時）===
      if (!result.success) {
        return res.status(422).json({
          success: false,
          error: {
            code: result.errorCode || 'PARSE_FAILED',
            message: result.errorMessage || '解析失敗',
          },
          image: result.image,
          vlm: result.vlm
            ? {
                attempts: result.vlm.attempts,
                latencyMs: result.vlm.latencyMs,
              }
            : null,
        });
      }

      // 取得或建立 fingerprint
      const db = getDatabase();
      const fpRepo = new FingerprintRepository(db);
      const fpId = fpRepo.upsert(fingerprint);

      // 寫入商品
      const itemRepo = new ItemRepository(db);
      const insertResult = itemRepo.create({
        fingerprint,
        name: result.parse.name || '未知名稱',
        price: result.parse.price || 0,
        currency: result.parse.currency || 'TWD',
        imagePath: result.image?.path || null,
        vlmRawResponse: result.vlm?.content || null,
      });

      logger.info('✅ 商品已加入購物車', {
        id: insertResult.lastInsertRowid,
        name: result.parse.name,
        price: result.parse.price,
      });

      res.status(201).json({
        success: true,
        item: {
          id: insertResult.lastInsertRowid,
          name: result.parse.name,
          price: result.parse.price,
          currency: result.parse.currency || 'TWD',
          confidence: result.parse.confidence,
          parseMethod: result.parse.parseMethod,
          imagePath: result.image?.path,
        },
        vlm: {
          attempts: result.vlm.attempts,
          latencyMs: result.vlm.latencyMs,
        },
        totalLatencyMs: result.totalLatencyMs,
      });
    } catch (err) {
      // 清理已壓縮的圖片
      if (req.file && req.file.buffer) {
        // 圖片在記憶體中，無需清理
      }
      next(err);
    }
  }
);

module.exports = router;
