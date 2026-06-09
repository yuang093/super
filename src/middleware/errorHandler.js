// 🤖 src/middleware/errorHandler.js
// 統一錯誤處理中介層
// 區分 OperationalError（可預期）vs ProgrammingError（程式錯誤）
// 統一回應結構：{error: {code, message, requestId, details?}}

'use strict'

const logger = require('../utils/logger')
const { getEnv } = require('../config/env')

/**
 * 應用層級錯誤類別
 * 用於路由處理器主動拋出帶有結構化資訊的錯誤
 */
class AppError extends Error {
  /**
   * @param {string} message
   * @param {Object} options
   * @param {string} options.code - 機器可讀的錯誤代碼
   * @param {number} options.status - HTTP 狀態碼
   * @param {Object} [options.details] - 補充資訊
   * @param {boolean} [options.isOperational=true] - 是否為可預期錯誤
   */
  constructor(message, { code, status, details, isOperational = true } = {}) {
    super(message)
    this.name = 'AppError'
    this.code = code || 'INTERNAL_ERROR'
    this.status = status || 500
    this.details = details
    this.isOperational = isOperational
    Error.captureStackTrace(this, this.constructor)
  }
}

/**
 * 404 處理中介層
 * 必須在 errorHandler 之前掛載
 */
function notFoundHandler(req, res, next) {
  next(
    new AppError(`路徑不存在：${req.method} ${req.path}`, {
      code: 'NOT_FOUND',
      status: 404,
    })
  )
}

/**
 * 統一錯誤處理中介層
 * 必須有 4 個參數，Express 才會識別為錯誤處理器
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const env = (() => {
    try {
      return getEnv()
    } catch {
      return { NODE_ENV: 'development' }
    }
  })()

  // 判斷錯誤類型
  const isAppError = err instanceof AppError
  const isCorsError = err.message && err.message.startsWith('CORS 政策不允許')

  let status, code, message, details

  if (isAppError) {
    status = err.status
    code = err.code
    message = err.message
    details = err.details
  } else if (isCorsError) {
    status = 403
    code = 'CORS_BLOCKED'
    message = err.message
  } else if (err.name === 'ZodError') {
    status = 400
    code = 'VALIDATION_ERROR'
    message = '請求參數驗證失敗'
    details = { issues: err.issues }
  } else if (err.type === 'entity.too.large') {
    status = 413
    code = 'PAYLOAD_TOO_LARGE'
    message = '請求主體超過大小限制'
  } else if (err.type === 'entity.parse.failed') {
    status = 400
    code = 'INVALID_JSON'
    message = '請求主體 JSON 格式錯誤'
  } else {
    // 程式錯誤（不可預期）
    status = 500
    code = 'INTERNAL_ERROR'
    message = '伺服器內部錯誤'
  }

  // 記錄日誌
  const logPayload = {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    status,
    code,
    error: err.message,
  }

  if (isAppError && err.isOperational) {
    // 可預期的錯誤：warn 等級即可
    logger.warn('⚠️ 應用層級錯誤', logPayload)
  } else {
    // 程式錯誤：error 等級並記錄 stack
    logger.error('💥 未預期錯誤', { ...logPayload, stack: err.stack })
  }

  // 回應結構
  const responseBody = {
    error: {
      code,
      message,
      requestId: req.requestId,
      ...(details && { details }),
    },
  }

  // 開發環境額外暴露 stack（生產環境絕不暴露）
  if (env.NODE_ENV !== 'production' && !isAppError) {
    responseBody.error.stack = err.stack
  }

  res.status(status).json(responseBody)
}

module.exports = {
  AppError,
  notFoundHandler,
  errorHandler,
}
