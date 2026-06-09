// 🤖 public/js/camera.js
// 相機模組：getUserMedia 開啟後鏡頭、拍照截圖、從相簿載入
// 對應 [todo_progress.md F-05]
//錯誤處理：NotAllowedError、NotFoundError、NotReadableError

'use strict';

import { processImageBlob } from './image-pipeline.js';

/**
 * 錯誤代碼對應的友善提示訊息
 */
const ERROR_MESSAGES = {
  NotAllowedError: '相機權限被拒絕。請在瀏覽器設定中允許相機使用。',
  NotFoundError: '找不到相機。請確認您的裝置有後鏡頭。',
  NotReadableError: '相機無法讀取。請關閉其他使用相機的應用程式後再試。',
  OverconstrainedError: '相機規格不符合。請嘗試使用相簿選擇照片。',
  AbortError: '相機作業被中斷。',
  default: '無法開啟相機，請嘗試從相簿選擇照片。',
};

/**
 * 顯示錯誤提示（Toast 樣式）
 * @param {string} message -錯誤訊息
 */
function showErrorToast(message) {
  // 移除既有 toast
  const existing = document.querySelector('.error-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'error-toast';
  toast.textContent = message;
  toast.setAttribute('role', 'alert');
  document.body.appendChild(toast);

  // 3 秒後自動移除
  setTimeout(() => {
    if (toast.parentNode) {
      toast.remove();
    }
  }, 3000);
}

/**
 * 取得錯誤的友善訊息
 * @param {Error} err - 錯誤物件
 * @returns {string}
 */
function getFriendlyError(err) {
  if (err.name && ERROR_MESSAGES[err.name]) {
    return ERROR_MESSAGES[err.name];
  }
  if (err.message && err.message.includes('Permission')) {
    return ERROR_MESSAGES.NotAllowedError;
  }
  return ERROR_MESSAGES.default;
}

/**
 * Camera類別
 *  管理後鏡頭 getUserMedia 串流、拍照截圖、相簿載入
 */
export class Camera {
  /**
   * @param {Object} [options]
   * @param {string} [options.videoElementId='camera-video'] -影片元素 ID
   * @param {string} [options.canvasElementId='preview-canvas'] - Canvas 元素 ID
   */
  constructor(options = {}) {
    this.videoElementId = options.videoElementId || 'camera-video';
    this.canvasElementId = options.canvasElementId || 'preview-canvas';
    this._stream = null;
    this._video = null;
    this._canvas = null;
    this._ctx = null;
    this._isActive = false;
 }

  /**
   * 檢查相機是否可用
   * @returns {boolean}
   */
  isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  /**
   * 開啟後鏡頭
   * @returns {Promise<MediaStream>} - 成功時回傳媒體串流
   * @throws {Error} -權限被拒或無相機時拋出錯誤
   */
  async start() {
    if (!this.isSupported()) {
      throw new Error('您的瀏覽器不支援相機功能。請使用 Chrome、Safari 或 Firefox 最新版本。');
    }

    // 如果已有串流，先停止
    if (this._stream) {
      await this.stop();
    }

    try {
      this._stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      // 建立隱藏的 video元素
      this._video = document.createElement('video');
      this._video.id = this.videoElementId;
      this._video.setAttribute('autoplay', '');
      this._video.setAttribute('playsinline', '');
      this._video.setAttribute('muted', '');
      this._video.style.display = 'none';
      this._video.srcObject = this._stream;

      // 等待影片元載入完成
      await new Promise((resolve, reject) => {
        this._video.onloadedmetadata = () => {
          this._video.play().then(resolve).catch(reject);
        };
        this._video.onerror = () => reject(new Error('影片載入失敗'));
      });

      this._isActive = true;
      console.log('[Camera] 相機已啟動', {
        width: this._video.videoWidth,
        height: this._video.videoHeight,
      });

      return this._stream;
    } catch (err) {
      console.error('[Camera] 開啟相機失敗', err.name, err.message);
      throw err;
    }
  }

  /**
   * 停止相機串流
   */
  stop() {
    if (this._stream) {
      this._stream.getTracks().forEach((track) => {
        track.stop();
      });
      this._stream = null;
    }
    if (this._video) {
      this._video.srcObject = null;
      this._video.remove();
      this._video = null;
    }
    this._isActive = false;
    console.log('[Camera] 相機已停止');
  }

  /**
   * 從相簿選擇圖片（File input觸發）
   * @param {File} file - 圖片檔案
   * @returns {Promise<{blob: Blob, base64: string, width: number, height: number, bytes: number}>}
   */
  async loadFromFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      throw new Error('請選擇有效的圖片檔案。');
    }

    console.log('[Camera] 從相簿載入', {
      name: file.name,
      type: file.type,
      size: file.size,
    });

    // 停止相機（如果正在使用）
    if (this._isActive) {
      await this.stop();
    }

    // 執行影像處理管線（含 EXIF 修正 + 壓縮）
    const result = await processImageBlob(file);

    return {
      blob: file,
      base64: result.base64,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
    };
  }

  /**
   * 拍照截圖（從即時串流）
   * @returns {Promise<{blob: Blob, base64: string, width: number, height: number, bytes: number}>}
   */
  async capture() {
    if (!this._isActive || !this._video) {
      throw new Error('相機尚未啟動，無法拍照。');
    }

    const video = this._video;

    // 建立 Canvas 並截圖
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    // 轉為 Blob
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error('Canvas轉 Blob 失敗'));
        },
        'image/jpeg',
        0.95
      );
    });

    // 執行影像處理管線（含 EXIF 修正 + 壓縮）
    const result = await processImageBlob(blob);

    console.log('[Camera] 拍照完成', {
      originalSize: blob.size,
      compressedSize: result.bytes,
      dimensions: `${result.width}x${result.height}`,
    });

    return {
      blob,
      base64: result.base64,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
    };
  }

  /**
   * 取得目前串流是否正在使用
   * @returns {boolean}
   */
  isActive() {
    return this._isActive;
  }
}

/**
 * 全域錯誤處理：包裝 Camera 操作並顯示 Toast
 * @param {Function} fn - 非同步函式
 * @param {Object} callbacks - 回呼物件
 * @param {Function} callbacks.onStart - 開始時呼叫
 * @param {Function} callbacks.onSuccess - 成功時呼叫
 * @param {Function} callbacks.onError - 失敗時呼叫
 */
export async function withCameraErrorHandling(fn, callbacks = {}) {
  try {
    callbacks.onStart?.();
    return await fn();
  } catch (err) {
    const friendlyMessage = getFriendlyError(err);
    showErrorToast(friendlyMessage);
    callbacks.onError?.(err, friendlyMessage);
    return null;
  }
}
