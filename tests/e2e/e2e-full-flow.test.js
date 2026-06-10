// 🤖 tests/e2e/e2e-full-flow.test.js
// T-E-01：拍照 → 辨識 → 購物車 → 匯率完整流程 E2E 測試
// 對應 [TESTING_PLAN.md §5.3](./TESTING_PLAN.md)
// 對應 [todo_progress.md T-E-01](./todo_progress.md)
// 跑法：npx playwright test tests/e2e/e2e-full-flow.test.js

'use strict'

const { test, expect } = require('@playwright/test')

// ============================================================================
// T-E-01：完整流程 E2E 測試
// ============================================================================

test.describe('T-E-01：完整流程 E2E 測試', () => {
  test.beforeEach(async ({ page }) => {
    // 導向首頁
    await page.goto('/')
    // 等待行動版視角
    await page.setViewportSize({ width: 390, height: 844 })
  })

  // --------------------------------------------------------------------------
  // T-E-01-01：頁面載入基本檢查
  // --------------------------------------------------------------------------
  test('T-E-01-01：頁面應正確載入且標題正確', async ({ page }) => {
    await expect(page).toHaveTitle(/Supermarket Tracker/)
  })

  test('T-E-01-02：Header 應顯示正確標題', async ({ page }) => {
    const title = page.locator('.app-title')
    await expect(title).toBeVisible()
    await expect(title).toContainText('SUPERMARKET TRACKER')
  })

  test('T-E-01-03：狀態指示器應可見', async ({ page }) => {
    const status = page.locator('#app-status')
    await expect(status).toBeVisible()
  })

  // --------------------------------------------------------------------------
  // T-E-01-04：拍照區塊檢查
  // --------------------------------------------------------------------------
  test('T-E-01-04：拍照按鈕應存在且可點擊', async ({ page }) => {
    const cameraInput = page.locator('#btn-camera-trigger')
    await expect(cameraInput).toBeAttached()
    await expect(cameraInput).toHaveAttribute('accept', 'image/*')
  })

  test('T-E-01-05：模型進度條初始應隱藏', async ({ page }) => {
    const progress = page.locator('#model-progress')
    // 初始應為 hidden 屬性
    await expect(progress).toBeHidden()
  })

  // --------------------------------------------------------------------------
  // T-E-01-06：購物車區塊檢查
  // --------------------------------------------------------------------------
  test('T-E-01-06：購物車標題應顯示', async ({ page }) => {
    const cartTitle = page.locator('#cart-title')
    await expect(cartTitle).toBeVisible()
    await expect(cartTitle).toContainText('購物車')
  })

  test('T-E-01-07：空購物車應顯示提示文字', async ({ page }) => {
    const emptyMsg = page.locator('.item-list-empty')
    await expect(emptyMsg).toBeVisible()
    await expect(emptyMsg).toContainText('購物車是空的')
  })

  test('T-E-01-08：工具列按鈕應存在', async ({ page }) => {
    await expect(page.locator('#btn-refresh-cart')).toBeVisible()
    await expect(page.locator('#btn-clear-cart')).toBeVisible()
  })

  // --------------------------------------------------------------------------
  // T-E-01-09：匯率區塊檢查
  // --------------------------------------------------------------------------
  test('T-E-01-09：匯率區塊應顯示三大幣別', async ({ page }) => {
    await expect(page.locator('#exchange-rates')).toBeVisible()
    await expect(page.locator('#rate-usd')).toBeVisible()
    await expect(page.locator('#rate-jpy')).toBeVisible()
    await expect(page.locator('#rate-krw')).toBeVisible()
  })

  // --------------------------------------------------------------------------
  // T-E-01-10：Summary 區塊初始隱藏
  // --------------------------------------------------------------------------
  test('T-E-01-10：空購物車時 Summary 應隱藏', async ({ page }) => {
    const summary = page.locator('#cart-summary')
    await expect(summary).toBeHidden()
  })

  // --------------------------------------------------------------------------
  // T-E-01-11：底部 Tab Bar 檢查
  // --------------------------------------------------------------------------
  test('T-E-01-11：底部 Tab Bar 應顯示 5 個項目', async ({ page }) => {
    const tabs = page.locator('.tab-bar .tab-item')
    await expect(tabs).toHaveCount(5)
  })

  test('T-E-01-12：首頁 Tab 應為 active 狀態', async ({ page }) => {
    const homeTab = page.locator('.tab-bar .tab-item').first()
    await expect(homeTab).toHaveClass(/active/)
  })

  // --------------------------------------------------------------------------
  // T-E-01-13：Footer 資訊檢查
  // --------------------------------------------------------------------------
  test('T-E-01-13：Footer 應顯示版本與技術棧', async ({ page }) => {
    const footer = page.locator('.app-footer')
    await expect(footer).toBeVisible()
    await expect(footer).toContainText('v0.1.0')
    await expect(footer).toContainText('TensorFlow.js')
  })

  // --------------------------------------------------------------------------
  // T-E-01-14：結帳按鈕檢查
  // --------------------------------------------------------------------------
  test('T-E-01-14：Sticky CTA 結帳按鈕應存在', async ({ page }) => {
    const checkoutBtn = page.locator('#btn-checkout')
    await expect(checkoutBtn).toBeVisible()
    await expect(checkoutBtn).toContainText('結帳')
  })

  // --------------------------------------------------------------------------
  // T-E-01-15：PWA manifest 連結檢查
  // --------------------------------------------------------------------------
  test('T-E-01-15：Manifest 應被正確引用', async ({ page }) => {
    const manifest = page.locator('link[rel="manifest"]')
    await expect(manifest).toBeAttached()
    await expect(manifest).toHaveAttribute('href', '/manifest.json')
  })

  // --------------------------------------------------------------------------
  // T-E-01-16：無資料庫時應優雅處理（不 crash）
  // --------------------------------------------------------------------------
  test('T-E-01-16：頁面載入不應有 JS Error', async ({ page }) => {
    const errors = []
    page.on('pageerror', (err) => errors.push(err.message))
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.reload()
    await page.waitForLoadState('networkidle')

    // 過濾已知非關鍵錯誤（如圖片載入失敗）
    const criticalErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('manifest')
    )
    expect(criticalErrors).toHaveLength(0)
  })

  // --------------------------------------------------------------------------
  // T-E-01-17：清空購物車按鈕功能
  // --------------------------------------------------------------------------
  test('T-E-01-17：點擊清空按鈕不應造成頁面錯誤', async ({ page }) => {
    await page.click('#btn-clear-cart')
    // 確認仍在同一頁且無錯誤
    await expect(page.locator('.app-main')).toBeVisible()
  })

  // --------------------------------------------------------------------------
  // T-E-01-18：重新整理購物車按鈕功能
  // --------------------------------------------------------------------------
  test('T-E-01-18：點擊重新整理按鈕不應造成頁面錯誤', async ({ page }) => {
    await page.click('#btn-refresh-cart')
    await expect(page.locator('.app-main')).toBeVisible()
  })

  // --------------------------------------------------------------------------
  // T-E-01-19：響應式設計（桌面視角）
  // --------------------------------------------------------------------------
  test('T-E-01-19：桌面視角下主要區塊仍可見', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await expect(page.locator('.app-header')).toBeVisible()
    await expect(page.locator('.capture-section')).toBeVisible()
    await expect(page.locator('.cart-section')).toBeVisible()
    await expect(page.locator('.exchange-section')).toBeVisible()
  })

  // --------------------------------------------------------------------------
  // T-E-01-20：斗內連結應為外部連結
  // --------------------------------------------------------------------------
  test('T-E-01-20：斗內連結應正確指向外部網址', async ({ page }) => {
    const donateTab = page.locator('.tab-bar .tab-item[target="_blank"]')
    await expect(donateTab).toBeVisible()
    await expect(donateTab).toHaveAttribute('href', /jkopay/)
  })
})