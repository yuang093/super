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
    // 在 development 模式下禁用 CSP（方便除錯），production 使用嚴格 CSP
    contentSecurityPolicy: isProduction
      ? {
          useDefaults: false,
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
            scriptSrcElem: ["'self'", 'https://cdn.jsdelivr.net'],
            scriptSrcAttr: ["'none'"],
            styleSrc: ["'self'", 'https://fonts.googleapis.com'],
            styleSrcElem: ["'self'", 'https://fonts.googleapis.com'],
            imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
            connectSrc: ["'self'", 'https://api.minimax.io', 'https://api.exchangerate-api.com', 'https://cdn.jsdelivr.net', 'https://tfhub.dev', 'https://storage.googleapis.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            upgradeInsecureRequests: [],
          },
        }
      : false, // development: 禁用 CSP
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: isProduction ? { policy: 'same-origin' } : false,
    crossOriginResourcePolicy: false, // 禁用 CORP，讓瀏覽器自行決定
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });
}

module.exports = { createHelmetMiddleware };
