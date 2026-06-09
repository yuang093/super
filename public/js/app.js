// 🤖 public/js/app.js
// Supermarket Tracker 前端入口（ES Module）
// 對應 [todo_progress.md F-01 + F-04 + F-05 + F-06]
// 串接 camera.js、image-pipeline.js、cart.js

'use strict';

import { Camera, withCameraErrorHandling } from './camera.js';
import { Cart, onCartEvent, formatPrice, formatRelativeTime, getDefaultRates } from './cart.js';

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
    camera: null,
    cart: null,
    fingerprint: generateFingerprint(),
  },
};

/**
 * 產生臨時 fingerprint（用於 localStorage 購物車資料綁定）
 */
function generateFingerprint() {
  try {
    let fp = localStorage.getItem('super_fingerprint');
    if (!fp) {
      fp = 'fp_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      localStorage.setItem('super_fingerprint', fp);
    }
    return fp;
  } catch (e) {
    return 'fp_anon_' + Math.random().toString(36).slice(2, 10);
  }
}

// ============================================================================
// DOM 元素參照
// ============================================================================
const $ = (id) => document.getElementById(id);

let camera = null;
let cart = null;
let currentImageData = null; // 目前預覽中的圖片資料

// ============================================================================
// 狀態指示器更新
// ============================================================================
function updateStatusIndicator(isOnline, serverInfo = null) {
  const dot = $('status-dot');
  const text = $('status-text');
  const status = $('app-status');

  if (!dot || !text || !status) return;

  if (isOnline) {
    status.classList.remove('offline');
    dot.classList.add('online');
    dot.classList.remove('offline');
  } else {
    status.classList.add('offline');
    dot.classList.add('offline');
    dot.classList.remove('online');
  }

  if (isOnline && serverInfo) {
    text.textContent = `已連線 · ${serverInfo.env} · 運行 ${serverInfo.uptimeHuman || serverInfo.uptime + 's'} · v${serverInfo.version}`;
  } else {
    text.textContent = '離線 · 請檢查網路連線';
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
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    console.warn('[健康檢查失敗]', err.message);
    return null;
  }
}

// ============================================================================
// 拍照按鈕：開啟相機
// ============================================================================
async function handleCameraClick() {
  await withCameraErrorHandling(
    async () => {
      showProgress('📷開啟相機中…', 0);

      if (!camera) {
        camera = new Camera();
      }

      await camera.start();

      // 隱藏按鈕，顯示提示
      showProgress('📷 相機已開啟，請按下「拍照」按鈕拍攝商品', 100);
      setTimeout(() => {
        hideProgress();
        // 提示使用者截圖
        showToast('請拍攝商品或價格標籤');
      }, 1500);
    },
    {
      onError: (err, msg) => {
        hideProgress();
        showToast(msg || '無法開啟相機');
      },
    }
  );
}

// ============================================================================
// 相簿選取：從相簿載入圖片
// ============================================================================
async function handleGallerySelect(file) {
  if (!file) return;

  await withCameraErrorHandling(
    async () => {
      showProgress('🖼️ 處理圖片中…', 30);

      if (!camera) {
        camera = new Camera();
      }

      const result = await camera.loadFromFile(file);
      currentImageData = result;

      showProgress('🖼️ 圖片已載入', 100);
      showPreview(result);
    },
    {
      onError: (err, msg) => {
        hideProgress();
        showToast(msg || '圖片處理失敗');
      },
    }
  );
}

// ============================================================================
// 拍照截圖
// ============================================================================
async function handleCapture() {
  if (!camera || !camera.isActive()) {
    showToast('請先開啟相機');
    return;
  }

  await withCameraErrorHandling(
    async () => {
      showProgress('📸 拍攝中…', 50);

      const result = await camera.capture();
      currentImageData = result;

      showProgress('📸 拍攝完成', 100);
      showPreview(result);

      // 停止相機
      camera.stop();
    },
    {
      onError: (err, msg) => {
        hideProgress();
        showToast(msg || '拍攝失敗');
      },
    }
  );
}

// ============================================================================
// 加入購物車
// ============================================================================
async function handleAddToCart() {
  if (!currentImageData) {
    showToast('請先選擇或拍攝圖片');
    return;
  }

  showProgress('🛒 加入購物車中…', 50);

  try {
    // 呼叫後端 API 進行 VLM 辨識
    const formData = new FormData();
    //將 base64 轉回 Blob
    const byteString = atob(currentImageData.base64.split(',')[1]);
    const mimeType = currentImageData.base64.match(/data:([^;]+);/)?.[1] || 'image/jpeg';
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: mimeType });
    formData.append('image', blob, 'capture.jpg');
    formData.append('fingerprint', app.state.fingerprint);

    const response = await fetch('/api/capture', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (data.success) {
      // 後端已寫入 DB，這裡只是本機 UI 更新
      cart.addItem({
        name: data.item.name,
        price: data.item.price,
        currency: data.item.currency,
        confidence: data.item.confidence,
        parseMethod: data.item.parseMethod,
      });

      showResult({
        success: true,
        item: data.item,
        vlm: data.vlm,
      });

      // 清除預覽
      resetPreview();
      showToast(`✅ ${data.item.name} 已加入購物車`);
    } else {
      showResult({
        success: false,
        error: data.error,
      });
 }
  } catch (err) {
    console.error('[App] 加入購物車失敗', err);
    showResult({
      success: false,
      error: { message: err.message },
    });
  } finally {
    hideProgress();
  }
}

// ============================================================================
// UI顯示函式
// ============================================================================

/**
 * 顯示預覽區塊
 */
function showPreview(imageData) {
  const preview = $('capture-preview');
  const canvas = $('preview-canvas');
  const info = $('preview-info');
  const buttons = $('capture-buttons');

  if (!preview || !canvas) return;

  //繪製圖片到 canvas
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.onload = () => {
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    ctx.drawImage(img, 0, 0, imageData.width, imageData.height);
  };
  img.src = imageData.base64;

  //顯示資訊
  if (info) {
    info.textContent = `${imageData.width}×${imageData.height} · ${formatBytes(imageData.bytes)}`;
  }

  // 切換顯示
  if (buttons) buttons.style.display = 'none';
  preview.style.display = 'flex';
}

/**
 * 重置預覽區塊
 */
function resetPreview() {
  const preview = $('capture-preview');
  const buttons = $('capture-buttons');
  const canvas = $('preview-canvas');
  const result = $('capture-result');

  if (preview) preview.style.display = 'none';
  if (buttons) buttons.style.display = 'flex';
  if (result) result.style.display = 'none';
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  currentImageData = null;
}

/**
 * 顯示處理進度
 */
function showProgress(text, percent) {
  const progress = $('capture-progress');
  const progressText = $('capture-progress-text');
  const progressFill = $('capture-progress-fill');

  if (progress) progress.style.display = 'block';
  if (progressText) progressText.textContent = text;
  if (progressFill) progressFill.style.width = `${percent}%`;
}

/**
 * 隱藏處理進度
 */
function hideProgress() {
  const progress = $('capture-progress');
  if (progress) progress.style.display = 'none';
}

/**
 * 顯示辨識結果
 */
function showResult({ success, item, error, vlm }) {
  const result = $('capture-result');
  if (!result) return;

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
    `;
  } else {
    result.innerHTML = `
      <div class="result-card result-error">
        <h4>❌ 辨識失敗</h4>
        <p>${escapeHtml(error?.message || '未知錯誤')}</p>
        ${error?.code ? `<p class="result-error-code">錯誤碼：${escapeHtml(error.code)}</p>` : ''}
      </div>
    `;
  }
  result.style.display = 'block';
}

/**
 * 顯示 Toast 提示
 */
function showToast(message) {
  const existing = document.querySelector('.error-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'error-toast';
  toast.textContent = message;
  toast.setAttribute('role', 'alert');
  document.body.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, 3000);
}

/**
 * 格式化位元組
 */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * HTML跳脫（防 XSS）
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#39;');
}

// ============================================================================
// 購物車 UI 渲染
// ============================================================================

/**
 * 渲染購物車列表
 */
function renderCart() {
  const listEl = $('item-list');
  const summaryEl = $('cart-summary');
  const summaryRowsEl = $('summary-rows');
  if (!listEl) return;

  const items = cart.getItems();
  const summary = cart.getSummary();

  if (items.length === 0) {
    listEl.innerHTML = '<div class="item-list-empty">🛒 購物車是空的，去拍個商品吧！</div>';
    if (summaryEl) summaryEl.style.display = 'none';
    return;
  }

  listEl.innerHTML = items
    .map(
      (item) => `
 <div class="cart-item" data-id="${item.id}">
      <div class="cart-item-emoji">📦</div>
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
    .join('');

  // 綁定刪除事件
  listEl.querySelectorAll('.btn-item-delete').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      if (confirm('確定要刪除此商品嗎？')) {
        cart.removeItem(id);
        renderCart();
      }
    });
  });

  // 渲染總計
  if (summaryEl && summaryRowsEl) {
    if (summary.currencySummaries.length > 0) {
      summaryEl.style.display = 'block';
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
        .join('');

      // TWD 總額特別標示
      summaryRowsEl.innerHTML += `
        <div class="summary-row" style="margin-top:8px;padding-top:8px;border-top:2px solid var(--black);">
          <span class="summary-currency">💰 TWD</span>
          <span class="summary-count">合計</span>
          <span class="summary-amount">${formatPrice(summary.totalTWD, 'TWD')}</span>
        </div>
      `;
    } else {
      summaryEl.style.display = 'none';
    }
  }
}

// ============================================================================
// 匯率顯示
// ============================================================================

/**
 * 更新匯率顯示
 */
function updateExchangeRates() {
  const rates = cart.getRates();
  const rateUsd = $('rate-usd');
  const rateJpy = $('rate-jpy');
  const rateEur = $('rate-eur');

  if (rateUsd) rateUsd.textContent = rates.USD?.toFixed(4) || '--';
  if (rateJpy) rateJpy.textContent = rates.JPY?.toFixed(4) || '--';
  if (rateEur) rateEur.textContent = rates.EUR?.toFixed(4) || '--';
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
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.success && data.rates) {
      cart.updateRates(data.rates);
      updateExchangeRates();
      console.log('[App] 匯率已更新', data.rates);
    }
  } catch (err) {
    console.warn('[App] 匯率抓取失敗，使用預設值', err.message);
    // 使用 Cart內建預設值
    cart.updateRates({
      USD: 1,
      TWD: 31.5,
      JPY: 0.21,
      EUR: 0.91,
    });
    updateExchangeRates();
  }
}

// ============================================================================
// 初始化
// ============================================================================
async function initApp() {
  console.log('🛒 Supermarket Tracker 啟動中…');

  // 初始化購物車
  cart = new Cart(app.state.fingerprint);

  // 訂閱購物車事件（自動更新 UI）
  onCartEvent('cart:item-added', renderCart);
  onCartEvent('cart:item-removed', renderCart);
  onCartEvent('cart:cleared', renderCart);
  onCartEvent('cart:loaded', renderCart);

  // 首次健康檢查
  const health = await checkHealth();
  app.state.isOnline = health !== null;
  app.state.serverInfo = health;
  updateStatusIndicator(app.state.isOnline, health);

  // 定期健康檢查
  setInterval(async () => {
    const result = await checkHealth();
    const wasOnline = app.state.isOnline;
    app.state.isOnline = result !== null;
    app.state.serverInfo = result;
    if (wasOnline !== app.state.isOnline || app.state.isOnline) {
      updateStatusIndicator(app.state.isOnline, result);
    }
  }, app.config.healthcheckInterval);

  // 初始化相機實例
  camera = new Camera();

  // 渲染初始 UI
  renderCart();

  // 抓取匯率並更新購物車
  fetchRates();

  // ============================================================================
  //事件綁定
  // ============================================================================

  // 📷拍照按鈕：開啟相機
  const btnCameraTrigger = $('btn-camera-trigger');
  if (btnCameraTrigger) {
    btnCameraTrigger.addEventListener('click', handleCameraClick);
  }

  // 🖼️ 相簿選取
  const inputGallery = $('input-gallery');
  if (inputGallery) {
    inputGallery.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) handleGallerySelect(file);
    });
  }

  // 📁 上傳檔案
  const inputUpload = $('input-upload');
  if (inputUpload) {
    inputUpload.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) handleGallerySelect(file);
    });
  }

  // 🔄 重選按鈕
  const btnRetake = $('btn-retake');
  if (btnRetake) {
    btnRetake.addEventListener('click', () => {
      if (camera && camera.isActive()) {
        camera.stop();
      }
      resetPreview();
      hideProgress();
    });
  }

  // 🛒 加入購物車按鈕
  const btnAddCart = $('btn-add-cart');
  if (btnAddCart) {
    btnAddCart.addEventListener('click', handleAddToCart);
  }

  // 🔄 重新整理購物車
  const btnRefreshCart = $('btn-refresh-cart');
  if (btnRefreshCart) {
    btnRefreshCart.addEventListener('click', () => {
      cart._load();
      renderCart();
      showToast('已重新整理');
    });
  }

  // 🗑️ 清空購物車
  const btnClearCart = $('btn-clear-cart');
  if (btnClearCart) {
    btnClearCart.addEventListener('click', () => {
      if (confirm('確定要清空購物車嗎？此操作無法復原。')) {
        cart.clearAll();
        renderCart();
        showToast('購物車已清空');
      }
    });
  }

  // 💥 結帳按鈕
  const btnCheckout = $('btn-checkout');
  if (btnCheckout) {
    btnCheckout.addEventListener('click', () => {
      const summary = cart.getSummary();
      if (summary.items.length === 0) {
        showToast('購物車是空的，無法結帳');
        return;
      }
      alert(
        `🧾 結帳總金額\n` +
          summary.currencySummaries.map((s) => `${s.currency}: ${formatPrice(s.total, s.currency)}`).join('\n') +
          `\n💰 新台幣合計：${formatPrice(summary.totalTWD, 'TWD')}`
      );
    });
  }

  // 掛載全域物件
  window.app = app;

  console.log('✅ Supermarket Tracker 初始化完成', {
    isOnline: app.state.isOnline,
    fingerprint: app.state.fingerprint,
  });
}

// ============================================================================
// 啟動
// ============================================================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

//錯誤捕獲
window.addEventListener('error', (e) => {
  console.error('[App] 全域錯誤', {
    message: e.message,
    filename: e.filename,
    line: e.lineno,
  });
});

export { app };
