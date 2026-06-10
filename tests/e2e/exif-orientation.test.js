// 🤖 tests/e2e/exif-orientation.test.js
// T-E-02：iPhone Safari 直立拍照方向驗證
// 對應 [TESTING_PLAN.md §3.4 U-EXIF-01 ~ U-EXIF-10](./TESTING_PLAN.md)
// 對應 [todo_progress.md T-E-02](./todo_progress.md)
// 跑法：npx playwright test tests/e2e/exif-orientation.test.js

'use strict'

const { test, expect } = require('@playwright/test')
const path = require('node:path')

// ============================================================================
// T-E-02：EXIF Orientation 解析測試
// ============================================================================

test.describe('T-E-02：EXIF Orientation 解析測試', () => {
  // --------------------------------------------------------------------------
  // U-EXIF-01 ~ U-EXIF-08：8 種 Orientation 解析
  // --------------------------------------------------------------------------
  test.describe('U-EXIF-01 ~ U-EXIF-08：8 種方向解析', () => {
    const orientations = [
      { value: 1, name: '正常方向（直立）', desc: 'iPhone 14 Pro 直拍' },
      { value: 2, name: '水平翻轉', desc: '水平鏡像' },
      { value: 3, name: '旋轉 180°', desc: '倒置（Samsung S23 倒置）' },
      { value: 4, name: '垂直翻轉', desc: '垂直鏡像' },
      { value: 5, name: '順時針 90° + 水平翻轉', desc: 'transpose' },
      { value: 6, name: '順時針 90°', desc: 'iPhone SE 2 直拍（需順時針 90°）' },
      { value: 7, name: '逆時針 90° + 水平翻轉', desc: 'transverse' },
      { value: 8, name: '逆時針 90°', desc: 'Pixel 7 橫拍（需逆時針 90°）' },
    ]

    for (const { value, name, desc } of orientations) {
      test(`U-EXIF-0${value}：${name}（${desc}）`, async ({ page }) => {
        // 讀取測試 fixture
        const fs = require('node:fs')
        const fixturePath = path.join(__dirname, '..', 'fixtures', 'exif', `orientation-${value}.jpg`)
        const buffer = fs.readFileSync(fixturePath)

        // 測試要徑：驗證 EXIF 解析結果存在
        const { parseExifOrientation } = require('../fixtures/exif-parser')
        const actual = parseExifOrientation(buffer)

        expect(actual).toBe(value)
        expect(value).toBeGreaterThanOrEqual(1)
        expect(value).toBeLessThanOrEqual(8)
      })
    }
  })

  // --------------------------------------------------------------------------
  // U-EXIF-09：截斷 EXIF 處理
  // --------------------------------------------------------------------------
  test('U-EXIF-09：截斷的 EXIF 區段應返回預設值 1', () => {
    const { parseExifOrientation } = require('../fixtures/exif-parser')
    const fs = require('node:fs')
    const pathModule = require('node:path')

    const fixturePath = pathModule.join(__dirname, '..', 'fixtures', 'exif', 'orientation-1.jpg')
    const buffer = fs.readFileSync(fixturePath)
    const truncated = buffer.slice(0, Math.floor(buffer.length / 2))

    const result = parseExifOrientation(truncated)
    expect(result).toBe(1)
  })

  // --------------------------------------------------------------------------
  // U-EXIF-10：純函式特性（無副作用）
  // --------------------------------------------------------------------------
  test('U-EXIF-10：相同輸入兩次呼叫應回傳完全相同結果', () => {
    const { parseExifOrientation } = require('../fixtures/exif-parser')
    const fs = require('node:fs')
    const pathModule = require('node:path')

    const fixturePath = pathModule.join(__dirname, '..', 'fixtures', 'exif', 'orientation-6.jpg')
    const buffer = fs.readFileSync(fixturePath)

    const result1 = parseExifOrientation(buffer)
    const result2 = parseExifOrientation(buffer)
    const result3 = parseExifOrientation(buffer)

    expect(result1).toBe(result2)
    expect(result2).toBe(result3)
    expect(result1).toBe(6)
  })

  // --------------------------------------------------------------------------
  // U-EXIF-11：無 EXIF 圖片應返回預設值 1
  // --------------------------------------------------------------------------
  test('U-EXIF-11：無 EXIF 的 JPEG 應返回 1', () => {
    const { parseExifOrientation } = require('../fixtures/exif-parser')
    const fs = require('node:fs')
    const pathModule = require('node:path')

    const fixturePath = pathModule.join(__dirname, '..', 'fixtures', 'exif', 'orientation-1.jpg')
    const buffer = fs.readFileSync(fixturePath)

    // 建立無 EXIF 的 JPEG：SOI + DQT + EOI
    const soi = buffer.slice(0, 2)
    const dqtIdx = buffer.indexOf(Buffer.from([0xFF, 0xDB]))
    const noExifBuffer = Buffer.concat([soi, buffer.slice(dqtIdx)])

    const result = parseExifOrientation(noExifBuffer)
    expect(result).toBe(1)
  })

  // --------------------------------------------------------------------------
  // U-EXIF-12：邊界值測試（orientation = 0, 9, 255）
  // --------------------------------------------------------------------------
  test('U-EXIF-12：邊界值應返回預設 1（不當機）', () => {
    const { parseExifOrientation } = require('../fixtures/exif-parser')

    function createEdgeCaseJpeg(orientation) {
      const soi = Buffer.from([0xFF, 0xD8])
      const byteOrder = Buffer.from([0x49, 0x49])
      const magic = Buffer.from([0x2A, 0x00])
      const ifdOffset = Buffer.from([0x08, 0x00, 0x00, 0x00])
      const numEntries = Buffer.from([0x01, 0x00])
      const tagOrientation = Buffer.from([0x12, 0x01])
      const typeShort = Buffer.from([0x03, 0x00])
      const count1 = Buffer.from([0x01, 0x00, 0x00, 0x00])
      const orientValue = Buffer.alloc(4)
      orientValue.writeUInt16LE(orientation, 0)
      const entry = Buffer.concat([tagOrientation, typeShort, count1, orientValue])
      const nextIfd = Buffer.from([0x00, 0x00, 0x00, 0x00])
      const tiff = Buffer.concat([byteOrder, magic, ifdOffset, numEntries, entry, nextIfd])
      const app1Length = Buffer.alloc(2)
      app1Length.writeUInt16BE(6 + tiff.length, 0)
      const exifHeader = Buffer.from([0x45, 0x78, 0x69, 0x66, 0x00, 0x00])
      const app1 = Buffer.concat([Buffer.from([0xFF, 0xE1]), app1Length, exifHeader, tiff])
      const eoi = Buffer.from([0xFF, 0xD9])
      return Buffer.concat([soi, app1, eoi])
    }

    const orientations = [0, 9, 255]
    for (const orient of orientations) {
      const jpeg = createEdgeCaseJpeg(orient)
      const result = parseExifOrientation(jpeg)
      expect(result).toBe(1)
    }
  })

  // --------------------------------------------------------------------------
  // T-E-02-13：Playwright E2E - 頁面無 JS Error
  // --------------------------------------------------------------------------
  test('T-E-02-13：頁面載入無 JS Error（驗證前端 EXIF 模組正常）', async ({ page }) => {
    await page.goto('/')
    await page.setViewportSize({ width: 390, height: 844 })

    const errors = []
    page.on('pageerror', (err) => errors.push(err.message))
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.reload()
    await page.waitForLoadState('networkidle')

    const criticalErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('manifest')
    )
    expect(criticalErrors).toHaveLength(0)
  })

  // --------------------------------------------------------------------------
  // T-E-02-14：iPhone SE 2 直拍情境（Orientation=6）
  // --------------------------------------------------------------------------
  test('T-E-02-14：iPhone SE 2 直拍（Orientation=6）應被正確解析', () => {
    const { parseExifOrientation } = require('../fixtures/exif-parser')
    const fs = require('node:fs')
    const pathModule = require('node:path')

    const fixturePath = pathModule.join(__dirname, '..', 'fixtures', 'exif', 'orientation-6.jpg')
    const buffer = fs.readFileSync(fixturePath)
    const result = parseExifOrientation(buffer)

    expect(result).toBe(6)
  })

  // --------------------------------------------------------------------------
  // T-E-02-15：Pixel 7 橫拍情境（Orientation=8）
  // --------------------------------------------------------------------------
  test('T-E-02-15：Pixel 7 橫拍（Orientation=8）應被正確解析', () => {
    const { parseExifOrientation } = require('../fixtures/exif-parser')
    const fs = require('node:fs')
    const pathModule = require('node:path')

    const fixturePath = pathModule.join(__dirname, '..', 'fixtures', 'exif', 'orientation-8.jpg')
    const buffer = fs.readFileSync(fixturePath)
    const result = parseExifOrientation(buffer)

    expect(result).toBe(8)
  })
})