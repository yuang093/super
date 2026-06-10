// 🤖 tests/fixtures/generate-exif-fixtures.js
// 生成含不同 EXIF Orientation 的測試 JPEG binary
// 執行：node tests/fixtures/generate-exif-fixtures.js

'use strict'

const fs = require('node:fs')
const path = require('node:path')

const fixturesDir = path.join(__dirname, 'exif')
if (!fs.existsSync(fixturesDir)) {
  fs.mkdirSync(fixturesDir, { recursive: true })
}

/**
 * 建立含 EXIF Orientation 的最小 JPEG binary
 * JPEG 结构：SOI + APP1(EXIF) + DQT + SOF + DHT + SOS + EOI
 * @param {number} orientation - EXIF Orientation 值（1-8）
 * @returns {Buffer}
 */
function createJpegWithOrientation(orientation) {
  // SOI marker (Start of Image)
  const soi = Buffer.from([0xFF, 0xD8])

  // APP1 marker (EXIF) - 最簡化版本
  // EXIF header: "Exif\x00\x00" + TIFF header
  // TIFF header: byte order(2) + magic(2) + IFD offset(4)
  // IFD: number of entries(2) + entries + next IFD offset(4)

  // TIFF byte order: II (little-endian)
  const byteOrder = Buffer.from([0x49, 0x49]) // "II"
  const magic = Buffer.from([0x2A, 0x00]) // 42 in little-endian
  // IFD offset (8 = after byteOrder(2) + magic(2) + offset(4))
  const ifdOffset = Buffer.from([0x08, 0x00, 0x00, 0x00])

  // Orientation IFD entry
  // Tag: 0x0112 (Orientation)
  // Type: 3 (SHORT)
  // Count: 1
  // Value: orientation
  const tagOrientation = Buffer.from([0x12, 0x01]) // 0x0112 little-endian
  const typeShort = Buffer.from([0x03, 0x00]) // type 3 = SHORT
  const count1 = Buffer.from([0x01, 0x00, 0x00, 0x00]) // count = 1
  const orientValue = Buffer.alloc(4)
  orientValue.writeUInt16LE(orientation, 0)
  const entryOrientation = Buffer.concat([tagOrientation, typeShort, count1, orientValue])

  // Next IFD offset = 0 (no more IFDs)
  const nextIfd = Buffer.from([0x00, 0x00, 0x00, 0x00])

  // Number of directory entries = 1
  const numEntries = Buffer.from([0x01, 0x00])

  const tiffContent = Buffer.concat([byteOrder, magic, ifdOffset, numEntries, entryOrientation, nextIfd])

  // APP1 length = 6 ("Exif\x00\x00") + tiffContent.length
  const app1Length = Buffer.alloc(2)
  app1Length.writeUInt16BE(6 + tiffContent.length, 0)

  const exifHeader = Buffer.from([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]) // "Exif\x00\x00"

  const app1 = Buffer.concat([
    Buffer.from([0xFF, 0xE1]),
    app1Length,
    exifHeader,
    tiffContent,
  ])

  // DQT (Define Quantization Table) - 簡化
  const dqt = Buffer.from([
    0xFF, 0xDB, 0x00, 0x43, 0x00,
    16, 11, 10, 16, 24, 40, 51, 61,
    12, 12, 14, 19, 26, 58, 60, 55,
    14, 13, 16, 24, 40, 57, 69, 56,
    14, 17, 22, 29, 51, 87, 80, 62,
    18, 22, 37, 56, 68, 109, 103, 77,
    24, 35, 55, 64, 81, 104, 113, 92,
    49, 64, 78, 87, 103, 121, 120, 101,
    72, 92, 95, 98, 112, 100, 103, 99,
  ])

  // SOF0 (Start of Frame) - 簡化 8x8 grayscale
  const sof0 = Buffer.from([
    0xFF, 0xC0, 0x00, 0x0B, 0x08, // 8x8
    0x00, 0x08, 0x00, 0x08, 0x01, 0x01, 0x11, 0x00,
  ])

  // DHT (Define Huffman Table) - 簡化
  const dht = Buffer.from([
    0xFF, 0xC4, 0x00, 0x1F, 0x00,
    0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0,
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
  ])

  // SOS (Start of Scan)
  const sos = Buffer.from([0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00])

  // EOI (End of Image)
  const eoi = Buffer.from([0xFF, 0xD9])

  return Buffer.concat([soi, app1, dqt, sof0, dht, sos, eoi])
}

// 生成不同方向的測試檔案
const orientations = [1, 2, 3, 4, 5, 6, 7, 8]
orientations.forEach((orient) => {
  const jpeg = createJpegWithOrientation(orient)
  const filePath = path.join(fixturesDir, `orientation-${orient}.jpg`)
  fs.writeFileSync(filePath, jpeg)
  console.log(`✅ Generated: orientation-${orient}.jpg (${jpeg.length} bytes)`)
})

console.log(`\n📁 Fixtures generated in: ${fixturesDir}`)