// 🤖 public/js/modules/modelLoader.js
// TensorFlow.js MobileNet 模型載入器（含 IndexedDB 快取、重試機制）
// 對應 [todo_progress.md F-02](../../todo_progress.md) 與 [PROJECT_CONTEXT.md §4](../../PROJECT_CONTEXT.md)

'use strict';

import { getModelMeta, saveModelMeta } from './cacheManager.js';

/** MobileNet 模型識別 key（用於 IndexedDB） */
const MODEL_KEY = 'mobilenet_v2_1.0_224';

/** 最大重試次數 */
const MAX_RETRIES = 3;

/** 重試延遲（毫秒） */
const RETRY_DELAY_BASE_MS = 1000;

/**
 * 載入 MobileNet 模型（帶重試與進度回呼）
 * @param {Function} [progressCallback] - 進度回呼 ({stage, percent, message})
 * @returns {Promise<Object>} - {model, loadTimeMs, fromCache}
 */
export async function loadMobileNetWithRetry(progressCallback) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await loadMobileNet(progressCallback, attempt);
    } catch (err) {
      lastError = err;
      console.warn(`[ModelLoader] 第 ${attempt}/${MAX_RETRIES} 次失敗：${err.message}`);
      if (progressCallback) {
        progressCallback({
          stage: 'retry',
          percent: 0,
          message: `重試 ${attempt}/${MAX_RETRIES}…`,
        });
      }
      if (attempt < MAX_RETRIES) {
        // 指數退避：第 1 次失敗等 1s，第 2 次失敗等 2s
        await sleep(RETRY_DELAY_BASE_MS * attempt);
      }
    }
  }
  throw new Error(`模型載入失敗（已重試 ${MAX_RETRIES} 次）：${lastError?.message || '未知錯誤'}`);
}

/**
 * 載入模型（單次嘗試）
 * @param {Function} progressCallback
 * @param {number} attempt
 * @returns {Promise<Object>}
 */
async function loadMobileNet(progressCallback, attempt) {
  if (progressCallback) {
    progressCallback({ stage: 'init', percent: 0, message: '初始化 TensorFlow.js…' });
  }

  // === 步驟 1：動態載入 TF.js 與 MobileNet（避免阻塞主執行緒） ===
  // 注意：若使用 npm 安裝並打包，可改為 import 靜態引入。
  //       目前使用 CDN 動態載入（簡化、無需建置工具）。
  const tf = await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js', 'tf');
  const mobilenet = await loadScript(
    'https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js',
    'mobilenet'
  );

  if (!tf || !mobilenet) {
    throw new Error('TensorFlow.js 或 MobileNet 函式庫未正確載入');
  }

  if (progressCallback) {
    progressCallback({ stage: 'check-cache', percent: 20, message: '檢查本地快取…' });
  }

  // === 步驟 2：檢查 IndexedDB 中是否已有快取記錄 ===
  const cachedMeta = await getModelMeta(MODEL_KEY);
  const fromCache = Boolean(cachedMeta);

  if (progressCallback) {
    progressCallback({
      stage: 'loading',
      percent: 40,
      message: fromCache ? '從快取載入模型權重…' : '下載 MobileNet 模型（首次較慢）…',
    });
  }

  // === 步驟 3：載入模型（TF.js 會自動用 IndexedDB 快取權重） ===
  const loadStart = performance.now();
  const model = await mobilenet.load({
    version: 2,
    alpha: 1.0,
  });
  const loadTimeMs = performance.now() - loadStart;

  if (progressCallback) {
    progressCallback({
      stage: 'ready',
      percent: 100,
      message: `模型就緒（載入耗時 ${Math.round(loadTimeMs)}ms）`,
    });
  }

  // === 步驟 4：寫入快取 metadata（供下次顯示） ===
  await saveModelMeta(MODEL_KEY, {
    version: '2.1.0',
    alpha: 1.0,
    loadTimeMs,
    fromCache,
    attempt,
  });

  return { model, loadTimeMs, fromCache };
}

/**
 * 動態載入 script（避免重複載入）
 * @param {string} src
 * @param {string} globalKey - 載入後的全域變數名稱
 * @returns {Promise<Object>}
 */
function loadScript(src, globalKey) {
  return new Promise((resolve, reject) => {
    // 若已存在則直接回傳
    if (window[globalKey]) {
      resolve(window[globalKey]);
      return;
    }

    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(window[globalKey]));
      existing.addEventListener('error', () => reject(new Error(`Script 載入失敗：${src}`)));
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve(window[globalKey]);
    script.onerror = () => reject(new Error(`Script 載入失敗：${src}`));
    document.head.appendChild(script);
  });
}

/**
 * 延遲工具
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
