// 🤖 src/app.js
// Express 應用工廠
// 採用「工廠函式」模式，便於測試注入與多實例（如 worker thread）

'use strict'

const express = require('express')
const path = require('node:path')

const { getEnv } = require('./config/env')
const logger = require('./utils/logger')
const { createCorsMiddleware } = require('./middleware/cors')
const { createHelmetMiddleware } = require('./middleware/helmet')
const { createRateLimitMiddleware } = require('./middleware/rateLimit')
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler')
const healthRouter = require('./routes/health')
const captureRouter = require('./routes/capture')
const itemsRouter = require('./routes/items')
const rateRouter = require('./routes/rate')
const webhookRouter = require('./routes/webhook')

/**
 * 建立 Express 應用實例
 * @param {Object} [options]
 * @param {Object} [options.env] - 環境變數（測試可注入）
 * @returns {express.Express}
 */
function createApp(options = {}) {
  const env = options.env || getEnv()
  const app = express()

  // 隱藏 Express 框架資訊（減少被探測的機會）
  app.disable('x-powered-by')

  // 設定 EJS 視圖引擎（之後 B-04 ~ B-10 可能用到）
  app.set('view engine', 'ejs')
  app.set('views', path.join(__dirname, 'views'))

  // === 請求 ID 中介層（必須在 logger 之前） ===
  app.use((req, res, next) => {
    const requestId = req.headers['x-request-id'] || generateRequestId()
    req.requestId = requestId
    res.setHeader('X-Request-Id', requestId)
    next()
  })

  // === HTTP 存取日誌 ===
  app.use((req, res, next) => {
    const start = Date.now()
    res.on('finish', () => {
      const duration = Date.now() - start
      logger.info('📥 HTTP 請求', {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: duration,
      })
    })
    next()
  })

  // === 安全中介層鏈（注意：/api/capture 的 multipart 不能被 json/urlencoded 攔截）===
  app.use(createHelmetMiddleware(env))
  app.use(createCorsMiddleware(env))
  // 暫時禁用 rate limiter 以便除錯 static file 403 問題
  // app.use(createRateLimitMiddleware(env));

  // === 請求解析 ===
  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true, limit: '1mb' }))

  // === 靜態檔案（前端） ===
  // JS/CSS 設 no-store（避免 Cloudflare Edge 快取舊版本導致 403 持續）
  // 其他靜態資源（字型、圖示）仍可長期快取
  app.use(
    express.static(path.join(__dirname, '..', 'public'), {
      maxAge: 0,
      etag: true,
      setHeaders: (res, filePath) => {
        if (/\.(js|mjs|html|css)$/i.test(filePath)) {
          // JS/CSS/HTML 不快取，確保更新立即生效
          res.setHeader('Cache-Control', 'no-store, must-revalidate')
          res.setHeader('Pragma', 'no-cache')
        } else {
          // 圖片、字型等可快取 7 天
          res.setHeader('Cache-Control', 'public, max-age=604800')
        }
      },
    })
  )

  // === 路由掛載 ===
  app.use('/', healthRouter)
  app.use('/api/capture', captureRouter)
  app.use('/api/items', itemsRouter)
  app.use('/api', rateRouter)
  app.use('/api/webhook', webhookRouter)

  // === 404 處理（必須在 errorHandler 之前） ===
  app.use(notFoundHandler)

  // === 統一錯誤處理（必須在最後一個中介層） ===
  app.use(errorHandler)

  logger.debug('🏗️ Express 應用已建立', {
    env: env.NODE_ENV,
    middleware: ['helmet', 'cors', 'rateLimit', 'json', 'static', 'errorHandler'],
  })

  return app
}

/**
 * 產生請求 ID（8 碼 base36 隨機字串）
 * @returns {string}
 */
function generateRequestId() {
  return Math.random().toString(36).slice(2, 10)
}

module.exports = { createApp }
