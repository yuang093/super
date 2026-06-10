// 🤖 tests/fixtures/exif-parser.js
// EXIF Orientation 解析器（Node.js 版本，與 image-pipeline.js 演算法同步）
// 對應 [TESTING_PLAN.md §3.4 U-EXIF-01 ~ U-EXIF-10]

'use strict'

const fs = require('node:fs')
const path = require('node:path')

/**
 * 從 JPEG ArrayBuffer 擷取 EXIF Orientation 值（0x0112）
 * 演算法與 public/js/image-pipeline.js 的 getExifOrientation 同步
 * @param {Buffer} buffer - JPEG 檔案的二進位資料
 * @returns {number} - Orientation 值，預設 1（正常方向）
 */
function parseExifOrientation(buffer) {
  try {
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
    // 確認 JPEG SOI marker：0xFFD8
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
        // 確認 "Exif\x00\x00" 字串
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
        // TIFF header 起始位置
        const tiffStart = offset + 10
        // Byte order：II = little-endian，MM = big-endian
        const byteOrderMarker = view.getUint16(tiffStart)
        const littleEndian = byteOrderMarker === 0x4949 // "II"
        // IFD offset
        const ifdOffset = view.getUint32(tiffStart + 4, littleEndian)
        const ifdStart = tiffStart + ifdOffset

        // 讀取 IFD 項目數量
        const entryCount = view.getUint16(ifdStart, littleEndian)

        for (let i = 0; i < entryCount; i++) {
          const entryOffset = ifdStart + 2 + i * 12
          const tag = view.getUint16(entryOffset, littleEndian)

          // Orientation tag = 0x0112
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
      // 跳到下一個 segment（length field 在 marker 後 2 bytes）
      if (offset + 3 < length) {
        const segmentLen = view.getUint16(offset + 2)
        offset += segmentLen + 2
      } else {
        break
      }
    }
    return 1
  } catch (err) {
    return 1
  }
}

/**
 * 讀取測試 fixture 並解析 Orientation
 * @param {number} orientation - 預期的 orientation 值
 * @returns {{ actual: number, expected: number, path: string }}
 */
function testFixture(orientation) {
  const fixturePath = path.join(__dirname, 'exif', `orientation-${orientation}.jpg`)
  const buffer = fs.readFileSync(fixturePath)
  const actual = parseExifOrientation(buffer)
  return { actual, expected: orientation, path: fixturePath }
}

module.exports = { parseExifOrientation, testFixture }