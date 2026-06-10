// 🤖 public/js/modules/cacheManager.js
// IndexedDB 模型快取管理（搭配 TF.js 內建快取機制）
// 對應 [todo_progress.md F-02](../../todo_progress.md)

'use strict'

const DB_NAME = 'super-tracker-models'
const STORE_NAME = 'models'
const DB_VERSION = 1

/**
 * 開啟 IndexedDB 連線
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
  })
}

/**
 * 從快取取得模型 metadata（如載入時間、版本）
 * @param {string} key - 模型識別 key
 * @returns {Promise<Object|null>}
 */
async function getModelMeta(key) {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.get(key)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  } catch (err) {
    console.warn('[CacheManager] 讀取失敗', err)
    return null
  }
}

/**
 * 記錄模型載入 metadata（用於統計與顯示）
 * @param {string} key
 * @param {Object} meta
 * @returns {Promise<boolean>}
 */
async function saveModelMeta(key, meta) {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.put({ ...meta, cachedAt: Date.now() }, key)
      request.onsuccess = () => resolve(true)
      request.onerror = () => reject(request.error)
    })
  } catch (err) {
    console.warn('[CacheManager] 寫入失敗', err)
    return false
  }
}

/**
 * 清除所有快取
 * @returns {Promise<boolean>}
 */
async function clearAll() {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.clear()
      request.onsuccess = () => {
        resolve(true)
      }
      request.onerror = () => reject(request.error)
    })
  } catch (err) {
    console.error('[CacheManager] 清除失敗', err)
    return false
  }
}

export { getModelMeta, saveModelMeta, clearAll, DB_NAME, STORE_NAME }
