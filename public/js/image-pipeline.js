// 🤖 public/js/image-pipeline.js
// 影像處理管線：EXIF 方向修正 + Canvas 三段式壓縮
// 對應 [todo_progress.md F-04 + F-05]
// F-04：三段式壓縮 quality=0.8→0.5，目標 < 500KB
// F-05：EXIF 0x0112 方向解析（支援 8 種方向）

'use strict'

/**
 * EXIF Orientation 對應的旋轉矩陣參數
 * Orientation1：正常（不旋轉）
 * Orientation 2：水平翻轉
 * Orientation 3：旋轉 180°
 * Orientation 4：垂直翻轉
 * Orientation 5：水平翻轉 + 旋轉 90°
 * Orientation 6：旋轉 90°（iPhone 直立常見，俗稱"向左轉"）
 * Orientation 7：水平翻轉 + 旋轉 270°
 * Orientation 8：旋轉 270°
 */
const ORIENTATION_MATRIX = {
  1: { rotate: 0, flipX: false, flipY: false },
  2: { rotate: 0, flipX: true, flipY: false },
  3: { rotate: 180, flipX: false, flipY: false },
  4: { rotate: 0, flipX: false, flipY: true },
  5: { rotate: 90, flipX: true, flipY: false },
  6: { rotate: 90, flipX: false, flipY: false }, // iPhone 直立
  7: { rotate: 270, flipX: true, flipY: false },
  8: { rotate: 270, flipX: false, flipY: false },
}

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
        const byteOrder = view.getUint16(tiffStart)
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
function applyOrientation(ctx, img, orientation, canvasWidth, canvasHeight) {
  const matrix = ORIENTATION_MATRIX[orientation] || ORIENTATION_MATRIX[1]
  const needsSwap = [5, 6, 7, 8].includes(orientation)

  console.log('[applyOrientation]', { orientation, canvasWidth, canvasHeight, needsSwap, imgW: img.width, imgH: img.height })

  ctx.clearRect(0, 0, canvasWidth, canvasHeight)
  ctx.save()

  // 將 Canvas 中心移動到原點
  ctx.translate(canvasWidth / 2, canvasHeight / 2)

  // 套用翻轉（X軸翻轉）
  if (matrix.flipX) {
    ctx.scale(-1, 1)
  }
  // 套用翻轉（Y軸翻轉）
  if (matrix.flipY) {
    ctx.scale(1, -1)
  }

  // 套用旋轉（弧度）
  if (matrix.rotate !== 0) {
    ctx.rotate((matrix.rotate * Math.PI) / 180)
  }

  // 計算 scale
  const targetW = needsSwap ? canvasHeight : canvasWidth
  const targetH = needsSwap ? canvasWidth : canvasHeight
  const scaleX = targetW / img.width
  const scaleY = targetH / img.height
  const scale = Math.min(scaleX, scaleY)
  const scaledW = img.width * scale
  const scaledH = img.height * scale

  console.log('[applyOrientation] scale:', { targetW, targetH, scaleX, scaleY, scale, scaledW, scaledH })

  // 圖片中心對齊 Canvas 中心
  ctx.drawImage(img, -scaledW / 2, -scaledH / 2, scaledW, scaledH)

  ctx.restore()
}

/**
 * 估算 JPEG 位元組數量（不實際編碼）
 * @param {HTMLCanvasElement} canvas
 * @param {number} quality -品質0~1
 * @returns {number} - 預估位元組數
 */
function estimateJpegSize(canvas, quality) {
  //粗估：每像素0.5~1.5 位元組（視品質而定）
  const pixelCount = canvas.width * canvas.height
  const bytesPerPixel = quality > 0.7 ? 1.2 : quality > 0.4 ? 0.8 : 0.5
  return Math.round(pixelCount * bytesPerPixel)
}

/**
 * 三段式 Canvas 壓縮
 * Stage 1：quality=0.8，maxWidth=1600
 * Stage 2：quality=0.5，target < 500KB
 *
 * @param {HTMLImageElement} img - 原始圖片元素
 * @param {number} orientation - EXIF Orientation 值
 * @param {Object} [options]
 * @param {number} [options.maxWidth=1600] - 第一階段最大寬度
 * @param {number} [options.quality1=0.8] - 第一階段品質
 * @param {number} [options.quality2=0.5] - 第二階段品質
 * @param {number} [options.targetBytes=500*1024] - 目標位元組數
 * @returns {Promise<{base64: string, width: number, height: number, bytes: number}>}
 */
export async function compressImage(img, orientation, options = {}) {
  const { maxWidth = 1600, quality1 = 0.8, quality2 = 0.5, targetBytes = 500 * 1024 } = options

  // 計算縮放後尺寸（保持比例，不超過 maxWidth）
  let drawWidth = img.width
  let drawHeight = img.height
  if (drawWidth > maxWidth) {
    const ratio = maxWidth / drawWidth
    drawWidth = maxWidth
    drawHeight = Math.round(drawHeight * ratio)
  }

  // 判斷是否需要旋轉（90° 或 270° 需要寬高交換）
  const needsSwap = [5, 6, 7, 8].includes(orientation)
  const canvasWidth = needsSwap ? drawHeight : drawWidth
  const canvasHeight = needsSwap ? drawWidth : drawHeight

  console.log('[ImagePipeline] compressImage', {
    imgNatural: `${img.width}x${img.height}`,
    drawSize: `${drawWidth}x${drawHeight}`,
    canvasSize: `${canvasWidth}x${canvasHeight}`,
    needsSwap,
    orientation,
  })

  // 建立 Stage 1 Canvas
  const canvas1 = document.createElement('canvas')
  canvas1.width = canvasWidth
  canvas1.height = canvasHeight
  const ctx1 = canvas1.getContext('2d')

  applyOrientation(ctx1, img, orientation, canvasWidth, canvasHeight)

  // Stage 1：quality=0.8
  let base64 = canvas1.toDataURL('image/jpeg', quality1)
  let currentBytes = Math.round((base64.length - 1) * 0.75) // base64 → bytes估算

  // Stage 2：quality=0.5（如果超過目標大小）
  if (currentBytes > targetBytes) {
    const canvas2 = document.createElement('canvas')
    canvas2.width = canvasWidth
    canvas2.height = canvasHeight
    const ctx2 = canvas2.getContext('2d')
    applyOrientation(ctx2, img, orientation, canvasWidth, canvasHeight)
    base64 = canvas2.toDataURL('image/jpeg', quality2)
    currentBytes = Math.round((base64.length - 1) * 0.75)
  }

  // Stage 3：額外降低品質（如果仍然超過目標）
  // 逐步遞減 quality 直到低於 targetBytes
  let quality = quality2
  while (currentBytes > targetBytes && quality > 0.1) {
    quality -= 0.1
    const canvas3 = document.createElement('canvas')
    canvas3.width = canvasWidth
    canvas3.height = canvasHeight
    const ctx3 = canvas3.getContext('2d')
    applyOrientation(ctx3, img, orientation, canvasWidth, canvasHeight)
    base64 = canvas3.toDataURL('image/jpeg', quality)
    currentBytes = Math.round((base64.length - 1) * 0.75)
  }

  console.log('[ImagePipeline] 壓縮完成', {
    original: `${img.width}x${img.height}`,
    output: `${canvasWidth}x${canvasHeight}`,
    orientation,
    finalBytes: currentBytes,
    quality,
  })

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
  console.log('[ImagePipeline] EXIF Orientation:', orientation, 'blob.size:', blob.size)

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
export async function recompressFromBase64(base64, options = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      compressImage(img, 1, options).then(resolve).catch(reject)
    }
    img.onerror = () => reject(new Error('Base64 圖片重建失敗'))
    img.src = base64
  })
}
