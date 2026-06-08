// 🤖 src/middleware/helmet.js
// Helmet 安全標頭設定工廠
// 預設開啟所有保護，必要時可依環境變數放寬 CSP

'use strict';

const helmet = require('helmet');
const logger = require('../utils/logger');

/**
 * 建立 Helmet 中介層
 * @param {Object} env - 環境變數物件
 * @returns {express.RequestHandler}
 */
function createHelmetMiddleware(env) {
  const isProduction = env.NODE_ENV === 'production';

  logger.debug('🛡️ Helmet 安全標頭設定', { isProduction });

  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: isProduction
          ? ["'self'", 'https://cdn.jsdelivr.net']  // 生產環境：允許 TF.js CDN
          : ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://cdn.jsdelivr.net'],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: [
          "'self'",
          'https://api.minimax.io',
          'https://api.exchangerate-api.com',
          'https://cdn.jsdelivr.net',            // TF.js scripts
          'https://tfhub.dev',                    // TF.js 模型 JSON
          'https://storage.googleapis.com',        // TF.js 模型權重
        ],
        fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false, // 與 TF.js 共享記憶體相容
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });
}

module.exports = { createHelmetMiddleware };
