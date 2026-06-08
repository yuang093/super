// 🤖 public/js/modules/camera.js
// 拍照模組：getUserMedia 相機呼叫 + 相簿選圖
// 對應 [todo_progress.md F-04](../../todo_progress.md)

'use strict';

/**
 * 相機類別（支援拍照與相簿選圖）
 */
export class Camera {
  /**
   * @param {HTMLVideoElement} videoElement - 用於顯示相機預覽的 video 元素
   */
  constructor(videoElement) {
    if (!videoElement) {
      throw new Error('Camera 需要 video 元素');
    }
    this.video = videoElement;
    this.stream = null;
  }

  /**
   * 啟動相機（請求瀏覽器權限）
   * @returns {Promise<boolean>} 成功與否
   */
  async start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      console.error('[Camera] 瀏覽器不支援 getUserMedia');
      return false;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' }, // 後鏡頭優先
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      this.video.srcObject = this.stream;
      return true;
    } catch (err) {
      console.error('[Camera] 啟動失敗', err.message);
      return false;
    }
  }

  /**
   * 停止相機
   */
  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
      this.video.srcObject = null;
    }
  }

  /**
   * 拍攝一張照片
   * @param {number} [quality=0.85] - JPEG 品質
   * @returns {Promise<Blob>}
   */
  async capture(quality = 0.85) {
    if (!this.stream || !this.video.videoWidth) {
      throw new Error('相機未啟動或未就緒');
    }
    const canvas = document.createElement('canvas');
    canvas.width = this.video.videoWidth;
    canvas.height = this.video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(this.video, 0, 0);
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('拍照失敗'))),
        'image/jpeg',
        quality
      );
    });
  }

  /**
   * 從相簿選擇圖片
   * 注意：不要設 input.capture 屬性，否則會強制開啟相機而非相簿
   * @returns {Promise<File>}
   */
  async selectFromGallery() {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      // accept 包含 image/*（所有圖片）但不用 capture，讓使用者自由選
      input.accept = 'image/jpeg,image/png,image/webp,image/*';
      input.style.position = 'fixed';
      input.style.left = '-9999px';
      input.style.top = '0';

      input.onchange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
          resolve(file);
        } else {
          reject(new Error('未選擇檔案'));
        }
        // 延遲移除以確保 onchange 觸發
        setTimeout(() => input.remove(), 100);
      };

      // 監聽取消事件（部分瀏覽器支援）
      input.addEventListener('cancel', () => {
        reject(new Error('使用者取消選擇'));
        setTimeout(() => input.remove(), 100);
      });

      document.body.appendChild(input);

      // 延遲 click 確保 input 已加入 DOM
      setTimeout(() => input.click(), 50);
    });
  }

  /**
   * 檢查相機是否支援
   * @returns {boolean}
   */
  static isSupported() {
    return Boolean(navigator.mediaDevices?.getUserMedia);
  }
}
