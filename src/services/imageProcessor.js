// 🤖 src/services/imageProcessor.js
// Sharp 圖片壓縮服務
// 對應 [todo_progress.md B-03](../../todo_progress.md) 與 [PROJECT_CONTEXT.md §5](../../PROJECT_CONTEXT.md)

'use strict'

const path = require('node:path')
const fs = require('node:fs')
const sharp = require('sharp')
const { getEnv } = require('../config/env')
const logger = require('../utils/logger')
const { hashBuffer, shortHash } = require('../utils/hash')

/** 上傳檔案最大 10 MB（對齊 MiniMax VLM 限制） */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

/** 支援的輸入格式 */
const ALLOWED_INPUT_FORMATS = ['jpeg', 'jpg', 'png', 'webp']

/** 壓縮目標：寬邊 ≤ 1200px（fit inside，比例不變） */
const TARGET_MAX_DIMENSION = 1200

/** JPEG 品質（mozjpeg 編碼器） */
const JPEG_QUALITY = 85

/**
 * 壓縮圖片：resize + JPEG 轉換 + 儲存
 * @param {Buffer} inputBuffer - 原始圖片二進位
 * @returns {Promise<{path: string, hash: string, size: number, width: number, height: number, format: string}>}
 * @throws {Error} 當輸入無效或處理失敗
 */
async function compressImage(inputBuffer) {
  // === 步驟 1：邊界檢查 ===
  if (!Buffer.isBuffer(inputBuffer)) {
    const error = new Error('輸入必須是 Buffer')
    error.code = 'INVALID_INPUT'
    throw error
  }
  if (inputBuffer.length === 0) {
    const error = new Error('輸入 Buffer 不可為空')
    error.code = 'EMPTY_INPUT'
    throw error
  }
  if (inputBuffer.length > MAX_UPLOAD_BYTES) {
    const error = new Error(
      `檔案過大：${(inputBuffer.length / 1024 / 1024).toFixed(2)} MB > ${MAX_UPLOAD_BYTES / 1024 / 1024} MB 上限`
    )
    error.code = 'FILE_TOO_LARGE'
    throw error
  }

  // === 步驟 2：計算內容雜湊（用於檔案去重） ===
  const contentHash = hashBuffer(inputBuffer)

  // === 步驟 3：解析中繼資料（驗證格式） ===
  let metadata
  try {
    metadata = await sharp(inputBuffer).metadata()
  } catch (err) {
    const error = new Error(`圖片格式解析失敗：${err.message}`)
    error.code = 'INVALID_IMAGE_FORMAT'
    throw error
  }

  if (!metadata.format || !ALLOWED_INPUT_FORMATS.includes(metadata.format)) {
    const error = new Error(
      `不支援的格式：${metadata.format}（僅支援 ${ALLOWED_INPUT_FORMATS.join(', ')}）`
    )
    error.code = 'UNSUPPORTED_FORMAT'
    throw error
  }

  // === 步驟 4：壓縮（resize + JPEG 轉換） ===
  // 注意：不使用 .rotate()，因為前端 image-pipeline.js 已處理 EXIF 方向修正
  // 後端若再旋轉會造成重複旋轉或方向錯誤（尤其是 iPhone 直拍圖）
  let compressed
  try {
    compressed = await sharp(inputBuffer)
      .resize({
        width: TARGET_MAX_DIMENSION,
        height: TARGET_MAX_DIMENSION,
        fit: 'inside', // 比例不變，寬高都不超過上限
        withoutEnlargement: true, // 小於 1200px 的圖不放大
      })
      .jpeg({
        quality: JPEG_QUALITY,
        mozjpeg: true, // 使用 mozjpeg 編碼器，相同品質下檔案更小
        progressive: true,
      })
      .toBuffer()
  } catch (err) {
    const error = new Error(`圖片壓縮失敗：${err.message}`)
    error.code = 'COMPRESSION_FAILED'
    throw error
  }

  // === 步驟 5：儲存到磁碟 ===
  const env = getEnv()
  const uploadDir = env.UPLOAD_DIR
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true })
    logger.info('📁 已建立上傳目錄', { dir: uploadDir })
  }

  // 檔名格式：<hash 前 16 字符>-<時間戳>.jpg
  const filename = `${shortHash(contentHash)}-${Date.now()}.jpg`
  const filepath = path.join(uploadDir, filename)
  fs.writeFileSync(filepath, compressed)

  // === 步驟 6：記錄日誌與回傳結果 ===
  const reduction = ((1 - compressed.length / inputBuffer.length) * 100).toFixed(1)
  logger.info('🖼️ 圖片壓縮完成', {
    originalBytes: inputBuffer.length,
    compressedBytes: compressed.length,
    reductionPercent: `${reduction}%`,
    dimensions: `${metadata.width}x${metadata.height}`,
    path: filepath,
  })

  return {
    path: filepath,
    hash: contentHash,
    size: compressed.length,
    width: metadata.width,
    height: metadata.height,
    format: 'jpeg',
  }
}

/**
 * 取得圖片中繼資料（不壓縮）
 * @param {Buffer} inputBuffer
 * @returns {Promise<{width: number, height: number, format: string, hasExif: boolean}>}
 */
async function getMetadata(inputBuffer) {
  const metadata = await sharp(inputBuffer).metadata()
  return {
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    hasExif: Boolean(metadata.exif),
    orientation: metadata.orientation || 1,
  }
}

module.exports = {
  compressImage,
  getMetadata,
  MAX_UPLOAD_BYTES,
  ALLOWED_INPUT_FORMATS,
}
