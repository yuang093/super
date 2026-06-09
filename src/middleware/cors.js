// 🤖 src/middleware/cors.js
// CORS 設定工廠
// 依環境變數動態設定允許的 origin，避免硬編碼

'use strict';

const cors = require('cors');
const logger = require('../utils/logger');

/**
 * 建立 CORS 中介層
 * @param {Object} env - 環境變數物件
 * @returns {express.RequestHandler}
 */
function createCorsMiddleware(env) {
  // 解析允許的 origin 清單（以逗號分隔）
  // 預設僅允許 localhost 三種埠號（開發友善）
  const defaultOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
  ];

  const allowedOrigins = env.CORS_ORIGINS
    ? env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
    : defaultOrigins;

  logger.debug('🌐 CORS 設定', { allowedOrigins });

  return cors({
    origin: (origin, callback) => {
      // 允許無 origin 的請求（Server-to-Server、curl、Postman）
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        callback(null, true);
      } else {
        logger.warn('🚫 CORS 拒絕來源', { origin });
        callback(new Error(`CORS 政策不允許來源：${origin}`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 86400, // 24 小時
  });
}

module.exports = { createCorsMiddleware };
