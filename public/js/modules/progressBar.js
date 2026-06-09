// 🤖 public/js/modules/progressBar.js
// 載入進度條 UI 元件
// 對應 [todo_progress.md F-02](../../todo_progress.md)

'use strict'

/**
 * 建立進度條管理器
 * @param {Object} options
 * @param {HTMLElement} options.container - 進度條容器
 * @param {HTMLElement} options.label - 文字標籤元素
 * @param {HTMLElement} options.fill - 進度條填充元素
 * @returns {Object} - {update, complete, error, reset}
 */
export function createProgressBar({ container, label, fill }) {
  if (!container || !label || !fill) {
    throw new Error('createProgressBar 需要 container, label, fill 三個元素')
  }

  /**
   * 更新進度
   * @param {number} percent - 0-100
   * @param {string} [message]
   */
  function update(percent, message) {
    const safePercent = Math.max(0, Math.min(100, percent))
    fill.style.width = `${safePercent}%`
    fill.setAttribute('aria-valuenow', String(Math.round(safePercent)))
    if (message) {
      label.textContent = message
    }
    container.hidden = false
  }

  /**
   * 完成（100%）
   * @param {string} [message='完成']
   */
  function complete(message = '完成') {
    update(100, message)
    fill.classList.add('progress-fill--complete')
  }

  /**
   * 錯誤狀態
   * @param {string} message
   */
  function error(message) {
    label.textContent = `❌ ${message}`
    fill.classList.add('progress-fill--error')
    fill.style.width = '100%'
  }

  /**
   * 重置
   */
  function reset() {
    fill.style.width = '0%'
    fill.classList.remove('progress-fill--complete', 'progress-fill--error')
    label.textContent = '準備中…'
    container.hidden = true
  }

  return { update, complete, error, reset }
}
