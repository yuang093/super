// 🤖 public/js/modules/uploadService.js
// 上傳服務：XHR 上傳 + 進度回呼 + 錯誤處理
// 對應 [todo_progress.md F-04](../../todo_progress.md)

'use strict'

/**
 * 上傳圖片到後端
 * @param {Blob|File} file - 圖片檔案
 * @param {Object} [options]
 * @param {Function} [options.onProgress] - 進度回呼 (percent: 0-100)
 * @param {string} [options.endpoint='/api/capture'] - 上傳端點
 * @param {string} [options.fingerprint] - IP Fingerprint
 * @returns {Promise<Object>} - 後端回傳的結果
 */
export function uploadImage(file, options = {}) {
  const { onProgress, endpoint = '/api/capture', fingerprint } = options

  const formData = new FormData()
  formData.append('image', file, file.name || 'capture.jpg')
  if (fingerprint) {
    formData.append('fingerprint', fingerprint)
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100))
        }
      })
    }

    xhr.addEventListener('load', () => {
      let data
      try {
        data = JSON.parse(xhr.responseText)
      } catch (_) {
        return reject(
          new Error(`伺服器回應無效 (HTTP ${xhr.status}): ${xhr.responseText.substring(0, 200)}`)
        )
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data)
      } else {
        const errMsg = data?.error?.message || `HTTP ${xhr.status}`
        const errCode = data?.error?.code || 'UNKNOWN'
        const err = new Error(errMsg)
        err.code = errCode
        err.status = xhr.status
        err.data = data
        reject(err)
      }
    })

    xhr.addEventListener('error', () => reject(new Error('網路錯誤：上傳失敗')))
    xhr.addEventListener('abort', () => reject(new Error('上傳已中止')))
    xhr.addEventListener('timeout', () => reject(new Error('上傳逾時')))

    xhr.open('POST', endpoint)
    xhr.timeout = 60000 // 60 秒
    xhr.send(formData)
  })
}
