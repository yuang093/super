// 🤖 public/js/cart.js
// 購物車狀態管理：localStorage 持久化、雙幣總價計算
// 對應 [todo_progress.md F-06]
// 支援新增、單筆刪除、全部清空、localStorage 刷新保留

'use strict'

/**
 * 購物車狀態事件發射器（用於 UI同步更新）
 */
const CART_EVENTS = {
  ITEM_ADDED: 'cart:item-added',
  ITEM_REMOVED: 'cart:item-removed',
  CART_CLEARED: 'cart:cleared',
  CART_LOADED: 'cart:loaded',
}

/**
 * 購物車事件監聽器管理
 */
const cartListeners = {
  [CART_EVENTS.ITEM_ADDED]: [],
  [CART_EVENTS.ITEM_REMOVED]: [],
  [CART_EVENTS.CART_CLEARED]: [],
  [CART_EVENTS.CART_LOADED]: [],
}

/**
 * 發送購物車事件
 * @param {string} eventName - 事件名稱
 * @param {Object} payload - 事件資料
 */
function emitCartEvent(eventName, payload) {
  const listeners = cartListeners[eventName] || []
  listeners.forEach((fn) => {
    try {
      fn(payload)
    } catch (err) {
      console.error('[Cart] 事件監聽器執行失敗', eventName, err)
    }
  })
}

/**
 * 訂閱購物車事件
 * @param {string} eventName - 事件名稱
 * @param {Function} callback - 回呼函式
 * @returns {Function} -取消訂閱函式
 */
export function onCartEvent(eventName, callback) {
  if (!cartListeners[eventName]) {
    console.warn('[Cart] 未知事件名稱', eventName)
    return () => {}
  }
  cartListeners[eventName].push(callback)
  return () => {
    const index = cartListeners[eventName].indexOf(callback)
    if (index > -1) {
      cartListeners[eventName].splice(index, 1)
    }
  }
}

/**
 * 取得 localStorage 鍵名
 * @param {string} fingerprint - 使用者指紋
 * @returns {string}
 */
function getCartKey(fingerprint) {
  return `super_cart_${fingerprint}`
}

/**
 * 購物車狀態管理類別
 */
export class Cart {
  /**
   * @param {string} fingerprint - 使用者指紋
   */
  constructor(fingerprint) {
    this.fingerprint = fingerprint || 'anonymous'
    this._items = []
    this._rates = {
      USD: 1,
      JPY: 1,
      EUR: 1,
      KRW: 1,
      CNY: 1,
      TWD: 1,
    }
    this._ratesUpdatedAt = null
    this._load()
  }

  /**
   * 從 localStorage 載入購物車
   */
  _load() {
    try {
      const stored = localStorage.getItem(getCartKey(this.fingerprint))
      if (stored) {
        const data = JSON.parse(stored)
        this._items = Array.isArray(data.items) ? data.items : []
        this._rates = data.rates || this._rates
        this._ratesUpdatedAt = data.ratesUpdatedAt || null
      } else {
        this._items = []
      }
      emitCartEvent(CART_EVENTS.CART_LOADED, { items: this._items })
    } catch (err) {
      console.error('[Cart] 載入失敗，使用空購物車', err.message)
      this._items = []
    }
  }

  /**
   * 儲存購物車到 localStorage
   */
  _save() {
    try {
      const data = {
        items: this._items,
        rates: this._rates,
        ratesUpdatedAt: this._ratesUpdatedAt,
        savedAt: Date.now(),
      }
      localStorage.setItem(getCartKey(this.fingerprint), JSON.stringify(data))
    } catch (err) {
      console.error('[Cart] 儲存失敗', err.message)
      // localStorage 已滿
      if (err.name === 'QuotaExceededError') {
        console.warn('[Cart] localStorage 已滿，嘗試刪除最舊的項目')
        this._items = this._items.slice(-50) // 保留最近 50 筆
        try {
          localStorage.setItem(
            getCartKey(this.fingerprint),
            JSON.stringify({ items: this._items, rates: this._rates })
          )
        } catch (_) {
          console.error('[Cart] 仍無法儲存，放棄')
        }
      }
    }
  }

  /**
   * 新增商品到購物車
   * @param {Object} item
   * @param {string} item.name - 商品名稱
   * @param {number} item.price - 價格
   * @param {string} [item.currency='TWD'] - 幣別
   * @param {number} [item.confidence=1] - 信心度
   * @param {string} [item.parseMethod='manual'] - 解析方式
   * @param {string} [item.imageBase64] - 圖片 Base64（可選）
   * @returns {Object} - 新增的商品（含 id）
   */
  addItem(item) {
    const newItem = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: item.name || '未知名稱',
      price: typeof item.price === 'number' ? item.price : 0,
      currency: item.currency || 'TWD',
      confidence: typeof item.confidence === 'number' ? item.confidence : 1,
      parseMethod: item.parseMethod || 'manual',
      imageBase64: item.imageBase64 || null,
      createdAt: Date.now(),
    }

    this._items.push(newItem)
    this._save()
    emitCartEvent(CART_EVENTS.ITEM_ADDED, newItem)
    console.log('[Cart] 商品已新增', newItem)
    return newItem
  }

  /**
   * 刪除單筆商品
   * @param {string} id - 商品 ID
   * @returns {boolean} - 是否刪除成功
   */
  removeItem(id) {
    const index = this._items.findIndex((item) => item.id === id)
    if (index === -1) {
      console.warn('[Cart] 找不到要刪除的商品', id)
      return false
    }
    const removed = this._items.splice(index, 1)[0]
    this._save()
    emitCartEvent(CART_EVENTS.ITEM_REMOVED, removed)
    console.log('[Cart] 商品已刪除', removed.name)
    return true
  }

  /**
   * 清空所有商品
   * @returns {number} -刪除的數量
   */
  clearAll() {
    const count = this._items.length
    this._items = []
    this._save()
    emitCartEvent(CART_EVENTS.CART_CLEARED, { count })
    console.log('[Cart] 購物車已清空', { count })
    return count
  }

  /**
   * 取得所有商品
   * @returns {Array}
   */
  getItems() {
    return [...this._items]
  }

  /**
   * 取得商品數量
   * @returns {number}
   */
  getCount() {
    return this._items.length
  }

  /**
   * 更新匯率
   * @param {Object} rates - 匯率物件 { USD: 31.5, JPY: 0.21, ... }
   */
  updateRates(rates) {
    this._rates = { ...this._rates, ...rates }
    this._ratesUpdatedAt = Date.now()
    this._save()
    console.log('[Cart] 匯率已更新', this._rates)
  }

  /**
   * 取得匯率
   * @returns {Object}
   */
  getRates() {
    return { ...this._rates }
  }

  /**
   * 計算單一幣別的總價
   * @param {string} currency - 幣別代碼
   * @returns {number}
   */
  sumByCurrency(currency) {
    return this._items
      .filter((item) => item.currency === currency)
      .reduce((sum, item) => sum + item.price, 0)
  }

  /**
   * 計算新台幣（TWD）等值總價
   * 將其他幣別以匯率換算後加總
   * @returns {number}
   */
  sumTWD() {
    return this._items.reduce((total, item) => {
      const rate = this._rates[item.currency] || 1
      return total + item.price * rate
    }, 0)
  }

  /**
   * 取得完整的購物車摘要
   * @returns {Object} - 含各幣別總額與 TWD 總額
   */
  getSummary() {
    //依幣別分組加總
    const byCurrency = {}
    this._items.forEach((item) => {
      if (!byCurrency[item.currency]) {
        byCurrency[item.currency] = { total: 0, count: 0 }
      }
      byCurrency[item.currency].total += item.price
      byCurrency[item.currency].count += 1
    })

    // 轉為陣列格式（注意：totalTWD 已在 sumTWD() 統一計算，這裡只呈現原幣別總額）
    const currencySummaries = Object.entries(byCurrency).map(([currency, data]) => ({
      currency,
      total: data.total,
      count: data.count,
    }))

    return {
      items: [...this._items],
      totalTWD: this.sumTWD(),
      currencySummaries,
      rates: { ...this._rates },
      ratesUpdatedAt: this._ratesUpdatedAt,
    }
  }
}

/**
 * 建立預設匯率（網路失敗時的保底值）
 * @returns {Object}
 */
export function getDefaultRates() {
  return {
    USD: 31.5,
    JPY: 0.21,
    EUR: 34.5,
    KRW: 0.023,
    CNY: 4.35,
    TWD: 1,
  }
}

/**
 * 格式化價格顯示
 * @param {number} price - 價格
 * @param {string} [currency='TWD'] - 幣別
 * @returns {string}
 */
export function formatPrice(price, currency = 'TWD') {
  const symbols = {
    USD: 'US$',
    JPY: '¥',
    EUR: '€',
    KRW: '₩',
    CNY: '¥',
    TWD: 'NT$',
  }
  const symbol = symbols[currency] || currency + ' '
  return `${symbol}${price.toFixed(2)}`
}

/**
 * 格式化時間（相對時間）
 * @param {number} unixMs - Unix 毫秒時間戳
 * @returns {string}
 */
export function formatRelativeTime(unixMs) {
  if (!unixMs) return ''
  const diff = Date.now() - unixMs
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return '剛剛'
  if (sec < 3600) return `${Math.floor(sec / 60)} 分鐘前`
  if (sec < 86400) return `${Math.floor(sec / 3600)} 小時前`
  return `${Math.floor(sec / 86400)} 天前`
}
