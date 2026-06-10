// 🤖 public/js/image-pipeline.js
// 影像處理管線：EXIF 方向修正 + Canvas 三段式壓縮
// 對應 [todo_progress.md F-04 + F-05]
// F-04：三段式壓縮 quality=0.8→0.5，目標 < 500KB
// F-05：EXIF 0x0112 方向解析（支援 8 種方向）

'use strict'

/**
 * 從 JPEG ArrayBuffer擷取 EXIF Orientation 值（0x0112）
 * @param {ArrayBuffer} buffer - JPEG 檔案的二進位資料
 * @returns {number} - Orientation 值，預設 1（正常方向）
 */
function getExifOrientation(buffer) {
  try {
    const view = new DataView(buffer)
    //確認 JPEG SOI marker：0xFF0xD8
    if (view.getUint16(0) !== 0xffd8) {
      return 1
    }
    const length = view.byteLength
    let offset = 2

    while (offset < length) {
      // 讀取 marker
      if (view.getUint8(offset) !== 0xff) {
        offset++
        continue
      }
      const marker = view.getUint8(offset + 1)

      // APP1 (EXIF) marker：0xE1
      if (marker === 0xe1) {
        const segmentLength = view.getUint16(offset + 2)
        // 確認 "Exif\0\0" 字串
        const exifHeader = String.fromCharCode(
          view.getUint8(offset + 4),
          view.getUint8(offset + 5),
          view.getUint8(offset + 6),
          view.getUint8(offset + 7),
          view.getUint8(offset + 8),
          view.getUint8(offset + 9)
        )
        if (exifHeader !== 'Exif\x00\x00') {
          return 1
        }
        // TIFF header起始位置（offset + 10 是 "Exif\0\0" 後的第一個 byte）
        const tiffStart = offset + 10
        // Byte order：II = little-endian，MM = big-endian
        // 注意：getUint16 第二個參數預設為 false（big-endian），所以 MM 會讀成 0x4D4D
        const byteOrder = view.getUint16(tiffStart, false)
        const littleEndian = byteOrder === 0x4949 // 'II'

        // IFD0偏移量
        const ifd0Offset = view.getUint32(tiffStart + 4, littleEndian)
        const ifd0Start = tiffStart + ifd0Offset

        //讀取 IFD0項目數量
        const entryCount = view.getUint16(ifd0Start, littleEndian)

        // 搜尋 Orientation tag (0x0112 = 274)
        for (let i = 0; i < entryCount; i++) {
          const entryOffset = ifd0Start + 2 + i * 12
          const tag = view.getUint16(entryOffset, littleEndian)
          if (tag === 0x0112) {
            // Orientation 是 SHORT 型別（3）
            const type = view.getUint16(entryOffset + 2, littleEndian)
            if (type === 3) {
              const orientation = view.getUint16(entryOffset + 8, littleEndian)
              return orientation >= 1 && orientation <= 8 ? orientation : 1
            }
            return 1
          }
        }
        return 1
      }

      // 跳過其他 segments
      if (marker === 0xd9 || marker === 0xda) {
        // SOS (Start of Scan) 或 EOI (End of Image)：掃描結束
        break
      }
      const segmentLength = view.getUint16(offset + 2)
      offset += 2 + segmentLength
    }
    return 1
  } catch (err) {
    // EXIF 讀取失敗，預設為正常方向
    console.warn('[ImagePipeline] EXIF 讀取失敗，使用預設方向', err.message)
    return 1
  }
}

/**
 * 根據 Orientation套用方向修正並繪製到 Canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D 上下文
 * @param {HTMLImageElement} img - 原始圖片
 * @param {number} orientation - EXIF Orientation 值
 * @param {number} canvasWidth - 目標 Canvas 寬度
 * @param {number} canvasHeight - 目標 Canvas 高度
 */
/**
 * 根據 Orientation套用方向修正並繪製到 Canvas
 * 使用卡路里專案的「translate角落→旋轉→繪製」方式
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D 上下文
 * @param {HTMLImageElement} img - 原始圖片
 * @param {number} orientation - EXIF Orientation 值
 * @param {number} canvasWidth - 目標 Canvas 寬度（已交換）
 * @param {number} canvasHeight - 目標 Canvas 高度（已交換）
 */
/**
 * 根據 Orientation 繪製到 Canvas
 * 現代手機瀏覽器會自動根據 EXIF 轉正，只需直接繪製
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D 上下文
 * @param {HTMLImageElement} img - 原始圖片
 * @param {number} orientation - EXIF Orientation 值（已廢棄）
 * @param {number} canvasWidth - 目標 Canvas 寬度
 * @param {number} canvasHeight - 目標 Canvas 高度
 */
function applyOrientation(ctx, img, orientation, canvasWidth, canvasHeight) {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight)
  ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight)
}

/**
 * 估算 JPEG 位元組數量（不實際編碼）
 * @param {HTMLCanvasElement} canvas
 * @param {number} quality -品質0~1
 * @returns {number} - 預估位元組數
 */
/**
 * 三段式 Canvas 壓縮
 * Stage 1：quality=0.8，maxWidth=1600
 * Stage 2：quality=0.5，target < 300KB
 *
 * @param {HTMLImageElement} img - 原始圖片元素
 * @param {number} orientation - EXIF Orientation 值
 * @param {Object} [options]
 * @param {number} [options.maxWidth=1600] - 第一階段最大寬度
 * @param {number} [options.quality1=0.8] - 第一階段品質
 * @param {number} [options.quality2=0.5] - 第二階段品質
 * @param {number} [options.targetBytes=300*1024] - 目標位元組數
 * @returns {Promise<{base64: string, width: number, height: number, bytes: number}>}
 */
export async function compressImage(img, orientation, options = {}) {
  const { maxWidth = 1600, quality1 = 0.8, quality2 = 0.5, targetBytes = 300 * 1024 } = options

  // 計算縮放後尺寸（保持比例，不超過 maxWidth）
  let drawWidth = img.width
  let drawHeight = img.height
  if (drawWidth > maxWidth) {
    const ratio = maxWidth / drawWidth
    drawWidth = maxWidth
    drawHeight = Math.round(drawHeight * ratio)
  }

  const canvasWidth = drawWidth
  const canvasHeight = drawHeight

  // 建立共享 Canvas（避免重複繪製）
  const canvas = document.createElement('canvas')
  canvas.width = canvasWidth
  canvas.height = canvasHeight
  const ctx = canvas.getContext('2d')
  applyOrientation(ctx, img, orientation, canvasWidth, canvasHeight)

  // Stage 1：quality=0.8
  let base64 = canvas.toDataURL('image/jpeg', quality1)
  let currentBytes = Math.round((base64.length - 1) * 0.75)

  // Stage 2：quality=0.5（如果超過目標大小）
  if (currentBytes > targetBytes) {
    base64 = canvas.toDataURL('image/jpeg', quality2)
    currentBytes = Math.round((base64.length - 1) * 0.75)
  }

  // Stage 3：額外降低品質（如果仍然超過目標）
  // 逐步遞減 quality 直到低於 targetBytes（共享 canvas，僅改 quality）
  let quality = quality2
  while (currentBytes > targetBytes && quality > 0.1) {
    quality -= 0.1
    base64 = canvas.toDataURL('image/jpeg', quality)
    currentBytes = Math.round((base64.length - 1) * 0.75)
  }

  return {
    base64,
    width: canvasWidth,
    height: canvasHeight,
    bytes: currentBytes,
  }
}

/**
 * 從 Blob 或 File 讀取圖片並執行完整管線
 * @param {Blob} blob - 圖片 Blob 或 File
 * @param {Object} [options] - 壓縮選項
 * @returns {Promise<{base64: string, width: number, height: number, bytes: number, orientation: number}>}
 */
export async function processImageBlob(blob, options = {}) {
  // 建立 Image元素
  const img = await new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(blob)
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('圖片載入失敗'))
    }
    img.src = url
  })

  // 讀取 ArrayBuffer 以取出 EXIF Orientation
  const arrayBuffer = await blob.arrayBuffer()
  const orientation = getExifOrientation(arrayBuffer)

  // 執行壓縮
  const result = await compressImage(img, orientation, options)
  return { ...result, orientation }
}

/**
 * 從 Base64 字串重建圖片並重新壓縮（用於上傳前最後確認）
 * @param {string} base64 - Data URL 字串
 * @param {Object} [options] - 壓縮選項
 * @returns {Promise<{base64: string, width: number, height: number, bytes: number}>}
 */
