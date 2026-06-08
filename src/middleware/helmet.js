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
          ? ["'self'"]  // 生產環境禁止 inline script
          : ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // 開發環境允許（Vite HMR、TF.js）
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: [
          "'self'",
          'https://api.minimax.io',
          'https://api.exchangerate-api.com',
        ],
        fontSrc: ["'self'", 'data:'],
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
