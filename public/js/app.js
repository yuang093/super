// 🤖 public/js/app.js
// Supermarket Tracker 前端入口（ES Module）
// 對應 [todo_progress.md F-01 + F-04 + F-05 + F-06]
// 串接 image-pipeline.js、cart.js

'use strict'

import { Cart, onCartEvent, formatPrice, formatRelativeTime } from './cart.js'
import { processImageBlob } from './image-pipeline.js'

// ============================================================================
// 全域應用物件
// ============================================================================
const app = {
  config: {
    apiBase: '',
    healthcheckInterval: 30_000,
  },
  state: {
    isOnline: false,
    serverInfo: null,
    cart: null,
    fingerprint: generateFingerprint(),
  },
}

/**
 * 產生臨時 fingerprint（用於 localStorage 購物車資料綁定）
 */
function generateFingerprint() {
  try {
    let fp = localStorage.getItem('super_fingerprint')
    if (!fp) {
      fp = 'fp_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
      localStorage.setItem('super_fingerprint', fp)
    }
    return fp
  } catch (e) {
    return 'fp_anon_' + Math.random().toString(36).slice(2, 10)
  }
}

// ============================================================================
// DOM 元素參照
// ============================================================================
const $ = (id) => document.getElementById(id)

/**
 * 鎖住所有操作按鈕（防止重複點擊）
 */
function lockAllButtons() {
  const trigger = $('btn-camera-trigger')
  const gallery = $('input-gallery')
  const upload = $('input-upload')
  if (trigger) trigger.disabled = true
  if (gallery) gallery.disabled = true
  if (upload) upload.disabled = true
  document.querySelectorAll('.btn-capture-action').forEach((btn) => {
    btn.classList.add('btn-disabled')
  })
}

/**
 * 解鎖所有操作按鈕
 */
function unlockAllButtons() {
  const trigger = $('btn-camera-trigger')
  const gallery = $('input-gallery')
  const upload = $('input-upload')
  if (trigger) trigger.disabled = false
  if (gallery) gallery.disabled = false
  if (upload) upload.disabled = false
  document.querySelectorAll('.btn-capture-action').forEach((btn) => {
    btn.classList.remove('btn-disabled')
  })
}

let cart = null
let currentImageData = null // 目前預覽中的圖片資料
let isProcessing = false // 是否正在處理中（防止重複點擊）
let isAutoAnalysis = false // 是否為自動分析模式（由 handleGallerySelect 觸發）

// ============================================================================
// 狀態指示器更新
// ============================================================================
function updateStatusIndicator(isOnline, serverInfo = null) {
  const dot = $('status-dot')
  const text = $('status-text')
  const status = $('app-status')

  if (!dot || !text || !status) return

  if (isOnline) {
    status.classList.remove('offline')
    dot.classList.add('online')
    dot.classList.remove('offline')
  } else {
    status.classList.add('offline')
    dot.classList.add('offline')
    dot.classList.remove('online')
  }

  if (isOnline && serverInfo) {
    text.textContent = `已連線 · ${serverInfo.env} · 運行 ${serverInfo.uptimeHuman || serverInfo.uptime + 's'} · v${serverInfo.version}`
  } else {
    text.textContent = '離線 · 請檢查網路連線'
  }
}

// ============================================================================
// 健康檢查
// ============================================================================
async function checkHealth() {
  try {
    const response = await fetch(`${app.config.apiBase}/healthz`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.json()
  } catch (err) {
    console.warn('[健康檢查失敗]', err.message)
    return null
  }
}

// ============================================================================
// ============================================================================
// 相簿選取：從相簿載入圖片
// ============================================================================
async function handleGallerySelect(file) {
  if (!file) return
  if (isProcessing) {
    console.warn('[App] 正在處理中，忽略此次點擊')
    return
  }
  isProcessing = true
  lockAllButtons()

  console.log('[App] handleGallerySelect 收到檔案:', {
    name: file.name,
    type: file.type,
    size: file.size,
  })

  try {
    showProgress('🖼️ 處理圖片中…', 30)

    const result = await processImageBlob(file)
    console.log('[App] processImageBlob 完成', {
      width: result.width,
      height: result.height,
      bytes: result.bytes,
    })

    currentImageData = {
      blob: file,
      base64: result.base64,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      orientation: result.orientation,
      resultWidth: result.width,
      resultHeight: result.height,
    }

    showProgress('🖼️ 圖片已載入', 100)
    showPreview(currentImageData)
    console.log('[App] 預覽已顯示，即將自動觸發 AI 辨識')

    // 自動觸發 AI 辨識與加入購物車流程
    isAutoAnalysis = true
    await handleAddToCart()
  } catch (err) {
    console.error('[App] handleGallerySelect 錯誤:', err)
    hideProgress()
    showToast(err.message || '圖片處理失敗', 'error')
  } finally {
    isProcessing = false
    unlockAllButtons()
  }
}

// ============================================================================
// 加入購物車
// ============================================================================
async function handleAddToCart() {
  if (!currentImageData) {
    console.warn('[App] currentImageData 是空的，無法加入購物車')
    showToast('請先選擇或拍攝圖片', 'error')
    return
  }
  // 手動點擊時防止重複，但自動分析（isAutoAnalysis）應跳過此檢查
  if (isProcessing && !isAutoAnalysis) {
    console.warn('[App] 正在處理中，忽略此次點擊')
    return
  }
  isProcessing = true
  lockAllButtons()

  // 自動分析時隱藏「分析並加入購物車」按鈕
  const btnAddCart = $('btn-add-cart')
  if (btnAddCart) btnAddCart.style.visibility = 'hidden'

  console.log('[App] handleAddToCart 開始', {
    base64Length: currentImageData.base64.length,
    width: currentImageData.width,
    height: currentImageData.height,
  })

  showProgress('🛒 加入購物車中…', 50)

  try {
    // 呼叫後端 API 進行 VLM 辨識
    const formData = new FormData()
    //將 base64 轉回 Blob
    const base64Str = currentImageData.base64.includes(',')
      ? currentImageData.base64.split(',')[1]
      : currentImageData.base64
    const byteString = atob(base64Str)
    const mimeType = currentImageData.base64.match(/data:([^;]+);/)?.[1] || 'image/jpeg'
    const ab = new ArrayBuffer(byteString.length)
    const ia = new Uint8Array(ab)
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i)
    }
    const blob = new Blob([ab], { type: mimeType })
    formData.append('image', blob, 'capture.jpg')
    formData.append('fingerprint', app.state.fingerprint)

    console.log('[App] 準備送出 /api/capture 请求，blob size:', blob.size)

    const response = await fetch('/api/capture', {
      method: 'POST',
      body: formData,
    })

    console.log('[App] 收到回應', { status: response.status, ok: response.ok })

    const data = await response.json()
    console.log('[App] /api/capture 回應資料:', JSON.stringify(data).slice(0, 200))

    if (data.success) {
      console.log('[App] 辨識成功，加入購物車:', data.item.name)
      // 後端已寫入 DB，這裡只是本機 UI 更新
      cart.addItem({
        name: data.item.name,
        price: data.item.price,
        currency: data.item.currency,
        confidence: data.item.confidence,
        parseMethod: data.item.parseMethod,
        imageBase64: currentImageData?.base64 || null,
      })

      showResult({
        success: true,
        item: data.item,
        vlm: data.vlm,
      })

      // 清除預覽
      resetPreview()
      showToast(`✅ ${data.item.name} 已加入購物車`, 'success')
      // 退稅提示已移至 renderCart() 的 Summary 區塊固定顯示
    } else {
      console.warn('[App] 辨識失敗:', data.error?.message)
      showResult({
        success: false,
        error: data.error,
      })
    }
  } catch (err) {
    console.error('[App] 加入購物車失敗（網路錯誤）:', err)
    showResult({
      success: false,
      error: { message: err.message },
    })
  } finally {
    hideProgress()
    isProcessing = false
    isAutoAnalysis = false
    unlockAllButtons()
  }
}

// ============================================================================
// UI顯示函式
// ============================================================================

/**
 * 顯示預覽區塊
 */
function showPreview(imageData) {
  const preview = $('capture-preview')
  const canvas = $('preview-canvas')
  const info = $('preview-info')
  const buttons = $('capture-buttons')

  if (!preview || !canvas) return

  //繪製圖片到 canvas
  const ctx = canvas.getContext('2d')
  const img = new Image()
  img.onload = () => {
    canvas.width = imageData.width
    canvas.height = imageData.height
    ctx.drawImage(img, 0, 0, imageData.width, imageData.height)
  }
  img.src = imageData.base64

  //顯示資訊
  if (info) {
    const needsSwap = [5, 6, 7, 8].includes(imageData.orientation)
    const swapText = needsSwap ? ' 🔄swap' : ''
    const orientText = imageData.orientation ? ` EXIF↗${imageData.orientation}` : ''
    info.textContent = `[${imageData.resultWidth}×${imageData.resultHeight}]${swapText}${orientText} · ${formatBytes(imageData.bytes)}`
  }

  // 切換顯示
  if (buttons) buttons.style.display = 'none'
  preview.style.display = 'flex'
}

/**
 * 重置預覽區塊
 */
function resetPreview() {
  const preview = $('capture-preview')
  const buttons = $('capture-buttons')
  const canvas = $('preview-canvas')
  const result = $('capture-result')

  if (preview) preview.style.display = 'none'
  if (buttons) buttons.style.display = 'flex'
  if (result) result.style.display = 'none'
  if (canvas) {
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }
  currentImageData = null
}

/**
 * 顯示處理進度
 */
function showProgress(text, percent) {
  const progress = $('capture-progress')
  const progressText = $('capture-progress-text')
  const progressFill = $('capture-progress-fill')

  if (progress) progress.style.display = 'block'
  if (progressText) progressText.textContent = text
  if (progressFill) progressFill.style.width = `${percent}%`
}

/**
 * 隱藏處理進度
 */
function hideProgress() {
  const progress = $('capture-progress')
  if (progress) progress.style.display = 'none'
}

/**
 * 顯示辨識結果
 */
function showResult({ success, item, error }) {
  const result = $('capture-result')
  if (!result) return

  if (success && item) {
    result.innerHTML = `
      <div class="result-card result-success">
        <h4>✅ 辨識成功！</h4>
        <div class="result-grid">
          <div class="result-label">商品</div>
          <div class="result-value">${escapeHtml(item.name)}</div>
          <div class="result-label">價格</div>
          <div class="result-value">${formatPrice(item.price, item.currency)}</div>
          <div class="result-label">信心度</div>
          <div class="result-value">${((item.confidence || 1) * 100).toFixed(0)}%</div>
          <div class="result-label">解析方式</div>
          <div class="result-value">${escapeHtml(item.parseMethod || 'unknown')}</div>
        </div>
        <p class="result-action-hint">🛒 已自動加入購物車</p>
      </div>
    `
  } else {
    result.innerHTML = `
      <div class="result-card result-error">
        <h4>❌ 辨識失敗</h4>
        <p>${escapeHtml(error?.message || '未知錯誤')}</p>
        ${error?.code ? `<p class="result-error-code">錯誤碼：${escapeHtml(error.code)}</p>` : ''}
      </div>
    `
  }
  result.style.display = 'block'
}

/**
 * 顯示 Toast 提示訊息（3 秒後自動消失）
 * @param {string} message - 顯示訊息
 * @param {'info'|'error'|'success'} type - 類型
 */
function showToast(message, type = 'info') {
  // 移除舊的 toast
  const existing = document.querySelector('.app-toast')
  if (existing) existing.remove()

  const toast = document.createElement('div')
  toast.className = `app-toast app-toast-${type}`
  toast.textContent = message
  toast.setAttribute('role', 'alert')
  document.body.appendChild(toast)

  // 立即顯示（觸發 CSS 動畫）
  requestAnimationFrame(() => {
    toast.classList.add('visible')
  })

  setTimeout(() => {
    toast.classList.remove('visible')
    setTimeout(() => {
      if (toast.parentNode) toast.remove()
    }, 300) // 等待動畫結束
  }, 3000)
}

/**
 * 格式化位元組
 */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

/**
 * HTML跳脫（防 XSS）
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return ''
  return String(str)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#39;')
}

// ============================================================================
// 購物車 UI 渲染
// ============================================================================

/**
 * 渲染購物車列表
 */
function renderCart() {
  const listEl = $('item-list')
  const summaryEl = $('cart-summary')
  const summaryRowsEl = $('summary-rows')
  if (!listEl) return

  const items = cart.getItems()
  const summary = cart.getSummary()

  if (items.length === 0) {
    listEl.innerHTML = '<div class="item-list-empty">🛒 購物車是空的，去拍個商品吧！</div>'
    if (summaryEl) summaryEl.style.display = 'none'
    return
  }

  listEl.innerHTML = items
    .map(
      (item) => `
 <div class="cart-item" data-id="${item.id}">
      ${item.imageBase64 ? `<img class="cart-item-thumb" src="${item.imageBase64}" alt="${escapeHtml(item.name)}" loading="lazy" />` : '<div class="cart-item-emoji">📦</div>'}
      <div class="cart-item-info">
        <div class="cart-item-name">${escapeHtml(item.name)}</div>
        <div class="cart-item-meta">${formatRelativeTime(item.createdAt)}</div>
      </div>
      <div class="cart-item-right">
        <div class="cart-item-price">${formatPrice(item.price, item.currency)}</div>
        <button class="btn-item-delete" data-id="${item.id}" type="button" aria-label="刪除">×</button>
      </div>
    </div>
  `
    )
    .join('')

  // 綁定刪除事件
  listEl.querySelectorAll('.btn-item-delete').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id
      if (confirm('確定要刪除此商品嗎？')) {
        cart.removeItem(id)
        renderCart()
      }
    })
  })

  // 縮圖點擊放大（Lightbox）
  listEl.querySelectorAll('.cart-item-thumb').forEach((img) => {
    img.addEventListener('click', (e) => {
      e.stopPropagation()
      const overlay = document.createElement('div')
      overlay.className = 'lightbox-overlay'
      overlay.innerHTML = `<button class="lightbox-close" aria-label="關閉">×</button><img src="${img.src}" alt="${img.alt}" />`
      document.body.appendChild(overlay)
      overlay.querySelector('.lightbox-close').addEventListener('click', () => overlay.remove())
      overlay.addEventListener('click', (ev) => {
        if (ev.target === overlay) overlay.remove()
      })
    })
  })

  // 價格點擊編輯（contenteditable）
  listEl.querySelectorAll('.cart-item-price').forEach((priceEl) => {
    priceEl.setAttribute('contenteditable', 'true')
    priceEl.setAttribute('title', '點擊編輯價格')
    priceEl.addEventListener('blur', () => {
      const itemEl = priceEl.closest('.cart-item')
      const id = itemEl?.dataset?.id
      if (!id) return
      const rawText = priceEl.textContent.replace(/[^0-9.]/g, '')
      const newPrice = parseFloat(rawText)
      if (isNaN(newPrice) || newPrice < 0) {
        // 恢復原本價格
        const item = cart.getItems().find((i) => i.id === id)
        if (item) priceEl.textContent = formatPrice(item.price, item.currency)
        showToast('價格格式不正確', 'error')
        return
      }
      cart.updateItemPrice(id, newPrice)
      console.log('[App] 價格已更新', { id, newPrice })
      renderCart()
    })
    priceEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        priceEl.blur()
      }
    })
  })

  // 渲染總計
  if (summaryEl && summaryRowsEl) {
    if (summary.currencySummaries.length > 0) {
      summaryEl.style.display = 'block'
      summaryRowsEl.innerHTML = summary.currencySummaries
        .map(
          (s) => `
        <div class="summary-row">
          <span class="summary-currency">${s.currency}</span>
          <span class="summary-count">${s.count} 件</span>
          <span class="summary-amount">${formatPrice(s.total, s.currency)}</span>
        </div>
      `
        )
        .join('')

      // TWD 總額特別標示
      summaryRowsEl.innerHTML += `
        <div class="summary-row" style="margin-top:8px;padding-top:8px;border-top:2px solid var(--black);">
          <span class="summary-currency">💰 TWD</span>
          <span class="summary-count">合計</span>
          <span class="summary-amount">${formatPrice(summary.totalTWD, 'TWD')}</span>
        </div>
      `

      // 退稅提示：任一筆 JPY 商品超過 ¥5000 即持續顯示
      const hasJpyOver5000 = items.some((item) => item.currency === 'JPY' && Number(item.price) > 5000)
      if (hasJpyOver5000) {
        summaryRowsEl.innerHTML += `
          <div class="tax-refund-hint">
            💡 消費超過 ¥5,000，可能符合免稅資格（請保留發票）
          </div>
        `
      }
    } else {
      summaryEl.style.display = 'none'
    }
  }
}

// ============================================================================
// 匯率顯示
// ============================================================================

/**
 * 更新匯率顯示（友善心算格式）
 * USD: $1 = {value}
 * JPY: ¥100 = {value}（原匯率 × 100）
 * KRW: ₩1000 = {value}（原匯率 × 1000）
 */
function updateExchangeRates() {
  const rates = cart.getRates()
  const rateUsd = $('rate-usd')
  const rateJpy = $('rate-jpy')
  const rateKrw = $('rate-krw')

  if (rateUsd) rateUsd.textContent = rates.USD ? `$${rates.USD.toFixed(1)}` : '--'
  if (rateJpy) rateJpy.textContent = rates.JPY ? `¥100 = ${(rates.JPY * 100).toFixed(1)}` : '--'
  if (rateKrw) rateKrw.textContent = rates.KRW ? `₩1000 = ${(rates.KRW * 1000).toFixed(1)}` : '--'
}

/**
 * 從後端 API 抓取匯率並更新 Cart
 */
async function fetchRates() {
  try {
    const response = await fetch('/api/rates', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    if (data.success && data.rates) {
      cart.updateRates(data.rates)
      updateExchangeRates()
      console.log('[App] 匯率已更新', data.rates)
    }
  } catch (err) {
    console.warn('[App] 匯率抓取失敗，使用預設值', err.message)
    // 使用 Cart內建預設值
    cart.updateRates({
      USD: 1,
      TWD: 31.5,
      JPY: 0.21,
      EUR: 0.91,
    })
    updateExchangeRates()
  }
}

// ============================================================================
// 初始化
// ============================================================================
async function initApp() {
  console.log('🛒 Supermarket Tracker 啟動中…')

  // 初始化購物車
  cart = new Cart(app.state.fingerprint)

  // 訂閱購物車事件（自動更新 UI）
  onCartEvent('cart:item-added', renderCart)
  onCartEvent('cart:item-updated', renderCart)
  onCartEvent('cart:item-removed', renderCart)
  onCartEvent('cart:cleared', renderCart)
  onCartEvent('cart:loaded', renderCart)

  // 首次健康檢查
  const health = await checkHealth()
  app.state.isOnline = health !== null
  app.state.serverInfo = health
  updateStatusIndicator(app.state.isOnline, health)

  // 定期健康檢查
  setInterval(async () => {
    const result = await checkHealth()
    const wasOnline = app.state.isOnline
    app.state.isOnline = result !== null
    app.state.serverInfo = result
    if (wasOnline !== app.state.isOnline || app.state.isOnline) {
      updateStatusIndicator(app.state.isOnline, result)
    }
  }, app.config.healthcheckInterval)

  // 渲染初始 UI
  renderCart()

  // 抓取匯率並更新購物車
  fetchRates()

  // ============================================================================
  //事件綁定
  // ============================================================================

  // 📷拍照按鈕：HTML5 原生相機（change 事件觸發）
  const btnCameraTrigger = $('btn-camera-trigger')
  if (btnCameraTrigger) {
    btnCameraTrigger.addEventListener('change', (e) => {
      const file = e.target.files?.[0]
      if (file) handleGallerySelect(file)
    })
  }

  // 🔄 重選按鈕
  const btnRetake = $('btn-retake')
  if (btnRetake) {
    btnRetake.addEventListener('click', () => {
      resetPreview()
      hideProgress()
    })
  }

  // 🛒 加入購物車按鈕
  const btnAddCart = $('btn-add-cart')
  if (btnAddCart) {
    btnAddCart.addEventListener('click', handleAddToCart)
  }

  // 🔄 重新整理購物車
  const btnRefreshCart = $('btn-refresh-cart')
  if (btnRefreshCart) {
    btnRefreshCart.addEventListener('click', () => {
      cart._load()
      renderCart()
      showToast('已重新整理')
    })
  }

  // 🗑️ 清空購物車
  const btnClearCart = $('btn-clear-cart')
  if (btnClearCart) {
    btnClearCart.addEventListener('click', () => {
      if (confirm('確定要清空購物車嗎？此操作無法復原。')) {
        cart.clearAll()
        renderCart()
        showToast('購物車已清空')
      }
    })
  }

  // 💥 結帳按鈕
  const btnCheckout = $('btn-checkout')
  if (btnCheckout) {
    btnCheckout.addEventListener('click', () => {
      const summary = cart.getSummary()
      if (summary.items.length === 0) {
        showToast('購物車是空的，無法結帳')
        return
      }
      alert(
        `🧾 結帳總金額\n` +
          summary.currencySummaries
            .map((s) => `${s.currency}: ${formatPrice(s.total, s.currency)}`)
            .join('\n') +
          `\n💰 新台幣合計：${formatPrice(summary.totalTWD, 'TWD')}`
      )
    })
  }

  // 掛載全域物件
  window.app = app

  console.log('✅ Supermarket Tracker 初始化完成', {
    isOnline: app.state.isOnline,
    fingerprint: app.state.fingerprint,
  })
}

// ============================================================================
// 啟動
// ============================================================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp)
} else {
  initApp()
}

//錯誤捕獲
window.addEventListener('error', (e) => {
  console.error('[App] 全域錯誤', {
    message: e.message,
    filename: e.filename,
    line: e.lineno,
  })
})

export { app }
