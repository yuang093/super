// 🤖 src/utils/eventBus.js
// 事件匯流排（Event Emitter）：用於模組間解耦通訊
// 對應 [todo_progress.md B-07](../../todo_progress.md)
//設計：參照 Node.js EventEmitter 但杜絕記憶體洩漏（自動解綁 once監聽者）

'use strict'

const EventEmitter = require('events')

/**
 * 全域事件匯流排單例
 * 防止重複建立導致訂閱散落在不同 emitter實例
 */
let globalBus = null

/**
 * 取得全域事件匯流排
 * @returns {EventEmitter}
 */
function getBus() {
  if (!globalBus) {
    globalBus = new EventEmitter()
    // 防止記憶體洩漏：設定最大監聽者數量
    globalBus.setMaxListeners(100)
  }
  return globalBus
}

/**
 * 訂閱事件（一般監聽者）
 * @param {string} eventName - 事件名稱
 * @param {Function} listener - 回呼函式
 * @returns {Function} - 取消訂閱函式
 */
function on(eventName, listener) {
  const bus = getBus()
  bus.on(eventName, listener)
  return () => bus.off(eventName, listener)
}

/**
 * 訂閱事件（單次監聽者，自動解綁）
 * @param {string} eventName - 事件名稱
 * @param {Function} listener - 回呼函式
 * @returns {Function} - 取消訂閱函式
 */
function once(eventName, listener) {
  const bus = getBus()
  bus.once(eventName, listener)
  return () => bus.off(eventName, listener)
}

/**
 * 發送事件
 * @param {string} eventName - 事件名稱
 * @param {*} payload - 事件資料
 */
function emit(eventName, payload) {
  try {
    getBus().emit(eventName, payload)
  } catch (err) {
    console.error(`[EventBus] 事件發送失敗: ${eventName}`, err)
  }
}

/**
 * 取得目前監聽者數量（除錯用）
 * @param {string} [eventName] - 不傳則回傳全部事件的總監聽者數
 * @returns {number}
 */
function listenerCount(eventName) {
  const bus = getBus()
  if (eventName) {
    return bus.listenerCount(eventName)
  }
  return bus.eventNames().reduce((sum, name) => sum + bus.listenerCount(name), 0)
}

/**
 * 移除所有監聽者（主要用於測試）
 */
function removeAllListeners() {
  getBus().removeAllListeners()
}

/**
 * 重設全域匯流排（測試專用）
 */
function resetBus() {
  if (globalBus) {
    globalBus.removeAllListeners()
    globalBus = null
  }
}

// ============================================================================
// 應用程式事件常數（統一集中管理，避免魔法字串）
// ============================================================================

/**
 * 商品相關事件
 */
const ITEM_EVENTS = {
  /** 新增商品到購物車 */
  ITEM_ADDED: 'item:added',
  /**刪除商品 */
  ITEM_REMOVED: 'item:removed',
  /** 清空購物車 */
  CART_CLEARED: 'cart:cleared',
}

/**
 * 辨識相關事件
 */
const RECOGNITION_EVENTS = {
  /** VLM 辨識成功 */
  RECOGNITION_SUCCESS: 'recognition:success',
  /** VLM 辨識失敗 */
  RECOGNITION_FAILED: 'recognition:failed',
  /** 圖片壓縮完成 */
  IMAGE_COMPRESSED: 'image:compressed',
}

/**
 * 匯率相關事件
 */
const RATE_EVENTS = {
  /** 匯率更新 */
  RATE_UPDATED: 'rate:updated',
  /** 匯率過期 */
  RATE_STALE: 'rate:stale',
}

/**
 * Webhook 相關事件
 */
const WEBHOOK_EVENTS = {
  /** 準備發送 Webhook */
  WEBHOOK_TRIGGER: 'webhook:trigger',
  /** Webhook 發送成功 */
  WEBHOOK_SENT: 'webhook:sent',
  /** Webhook 發送失敗 */
  WEBHOOK_FAILED: 'webhook:failed',
}

module.exports = {
  getBus,
  on,
  once,
  emit,
  listenerCount,
  removeAllListeners,
  resetBus,
  ITEM_EVENTS,
  RECOGNITION_EVENTS,
  RATE_EVENTS,
  WEBHOOK_EVENTS,
}
