// 🤖 src/middleware/rateLimit.js
// 速率限制中介層
// 依 IP 限制請求頻率，防止暴力攻擊與 API 濫用
// B-06 將實作「雙層 Rate Limit」（IP 層 + 使用者指紋層）

'use strict'

const rateLimit = require('express-rate-limit')
const logger = require('../utils/logger')

/**
 * 建立 Rate Limit 中介層
 * @param {Object} env - 環境變數物件
 * @returns {express.RequestHandler}
 */
function createRateLimitMiddleware(env) {
  const windowMs = 60 * 1000 // 1 分鐘
  const max = env.RATE_LIMIT_PER_MIN

  logger.debug('⏱️ Rate Limit 設定', { max, windowMs })

  return rateLimit({
    windowMs,
    max,
    standardHeaders: 'draft-7', // RateLimit-* 標準標頭
    legacyHeaders: false,
    // 取得客戶端 IP（相容反向代理）
    keyGenerator: (req) => {
      return req.ip || req.socket.remoteAddress || 'unknown'
    },
    // 觸發上限時的回應
    handler: (req, res) => {
      logger.warn('🚫 Rate Limit 觸發', {
        requestId: req.requestId,
        ip: req.ip,
        path: req.path,
      })
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: '請求過於頻繁，請稍後再試',
          requestId: req.requestId,
          retryAfter: Math.ceil(windowMs / 1000),
        },
      })
    },
    // 跳過健康檢查（避免監控被擋）
    skip: (req) => req.path === '/healthz',
  })
}

module.exports = { createRateLimitMiddleware }
