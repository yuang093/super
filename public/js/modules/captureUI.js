// 🤖 public/js/modules/captureUI.js
// 拍照 UI：相機/相簿選擇、預覽、上傳、結果顯示
// 對應 [todo_progress.md F-04](../../todo_progress.md)

'use strict';

import { Camera } from './camera.js';
import { uploadImage } from './uploadService.js';

/**
 * 初始化拍照 UI
 * @param {HTMLElement} container - 拍照卡片容器
 */
export function initCaptureUI(container) {
  if (!container) {
    console.warn('[CaptureUI] 找不到容器，略過初始化');
    return;
  }

  container.innerHTML = `
    <div class="capture-stage" id="capture-stage">
      <video id="camera-video" autoplay playsinline muted
             style="display:none; max-width:100%; border-radius:12px; border:3px solid var(--black);"></video>
      <canvas id="camera-canvas" style="display:none;"></canvas>
      <div class="capture-buttons" id="capture-buttons">
        <button id="btn-open-camera" class="btn-capture-action" type="button">
          <span class="btn-icon">📷</span>
          <span>開啟相機</span>
        </button>
        <button id="btn-select-gallery" class="btn-capture-action btn-capture-alt" type="button">
          <span class="btn-icon">🖼️</span>
          <span>從相簿選</span>
        </button>
      </div>
      <div class="capture-shoot-area" id="capture-shoot-area" style="display:none;">
        <button id="btn-shoot" class="btn-shoot" type="button" aria-label="拍攝">
          <span class="shoot-icon">📸</span>
        </button>
        <p class="shoot-hint">輕觸拍攝</p>
      </div>
      <div class="capture-preview" id="capture-preview" style="display:none;">
        <img id="preview-img" alt="預覽" class="preview-img">
        <div class="preview-info" id="preview-info"></div>
        <div class="preview-actions">
          <button id="btn-upload" class="btn-capture-primary" type="button">
            <span>✅ 上傳並辨識</span>
          </button>
          <button id="btn-retake" class="btn-capture-action" type="button">
            <span>🔄 重拍</span>
          </button>
        </div>
      </div>
      <div class="capture-progress" id="capture-progress" style="display:none;">
        <div class="progress-text" id="capture-progress-text">⏳ 上傳中...</div>
        <div class="progress-bar-track">
          <div class="progress-bar-fill" id="capture-progress-fill"></div>
        </div>
      </div>
      <div class="capture-result" id="capture-result" style="display:none;"></div>
    </div>
  `;

  // 取得 DOM 元素
  const video = document.getElementById('camera-video');
  const buttons = document.getElementById('capture-buttons');
  const shootArea = document.getElementById('capture-shoot-area');
  const preview = document.getElementById('capture-preview');
  const previewImg = document.getElementById('preview-img');
  const previewInfo = document.getElementById('preview-info');
  const progress = document.getElementById('capture-progress');
  const progressText = document.getElementById('capture-progress-text');
  const progressFill = document.getElementById('capture-progress-fill');
  const result = document.getElementById('capture-result');

  const camera = new Camera(video);
  let currentBlob = null;
  let previewUrl = null;

  // === 開啟相機 ===
  document.getElementById('btn-open-camera').addEventListener('click', async () => {
    if (!Camera.isSupported()) {
      alert('您的瀏覽器不支援相機存取，請使用「從相簿選」');
      return;
    }
    const ok = await camera.start();
    if (ok) {
      video.style.display = 'block';
      buttons.style.display = 'none';
      shootArea.style.display = 'block';
    } else {
      alert('無法存取相機，請檢查權限或使用「從相簿選」');
    }
  });

  // === 拍攝 ===
  document.getElementById('btn-shoot').addEventListener('click', async () => {
    try {
      currentBlob = await camera.capture(0.85);
      previewUrl = URL.createObjectURL(currentBlob);
      previewImg.src = previewUrl;
      previewInfo.textContent = `${currentBlob.type || 'image/jpeg'} · ${formatSize(currentBlob.size)}`;

      // 切換到預覽
      video.style.display = 'none';
      shootArea.style.display = 'none';
      preview.style.display = 'block';
      camera.stop();
    } catch (err) {
      console.error('[CaptureUI] 拍照失敗', err);
      alert('拍照失敗：' + err.message);
    }
  });

  // === 從相簿選 ===
  document.getElementById('btn-select-gallery').addEventListener('click', async () => {
    try {
      const file = await camera.selectFromGallery();
      currentBlob = file;
      previewUrl = URL.createObjectURL(file);
      previewImg.src = previewUrl;
      previewInfo.textContent = `${file.type || 'image/jpeg'} · ${formatSize(file.size)} · ${file.name || 'gallery'}`;

      buttons.style.display = 'none';
      preview.style.display = 'block';
    } catch (err) {
      if (err.message !== '未選擇檔案') {
        console.error('[CaptureUI] 選擇失敗', err);
        alert('選擇檔案失敗：' + err.message);
      }
    }
  });

  // === 上傳 ===
  document.getElementById('btn-upload').addEventListener('click', async () => {
    if (!currentBlob) return;

    preview.style.display = 'none';
    progress.style.display = 'block';
    progressText.textContent = '⏳ 上傳中…';
    progressFill.style.width = '0%';

    try {
      const data = await uploadImage(currentBlob, {
        fingerprint: window.app?.state?.fingerprint || 'anonymous',
        onProgress: (percent) => {
          progressFill.style.width = `${percent}%`;
          progressText.textContent = `⏳ 上傳中… ${percent}%`;
        },
      });

      progress.style.display = 'none';
      result.style.display = 'block';

      if (data.success) {
        result.innerHTML = `
          <div class="result-card result-success">
            <h4>✅ 辨識成功！</h4>
            <div class="result-grid">
              <div class="result-label">商品</div>
              <div class="result-value">${escapeHtml(data.item.name)}</div>
              <div class="result-label">價格</div>
              <div class="result-value">${escapeHtml(data.item.currency)} ${data.item.price}</div>
              <div class="result-label">信心度</div>
              <div class="result-value">${(data.item.confidence * 100).toFixed(0)}%</div>
              <div class="result-label">解析方式</div>
              <div class="result-value">${data.item.parseMethod}</div>
              <div class="result-label">VLM 嘗試</div>
              <div class="result-value">${data.vlm.attempts} 次（${data.vlm.latencyMs}ms）</div>
            </div>
            <p class="result-action-hint">🛒 已自動加入購物車</p>
            <button id="btn-capture-again" class="btn-capture-action" type="button">📷 再拍一張</button>
          </div>
        `;
        document.getElementById('btn-capture-again').addEventListener('click', reset);
      } else {
        result.innerHTML = `
          <div class="result-card result-error">
            <h4>❌ 辨識失敗</h4>
            <p>${escapeHtml(data.error?.message || '未知錯誤')}</p>
            <p class="result-error-code">錯誤碼：${escapeHtml(data.error?.code || 'UNKNOWN')}</p>
            <button id="btn-capture-again" class="btn-capture-action" type="button">🔄 重試</button>
          </div>
        `;
        document.getElementById('btn-capture-again').addEventListener('click', reset);
      }
    } catch (err) {
      progress.style.display = 'none';
      result.style.display = 'block';
      result.innerHTML = `
        <div class="result-card result-error">
          <h4>❌ 上傳失敗</h4>
          <p>${escapeHtml(err.message)}</p>
          ${err.code ? `<p class="result-error-code">錯誤碼：${escapeHtml(err.code)}</p>` : ''}
          <button id="btn-capture-again" class="btn-capture-action" type="button">🔄 重試</button>
        </div>
      `;
      document.getElementById('btn-capture-again').addEventListener('click', reset);
    }
  });

  // === 重拍 ===
  document.getElementById('btn-retake').addEventListener('click', reset);

  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    currentBlob = null;
    previewUrl = null;
    preview.style.display = 'none';
    result.style.display = 'none';
    progress.style.display = 'none';
    buttons.style.display = 'flex';
    camera.stop();
  }
}

/**
 * 格式化檔案大小
 */
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * HTML 跳脫（防 XSS）
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
