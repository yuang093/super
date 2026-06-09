// 🤖 public/js/modules/captureUI.js
// 拍照 UI：使用「可見的」file input 確保所有裝置都能運作
// 對應 [todo_progress.md F-04](../../todo_progress.md)

'use strict'

import { uploadImage } from './uploadService.js'

/**
 * 初始化拍照 UI
 * @param {HTMLElement} container - 拍照卡片容器
 */
export function initCaptureUI(container) {
  if (!container) {
    console.warn('[CaptureUI] 找不到容器，略過初始化')
    return
  }

  console.log('[CaptureUI] 開始初始化...')

  // 使用可見的 file input（關鍵改動！之前用 display: none 隱藏，某些瀏覽器會忽略）
  // 同時保留 capture 屬性的雙重按鈕：相機模式 + 相簿模式
  container.innerHTML = `
    <div class="capture-stage" id="capture-stage">
      <video id="camera-video" autoplay playsinline muted
             style="display:none; max-width:100%; border-radius:12px; border:3px solid var(--black);"></video>

      <!-- 三個可見的 file input 按鈕（不同 capture 模式）-->
      <div class="capture-buttons" id="capture-buttons">
        <label class="btn-capture-action" for="file-input-camera">
          <span class="btn-icon">📷</span>
          <span>拍照</span>
        </label>
        <input type="file" id="file-input-camera" accept="image/*" capture="environment"
               style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;">

        <label class="btn-capture-action btn-capture-alt" for="file-input-gallery">
          <span class="btn-icon">🖼️</span>
          <span>從相簿選</span>
        </label>
        <input type="file" id="file-input-gallery" accept="image/*"
               style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;">

        <label class="btn-capture-action btn-capture-alt2" for="file-input-any">
          <span class="btn-icon">📁</span>
          <span>上傳檔案</span>
        </label>
        <input type="file" id="file-input-any" accept="image/jpeg,image/png,image/webp"
               style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;">
      </div>

      <div class="capture-preview" id="capture-preview" style="display:none;">
        <img id="preview-img" alt="預覽" class="preview-img">
        <div class="preview-info" id="preview-info"></div>
        <div class="preview-actions">
          <button id="btn-upload" class="btn-capture-primary" type="button">
            <span>✅ 上傳並辨識</span>
          </button>
          <button id="btn-retake" class="btn-capture-action" type="button">
            <span>🔄 重選</span>
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
  `

  // 取得 DOM 元素
  const fileInputCamera = document.getElementById('file-input-camera')
  const fileInputGallery = document.getElementById('file-input-gallery')
  const fileInputAny = document.getElementById('file-input-any')
  const preview = document.getElementById('capture-preview')
  const previewImg = document.getElementById('preview-img')
  const previewInfo = document.getElementById('preview-info')
  const progress = document.getElementById('capture-progress')
  const progressText = document.getElementById('capture-progress-text')
  const progressFill = document.getElementById('capture-progress-fill')
  const result = document.getElementById('capture-result')

  let currentBlob = null
  let previewUrl = null

  // 統一處理三個 file input 的 change 事件
  function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) {
      console.warn('[CaptureUI] 沒有選擇檔案')
      return
    }
    console.log('[CaptureUI] 選擇檔案', {
      name: file.name,
      type: file.type,
      size: file.size,
    })
    showPreview(file)
  }

  fileInputCamera.addEventListener('change', handleFileSelect)
  fileInputGallery.addEventListener('change', handleFileSelect)
  fileInputAny.addEventListener('change', handleFileSelect)

  function showPreview(file) {
    currentBlob = file
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    previewUrl = URL.createObjectURL(file)
    previewImg.src = previewUrl
    previewInfo.textContent = `${file.type || 'image/jpeg'} · ${formatSize(file.size)} · ${file.name || 'capture'}`

    document.getElementById('capture-buttons').style.display = 'none'
    preview.style.display = 'block'
    result.style.display = 'none'
  }

  // 上傳
  document.getElementById('btn-upload').addEventListener('click', async () => {
    if (!currentBlob) {
      console.warn('[CaptureUI] 沒有檔案可上傳')
      return
    }

    preview.style.display = 'none'
    progress.style.display = 'block'
    progressText.textContent = '⏳ 上傳中…'
    progressFill.style.width = '0%'

    try {
      const data = await uploadImage(currentBlob, {
        fingerprint: window.app?.state?.fingerprint || 'anonymous',
        onProgress: (percent) => {
          progressFill.style.width = `${percent}%`
          progressText.textContent = `⏳ 上傳中… ${percent}%`
        },
      })

      progress.style.display = 'none'
      result.style.display = 'block'

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
              <div class="result-value">${escapeHtml(data.item.parseMethod)}</div>
              <div class="result-label">VLM 嘗試</div>
              <div class="result-value">${data.vlm.attempts} 次（${data.vlm.latencyMs}ms）</div>
            </div>
            <p class="result-action-hint">🛒 已自動加入購物車</p>
            <button id="btn-capture-again" class="btn-capture-action" type="button">📷 再拍一張</button>
          </div>
        `
      } else {
        result.innerHTML = `
          <div class="result-card result-error">
            <h4>❌ 辨識失敗</h4>
            <p>${escapeHtml(data.error?.message || '未知錯誤')}</p>
            <p class="result-error-code">錯誤碼：${escapeHtml(data.error?.code || 'UNKNOWN')}</p>
            <button id="btn-capture-again" class="btn-capture-action" type="button">🔄 重試</button>
          </div>
        `
      }
      document.getElementById('btn-capture-again').addEventListener('click', reset)
    } catch (err) {
      console.error('[CaptureUI] 上傳失敗', err)
      progress.style.display = 'none'
      result.style.display = 'block'
      result.innerHTML = `
        <div class="result-card result-error">
          <h4>❌ 上傳失敗</h4>
          <p>${escapeHtml(err.message)}</p>
          ${err.code ? `<p class="result-error-code">錯誤碼：${escapeHtml(err.code)}</p>` : ''}
          <button id="btn-capture-again" class="btn-capture-action" type="button">🔄 重試</button>
        </div>
      `
      document.getElementById('btn-capture-again').addEventListener('click', reset)
    }
  })

  // 重選
  document.getElementById('btn-retake').addEventListener('click', reset)

  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    currentBlob = null
    previewUrl = null
    preview.style.display = 'none'
    result.style.display = 'none'
    progress.style.display = 'none'
    document.getElementById('capture-buttons').style.display = 'flex'
    // 清空所有 file input
    ;[fileInputCamera, fileInputGallery, fileInputAny].forEach((input) => {
      input.value = ''
    })
  }

  console.log('[CaptureUI] 初始化完成 ✅')
  console.log(
    '[CaptureUI] 安全環境:',
    window.isSecureContext
      ? '✅ HTTPS'
      : '❌ 非 HTTPS（getUserMedia 將不可用，但 file input 仍可用）'
  )
  console.log(
    '[CaptureUI] 行動裝置:',
    /Mobi|Android/i.test(navigator.userAgent) ? '✅ 是' : '❌ 否'
  )
}

/**
 * 格式化檔案大小
 */
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

/**
 * HTML 跳脫（防 XSS）
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
