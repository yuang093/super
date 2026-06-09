// 🤖 src/services/uploadService.js
// 上傳流程編排：MIME 驗證 → 暫存 → 壓縮 → 清理
// 對應 [todo_progress.md B-03](../../todo_progress.md)

'use strict'

const fs = require('node:fs')
const { compressImage, ALLOWED_INPUT_FORMATS } = require('./imageProcessor')
const logger = require('../utils/logger')

/** 允許的 MIME 類型 */
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/**
 * 處理上傳檔案：MIME 驗證 → 讀取 → 壓縮 → 清理暫存
 * @param {string} filePath - multer 暫存的檔案路徑
 * @param {string} mimetype - 上傳檔案的 MIME 類型
 * @returns {Promise<{path: string, hash: string, size: number, width: number, height: number, format: string}>}
 * @throws {Error} 當 MIME 不支援或處理失敗
 */
async function processUpload(filePath, mimetype) {
  // === 步驟 1：MIME 驗證 ===
  if (!ALLOWED_MIME_TYPES.includes(mimetype)) {
    cleanupFile(filePath)
    const error = new Error(
      `不支援的 MIME 類型：${mimetype}（僅支援 ${ALLOWED_MIME_TYPES.join(', ')}）`
    )
    error.code = 'UNSUPPORTED_MIME'
    throw error
  }

  // === 步驟 2：驗證檔案存在 ===
  if (!fs.existsSync(filePath)) {
    const error = new Error(`上傳檔案不存在：${filePath}`)
    error.code = 'FILE_NOT_FOUND'
    throw error
  }

  // === 步驟 3：讀取並壓縮 ===
  let buffer
  try {
    buffer = fs.readFileSync(filePath)
  } catch (err) {
    cleanupFile(filePath)
    const error = new Error(`讀取上傳檔案失敗：${err.message}`)
    error.code = 'FILE_READ_FAILED'
    throw error
  }

  try {
    const result = await compressImage(buffer)
    // 壓縮成功後，刪除 multer 的暫存檔（壓縮結果已存到正式位置）
    cleanupFile(filePath)
    return result
  } catch (err) {
    // 壓縮失敗時也要清理
    cleanupFile(filePath)
    logger.error('❌ 上傳處理失敗', { error: err.message, filePath })
    throw err
  }
}

/**
 * 清理暫存檔（失敗時靜默，錯誤僅記錄）
 * @param {string} filePath
 */
function cleanupFile(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  } catch (err) {
    logger.warn('⚠️ 清理暫存檔失敗', { filePath, error: err.message })
  }
}

module.exports = {
  processUpload,
  ALLOWED_MIME_TYPES,
  ALLOWED_INPUT_FORMATS,
}
