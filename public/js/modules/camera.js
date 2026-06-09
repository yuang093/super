// 🤖 public/js/modules/camera.js
// 拍照模組：getUserMedia 相機呼叫 + 通用檔案選擇
// 對應 [todo_progress.md F-04](../../todo_progress.md)

'use strict'

/**
 * 相機類別
 * 注意：拍照功能只適用於有相機的裝置（手機/筆電）
 * 「上傳檔案」功能透過 file input 適用於所有裝置
 */
export class Camera {
  /**
   * @param {HTMLVideoElement} videoElement - 用於顯示相機預覽的 video 元素
   */
  constructor(videoElement) {
    if (!videoElement) {
      throw new Error('Camera 需要 video 元素')
    }
    this.video = videoElement
    this.stream = null
  }

  /**
   * 啟動相機（請求瀏覽器權限）
   * 注意：必須是 HTTPS 或 localhost 才能用 getUserMedia
   * @returns {Promise<boolean>} 成功與否
   */
  async start() {
    console.log('[Camera] 請求 getUserMedia 權限...')
    if (!navigator.mediaDevices?.getUserMedia) {
      console.error('[Camera] 瀏覽器不支援 getUserMedia')
      return { success: false, reason: 'BROWSER_NOT_SUPPORTED' }
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
      this.video.srcObject = this.stream
      console.log('[Camera] 啟動成功', {
        tracks: this.stream.getTracks().length,
        videoWidth: this.video.videoWidth,
        videoHeight: this.video.videoHeight,
      })
      return { success: true }
    } catch (err) {
      console.error('[Camera] 啟動失敗', err.name, err.message)
      return { success: false, reason: err.name, message: err.message }
    }
  }

  /**
   * 停止相機
   */
  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop())
      this.stream = null
      this.video.srcObject = null
      console.log('[Camera] 已停止')
    }
  }

  /**
   * 拍攝一張照片
   * @param {number} [quality=0.85] - JPEG 品質
   * @returns {Promise<Blob>}
   */
  async capture(quality = 0.85) {
    if (!this.stream || !this.video.videoWidth) {
      throw new Error('相機未啟動或未就緒')
    }
    const canvas = document.createElement('canvas')
    canvas.width = this.video.videoWidth
    canvas.height = this.video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(this.video, 0, 0)
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('拍照失敗'))),
        'image/jpeg',
        quality
      )
    })
  }

  /**
   * 檢查相機是否支援
   * @returns {boolean}
   */
  static isSupported() {
    return Boolean(navigator.mediaDevices?.getUserMedia && window.isSecureContext)
  }

  /**
   * 檢查當前是否在 HTTPS 安全環境
   */
  static isSecureContext() {
    return window.isSecureContext === true
  }
}
