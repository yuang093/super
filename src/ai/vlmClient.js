// 🤖 src/ai/vlmClient.js
// MiniMax VLM（視覺語言模型）API 串接
// 對應 [todo_progress.md B-04](../../todo_progress.md) 與 [TESTING_PLAN.md §3.1](../../TESTING_PLAN.md)

'use strict'

const { getEnv } = require('../config/env')
const logger = require('../utils/logger')
const { PRODUCT_RECOGNITION_PROMPT } = require('./prompts')

/**
 * VLM 錯誤碼常數
 */
const ERROR_CODES = Object.freeze({
  VLM_TIMEOUT: 'VLM_TIMEOUT',
  VLM_RATE_LIMIT: 'VLM_RATE_LIMIT',
  VLM_INVALID_RESPONSE: 'VLM_INVALID_RESPONSE',
  VLM_AUTH_ERROR: 'VLM_AUTH_ERROR',
  VLM_SERVER_ERROR: 'VLM_SERVER_ERROR',
  VLM_NETWORK_ERROR: 'VLM_NETWORK_ERROR',
  VLM_BAD_REQUEST: 'VLM_BAD_REQUEST',
})

/**
 * VLM 結果的統一格式
 * @typedef {Object} VLMResult
 * @property {boolean} success
 * @property {string|null} content - VLM 回傳的 content 欄位（用於 fallbackParser 解析）
 * @property {Object|null} raw - 完整原始回應
 * @property {string|null} errorCode
 * @property {string|null} errorMessage
 * @property {number} attempts - 實際嘗試次數
 * @property {number} latencyMs - 總耗時
 */

/**
 * MiniMax VLM API 客戶端
 * 支援 Exponential Backoff 重試、逾時保護、結構化錯誤碼
 */
class VLMClient {
  /**
   * @param {Object} [options] - 測試可注入 mock
   * @param {string} [options.apiKey] - VLM API Key
   * @param {string} [options.endpoint] - API endpoint
   * @param {string} [options.model] - 模型名稱
   * @param {number} [options.timeoutMs=30000] - 單次請求逾時
   * @param {number} [options.maxRetries=2] - 最大重試次數（不含首次）
   * @param {number} [options.retryBaseMs=1000] - 重試基礎延遲（指數退避）
   * @param {Function} [options.fetch] - 自訂 fetch 函式（測試用）
   * @param {Function} [options.sleep] - 自訂 sleep 函式（測試用）
   */
  constructor(options = {}) {
    let env
    try {
      env = getEnv()
    } catch (_) {
      // 允許在測試或特殊情況下不初始化 env
      env = {}
    }

    this.apiKey = options.apiKey || env.VLM_API_KEY
    this.endpoint = options.endpoint || env.VLM_API_ENDPOINT
    this.model = options.model || env.VLM_MODEL
    this.timeoutMs = options.timeoutMs ?? (env.VLM_TIMEOUT_MS || 30000)
    this.maxRetries = options.maxRetries ?? env.VLM_MAX_RETRIES ?? 2
    this.retryBaseMs = options.retryBaseMs ?? 1000
    this._fetch = options.fetch || ((...args) => fetch(...args))
    this._sleep = options.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)))
  }

  /**
   * 辨識圖片中的商品
   * @param {Buffer} imageBuffer - 圖片二進位（已通過 sharp 壓縮）
   * @param {Object} [options]
   * @param {string} [options.prompt] - 自訂提示詞（預設使用 PRODUCT_RECOGNITION_PROMPT）
   * @param {string} [options.mimeType='image/jpeg'] - 圖片 MIME 類型
   * @returns {Promise<VLMResult>}
   */
  async recognize(imageBuffer, options = {}) {
    if (!Buffer.isBuffer(imageBuffer)) {
      return {
        success: false,
        content: null,
        raw: null,
        errorCode: ERROR_CODES.VLM_BAD_REQUEST,
        errorMessage: 'imageBuffer 必須是 Buffer',
        attempts: 0,
        latencyMs: 0,
      }
    }

    const startTime = Date.now()
    const prompt = options.prompt || PRODUCT_RECOGNITION_PROMPT
    const mimeType = options.mimeType || 'image/jpeg'
    const dataUrl = `data:${mimeType};base64,${imageBuffer.toString('base64')}`

    const requestBody = {
      model: this.model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
    }

    let lastError = null
    const totalAttempts = this.maxRetries + 1

    for (let attempt = 1; attempt <= totalAttempts; attempt++) {
      try {
        const response = await this.callVLMOnce(requestBody)

        // 成功：2xx + content 存在
        if (response.ok && typeof response.content === 'string' && response.content.length > 0) {
          logger.info('✅ VLM 辨識成功', {
            attempt,
            latencyMs: Date.now() - startTime,
            contentLength: response.content.length,
          })
          return {
            success: true,
            content: response.content,
            raw: response.raw,
            errorCode: null,
            errorMessage: null,
            attempts: attempt,
            latencyMs: Date.now() - startTime,
          }
        }

        // 失敗：記錄錯誤碼
        const errorCode = this.statusToErrorCode(response.status)
        lastError = { errorCode, status: response.status, message: response.statusText }

        // 4xx 客戶端錯誤：不重試
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          logger.warn('⚠️ VLM 4xx 錯誤，不重試', {
            attempt,
            status: response.status,
            statusText: response.statusText,
          })
          return {
            success: false,
            content: null,
            raw: response.raw,
            errorCode,
            errorMessage: response.statusText || `HTTP ${response.status}`,
            attempts: attempt,
            latencyMs: Date.now() - startTime,
          }
        }

        // 429 Rate Limit 或 5xx 伺服器錯誤：可重試
        if (attempt < totalAttempts) {
          const backoff = this.backoffMs(attempt)
          logger.warn(`🔄 VLM 錯誤重試 ${attempt}/${this.maxRetries}`, {
            status: response.status,
            backoffMs: backoff,
          })
          await this._sleep(backoff)
          continue
        }

        // 達到最大重試次數
        logger.error('❌ VLM 所有重試皆失敗', {
          attempts: attempt,
          status: response.status,
          statusText: response.statusText,
        })
        return {
          success: false,
          content: null,
          raw: response.raw,
          errorCode,
          errorMessage: response.statusText || `HTTP ${response.status}`,
          attempts: attempt,
          latencyMs: Date.now() - startTime,
        }
      } catch (err) {
        lastError = { errorCode: this.exceptionToErrorCode(err), message: err.message }

        // 逾時（AbortError）或網路錯誤：可重試
        const isRetryable =
          err.name === 'AbortError' ||
          err.code === 'ETIMEDOUT' ||
          err.code === 'ECONNREFUSED' ||
          err.code === 'ENOTFOUND' ||
          err.code === 'ECONNRESET' ||
          err.type === 'system'

        if (isRetryable && attempt < totalAttempts) {
          const backoff = this.backoffMs(attempt)
          logger.warn(`🔄 VLM ${err.name || err.code} 重試 ${attempt}/${this.maxRetries}`, {
            backoffMs: backoff,
            error: err.message,
          })
          await this._sleep(backoff)
          continue
        }

        // 不可重試或達最大次數
        logger.error('❌ VLM 不可重試錯誤', {
          attempt,
          error: err.message,
          name: err.name,
          code: err.code,
        })
        return {
          success: false,
          content: null,
          raw: null,
          errorCode: lastError.errorCode,
          errorMessage: err.message,
          attempts: attempt,
          latencyMs: Date.now() - startTime,
        }
      }
    }

    // 理論上不會到這裡，但保險起見
    return {
      success: false,
      content: null,
      raw: null,
      errorCode: lastError?.errorCode || ERROR_CODES.VLM_SERVER_ERROR,
      errorMessage: lastError?.message || '未知錯誤',
      attempts: totalAttempts,
      latencyMs: Date.now() - startTime,
    }
  }

  /**
   * 單次呼叫 VLM API（含逾時控制）
   * @private
   * @returns {Promise<{ok: boolean, status: number, statusText: string, content: string|null, raw: object|null}>}
   */
  async callVLMOnce(requestBody) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const response = await this._fetch(this.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      })

      // 嘗試解析 JSON（即使失敗也不拋出，因為某些 5xx 回應可能不是 JSON）
      let raw = null
      try {
        raw = await response.json()
      } catch (_) {
        raw = null
      }

      // 提取 content
      const content = raw?.choices?.[0]?.message?.content
      const contentStr = typeof content === 'string' ? content : null

      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        content: contentStr,
        raw,
      }
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * 指數退避：attempt 1 → 1s, attempt 2 → 2s, attempt 3 → 4s
   * @private
   */
  backoffMs(attempt) {
    return this.retryBaseMs * Math.pow(2, attempt - 1)
  }

  /**
   * 將 HTTP 狀態碼映射到錯誤碼
   * @private
   */
  statusToErrorCode(status) {
    if (status === 401 || status === 403) return ERROR_CODES.VLM_AUTH_ERROR
    if (status === 408) return ERROR_CODES.VLM_TIMEOUT
    if (status === 429) return ERROR_CODES.VLM_RATE_LIMIT
    if (status >= 400 && status < 500) return ERROR_CODES.VLM_INVALID_RESPONSE
    if (status >= 500) return ERROR_CODES.VLM_SERVER_ERROR
    return ERROR_CODES.VLM_INVALID_RESPONSE
  }

  /**
   * 將例外映射到錯誤碼
   * @private
   */
  exceptionToErrorCode(err) {
    if (err.name === 'AbortError') return ERROR_CODES.VLM_TIMEOUT
    if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') return ERROR_CODES.VLM_TIMEOUT
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ECONNRESET') {
      return ERROR_CODES.VLM_NETWORK_ERROR
    }
    return ERROR_CODES.VLM_NETWORK_ERROR
  }
}

module.exports = {
  VLMClient,
  ERROR_CODES,
}
