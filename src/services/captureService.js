// 🤖 src/services/captureService.js
// 整合 Sharp 壓縮 + VLM 辨識 + 三層 Fallback 解析
// 對應 [todo_progress.md B-04 + B-05](../../todo_progress.md)

'use strict'

const fs = require('node:fs')
const { compressImage } = require('./imageProcessor')
const { parseVLMResponse } = require('../ai/fallbackParser')
const logger = require('../utils/logger')

/**
 * 拍照處理服務
 * 封裝完整鏈路：Sharp 壓縮 → VLM 辨識 → 三層 Fallback 解析
 */
class CaptureService {
  /**
   * @param {Object} options
   * @param {import('../ai/vlmClient').VLMClient} options.vlmClient
   */
  constructor({ vlmClient }) {
    if (!vlmClient) {
      throw new Error('CaptureService 需要 vlmClient')
    }
    this.vlmClient = vlmClient
  }

  /**
   * 處理拍照結果
   * @param {Object} params
   * @param {Buffer} params.fileBuffer - 原始圖片二進位
   * @param {string} params.mimetype - 圖片 MIME 類型
   * @param {string} [params.prompt] - 自訂 VLM 提示詞
   * @returns {Promise<{
   *   success: boolean,
   *   image: { path: string, size: number, width: number, height: number },
   *   vlm: { content: string|null, attempts: number, latencyMs: number, errorCode?: string, errorMessage?: string },
   *   parse: object
   * }>}
   */
  async processCapture({ fileBuffer, mimetype, prompt }) {
    const startTime = Date.now()

    // === 步驟 1：Sharp 壓縮 ===
    logger.info('🖼️ 開始壓縮圖片', { originalSize: fileBuffer.length, mimetype })
    let compressed
    try {
      compressed = await compressImage(fileBuffer)
    } catch (err) {
      logger.error('❌ 圖片壓縮失敗', { error: err.message })
      return {
        success: false,
        image: null,
        vlm: null,
        parse: null,
        errorCode: 'COMPRESSION_FAILED',
        errorMessage: err.message,
      }
    }
    logger.info('✅ 圖片壓縮完成', {
      originalSize: fileBuffer.length,
      compressedSize: compressed.size,
      reduction: `${((1 - compressed.size / fileBuffer.length) * 100).toFixed(1)}%`,
    })

    // === 步驟 2：VLM 辨識 ===
    logger.info('🤖 開始 VLM 辨識', { model: this.vlmClient.model })
    // 從磁碟讀取壓縮後的檔案
    const compressedBuffer = fs.readFileSync(compressed.path)
    const vlmResult = await this.vlmClient.recognize(compressedBuffer, {
      mimeType: 'image/jpeg',
      prompt,
    })

    if (!vlmResult.success) {
      logger.warn('⚠️ VLM 辨識失敗', {
        errorCode: vlmResult.errorCode,
        errorMessage: vlmResult.errorMessage,
        attempts: vlmResult.attempts,
      })
      return {
        success: false,
        image: {
          path: compressed.path,
          size: compressed.size,
          width: compressed.width,
          height: compressed.height,
        },
        vlm: vlmResult,
        parse: null,
        errorCode: vlmResult.errorCode,
        errorMessage: vlmResult.errorMessage,
        totalLatencyMs: Date.now() - startTime,
      }
    }

    logger.info('✅ VLM 辨識成功', {
      attempts: vlmResult.attempts,
      latencyMs: vlmResult.latencyMs,
      contentLength: vlmResult.content.length,
    })

    // === 步驟 3：三層 Fallback 解析 ===
    logger.debug('🔍 開始 Fallback 解析')
    const parseResult = parseVLMResponse(vlmResult.content)
    logger.info('✅ 商品解析完成', {
      method: parseResult.parseMethod,
      success: parseResult.success,
      name: parseResult.name,
      price: parseResult.price,
      currency: parseResult.currency,
    })

    return {
      success: parseResult.success,
      image: {
        path: compressed.path,
        size: compressed.size,
        width: compressed.width,
        height: compressed.height,
      },
      vlm: {
        content: vlmResult.content,
        attempts: vlmResult.attempts,
        latencyMs: vlmResult.latencyMs,
      },
      parse: parseResult,
      totalLatencyMs: Date.now() - startTime,
    }
  }
}

module.exports = { CaptureService }
