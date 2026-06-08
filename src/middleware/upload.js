// 🤖 src/middleware/upload.js
// multer 設定：檔案大小限制、MIME 驗證
// 對應 [todo_progress.md B-04](../../todo_progress.md)

'use strict';

const multer = require('multer');
const { getEnv } = require('../config/env');
const { AppError } = require('./errorHandler');
const logger = require('../utils/logger');

/** 允許的 MIME 類型（對應 Sharp 支援的格式）*/
const ALLOWED_MIME_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp']);

/**
 * 建立 multer 上傳中介層（單檔）
 * @param {Object} [options]
 * @param {string} [options.fieldName='image'] - 表單欄位名
 * @param {number} [options.maxSizeMB] - 最大檔案大小（MB），預設從 .env 讀取
 * @returns {Function} multer middleware
 */
function createUploadMiddleware(options = {}) {
  const env = options.env || (() => {
    try {
      return getEnv();
    } catch (_) {
      return {};
    }
  })();
  const maxSize = (options.maxSizeMB || env.MAX_UPLOAD_SIZE_MB || 10) * 1024 * 1024;
  const fieldName = options.fieldName || 'image';

  const storage = multer.memoryStorage();

  return multer({
    storage,
    limits: { fileSize: maxSize, files: 1 },
    fileFilter: (req, file, cb) => {
      if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        logger.warn('⚠️ 不支援的 MIME 類型', { mimetype: file.mimetype, allowed: ALLOWED_MIME_TYPES });
        const err = new AppError(
          `不支援的檔案類型：${file.mimetype}（僅支援 ${ALLOWED_MIME_TYPES.join(', ')}）`,
          { code: 'UNSUPPORTED_MIME', status: 415 }
        );
        return cb(err);
      }
      cb(null, true);
    },
  })[fieldName];
}

module.exports = {
  createUploadMiddleware,
  ALLOWED_MIME_TYPES,
};
