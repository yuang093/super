// 🤖 public/js/app.js
// Supermarket Tracker 前端入口（ES Module）
// F-01 階段職責：健康檢查狀態顯示、後續模組掛載點
// F-02 階段職責：整合 TF.js MobileNet 載入

'use strict';

console.log('[App] 開始載入 app.js...');

import { createProgressBar } from './modules/progressBar.js';
import { loadMobileNetWithRetry } from './modules/modelLoader.js';
import { initCaptureUI } from './modules/captureUI.js';
import { initItemList } from './modules/itemList.js';

console.log('[App] ES Module imports 載入完成');

/**
 * 全域應用物件（命名空間）
 */
const app = {
  config: {
    apiBase: '',
    healthcheckInterval: 30_000,
  },
  state: {
    isOnline: false,
    serverInfo: null,
    modelLoaded: false,
    modelInfo: null,
    fingerprint: generateFingerprint(),
  },
  modules: {},
};

console.log('[App] app 物件建立完成', {
  isSecureContext: window.isSecureContext,
  userAgent: navigator.userAgent.substring(0, 80),
});

/**
 * 產生臨時 fingerprint（用於購物車資料綁定）
 * 注意：實際生產環境應從 IP + IP_SALT 計算 SHA-256
 * 這裡使用 localStorage 中的隨機 ID 作為簡化版
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

/**
 * 呼叫後端健康檢查端點
 * @returns {Promise<Object|null>} 健康檢查結果，失敗時回傳 null
 */
async function checkHealth() {
  try {
    const response = await fetch(`${app.config.apiBase}/healthz`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      // 5 秒逾時保護
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    console.warn('[健康檢查失敗]', err.message);
    return null;
  }
}

/**
 * 更新頁面上的服務狀態指示器（B 風格版）
 * @param {boolean} isOnline
 * @param {Object} [serverInfo]
 */
function updateStatusIndicator(isOnline, serverInfo = null) {
  const dot = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  const status = document.getElementById('app-status');

  if (!dot || !text || !status) {
    console.warn('[狀態指示器] 找不到 DOM 元素');
    return;
  }

  if (isOnline) {
    status.classList.remove('offline');
  } else {
    status.classList.add('offline');
  }

  if (isOnline && serverInfo) {
    const uptime = serverInfo.uptimeHuman || `${serverInfo.uptime}s`;
    text.textContent = `已連線 · ${serverInfo.env} 環境 · 運行 ${uptime} · v${serverInfo.version}`;
  } else {
    text.textContent = '離線 · 請檢查網路連線';
  }
}

/**
 * 初始化應用（DOMContentLoaded 時執行）
 */
async function initApp() {
  console.log('🛒 Supermarket Tracker 啟動中…');

  // 步驟 1：執行首次健康檢查
  const health = await checkHealth();
  app.state.isOnline = health !== null;
  app.state.serverInfo = health;
  updateStatusIndicator(app.state.isOnline, health);

  // 步驟 2：註冊定期健康檢查
  setInterval(async () => {
    const result = await checkHealth();
    const wasOnline = app.state.isOnline;
    app.state.isOnline = result !== null;
    app.state.serverInfo = result;

    // 僅在狀態變化時更新 DOM（避免不必要的重排）
    if (wasOnline !== app.state.isOnline || app.state.isOnline) {
      updateStatusIndicator(app.state.isOnline, result);
    }
  }, app.config.healthcheckInterval);

  // 步驟 3：載入 TF.js MobileNet 模型（F-02，背景執行不阻塞 UI）
  loadModelInBackground();

  // 步驟 4：初始化拍照 UI（F-04）
  const captureArea = document.getElementById('capture-area');
  initCaptureUI(captureArea);

  // 步驟 5：初始化購物車 UI（F-06）
  const cartList = document.getElementById('cart-list');
  initItemList(cartList);

  // 步驟 6：掛載全域物件供其他模組使用
  window.app = app;

  console.log('✅ Supermarket Tracker 初始化完成', {
    isOnline: app.state.isOnline,
    version: app.state.serverInfo?.version || 'unknown',
  });
}

/**
 * 背景載入 MobileNet 模型（不阻塞主 UI）
 */
async function loadModelInBackground() {
  const container = document.getElementById('model-progress');
  const label = document.getElementById('model-progress-label');
  const fill = document.getElementById('model-progress-fill');

  if (!container || !label || !fill) {
    console.warn('[ModelLoader] 找不到進度條元素，略過載入');
    return;
  }

  const progressBar = createProgressBar({ container, label, fill });

  try {
    progressBar.update(0, '準備載入 MobileNet 模型…');

    const result = await loadMobileNetWithRetry((status) => {
      progressBar.update(status.percent || 0, status.message);
    });

    progressBar.complete(`✅ 模型就緒（耗時 ${Math.round(result.loadTimeMs)}ms）`);
    app.state.modelLoaded = true;
    app.state.modelInfo = {
      loadTimeMs: result.loadTimeMs,
      fromCache: result.fromCache,
    };

    console.log('[ModelLoader] MobileNet 載入成功', app.state.modelInfo);
  } catch (err) {
    progressBar.error(err.message);
    console.error('[ModelLoader] MobileNet 載入失敗', err);
    // 不影響主功能運作，僅拍照辨識功能不可用
  }
}

// === 啟動 ===
console.log('[App] document.readyState:', document.readyState);
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[App] DOMContentLoaded 觸發，開始初始化');
    initApp();
  });
} else {
  console.log('[App] DOM 已就緒，立即初始化');
  initApp();
}

// 錯誤捕獲：若 ES Module 載入失敗，全域錯誤處理
window.addEventListener('error', (e) => {
  console.error('[App] 全域錯誤', {
    message: e.message,
    filename: e.filename,
    line: e.lineno,
    col: e.colno,
  });
});

// === 對外匯出（供其他模組 ES Module 引入）===
export { app, checkHealth, updateStatusIndicator, loadModelInBackground };
