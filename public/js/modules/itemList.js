// 🤖 public/js/modules/itemList.js
// 購物車 UI：自動從後端拉取 + 渲染 + 單筆刪除 + 清空
// 對應 [todo_progress.md F-06](../../todo_progress.md)

'use strict'

/**
 * 初始化購物車 UI
 * @param {HTMLElement} container - 購物車卡片容器
 */
export async function initItemList(container) {
  if (!container) {
    console.warn('[ItemList] 找不到容器，略過初始化')
    return
  }

  container.innerHTML = `
    <div class="item-list-toolbar">
      <button id="btn-refresh-cart" class="btn-cart-action" type="button" title="重新整理">
        <span>🔄 重新整理</span>
      </button>
      <button id="btn-clear-cart" class="btn-cart-action btn-cart-danger" type="button" title="清空所有商品">
        <span>🗑️ 清空</span>
      </button>
    </div>
    <div class="item-list" id="item-list">
      <div class="item-list-loading">⏳ 載入中...</div>
    </div>
    <div class="cart-summary" id="cart-summary" style="display:none;">
      <h4>💰 總計</h4>
      <div class="summary-rows" id="summary-rows"></div>
    </div>
  `

  document.getElementById('btn-refresh-cart').addEventListener('click', loadItems)
  document.getElementById('btn-clear-cart').addEventListener('click', clearCart)

  // 首次載入
  await loadItems()
}

/**
 * 從後端拉取購物車
 */
async function loadItems() {
  const listEl = document.getElementById('item-list')
  const summaryEl = document.getElementById('cart-summary')
  const summaryRowsEl = document.getElementById('summary-rows')
  const fingerprint = window.app?.state?.fingerprint || 'anonymous'

  listEl.innerHTML = '<div class="item-list-loading">⏳ 載入中...</div>'
  summaryEl.style.display = 'none'

  try {
    const response = await fetch(
      `/api/items?fingerprint=${encodeURIComponent(fingerprint)}&limit=100`,
      {
        headers: { Accept: 'application/json' },
      }
    )
    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error?.message || '載入失敗')
    }

    renderItems(data.items || [])
    renderSummary(data.summary || [])
  } catch (err) {
    console.error('[ItemList] 載入失敗', err)
    listEl.innerHTML = `<div class="item-list-error">❌ ${escapeHtml(err.message)}</div>`
  }
}

/**
 * 渲染商品列表
 */
function renderItems(items) {
  const listEl = document.getElementById('item-list')

  if (items.length === 0) {
    listEl.innerHTML = '<div class="item-list-empty">🛒 購物車是空的，去拍個商品吧！</div>'
    return
  }

  listEl.innerHTML = items
    .map(
      (item) => `
    <div class="cart-item" data-id="${item.id}">
      <div class="cart-item-emoji">📦</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${formatItemName(item.name)}</div>
        <div class="cart-item-meta">${formatTime(item.createdAt)}</div>
      </div>
      <div class="cart-item-right">
        <div class="cart-item-price">${escapeHtml(item.currency || 'TWD')} ${item.price}</div>
        <button class="btn-item-delete" data-id="${item.id}" type="button" aria-label="刪除">×</button>
      </div>
    </div>
  `
    )
    .join('')

  // 綁定刪除按鈕
  listEl.querySelectorAll('.btn-item-delete').forEach((btn) => {
    btn.addEventListener('click', () => deleteItem(parseInt(btn.dataset.id, 10)))
  })
}

/**
 * 渲染總計
 */
function renderSummary(summary) {
  const summaryEl = document.getElementById('cart-summary')
  const rowsEl = document.getElementById('summary-rows')

  if (summary.length === 0) {
    summaryEl.style.display = 'none'
    return
  }

  summaryEl.style.display = 'block'
  rowsEl.innerHTML = summary
    .map(
      (s) => `
    <div class="summary-row">
      <span class="summary-currency">${escapeHtml(s.currency)}</span>
      <span class="summary-count">${s.count} 件</span>
      <span class="summary-amount">${s.total.toFixed(2)}</span>
    </div>
  `
    )
    .join('')
}

/**
 * 刪除單筆商品
 */
async function deleteItem(id) {
  if (!confirm('確定要刪除此商品嗎？')) return
  const fingerprint = window.app?.state?.fingerprint || 'anonymous'

  try {
    const response = await fetch(
      `/api/items/${id}?fingerprint=${encodeURIComponent(fingerprint)}`,
      {
        method: 'DELETE',
      }
    )
    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error?.message || '刪除失敗')
    }

    console.log('[ItemList] 刪除成功', data)
    await loadItems()
  } catch (err) {
    console.error('[ItemList] 刪除失敗', err)
    alert('刪除失敗：' + err.message)
  }
}

/**
 * 清空購物車
 */
async function clearCart() {
  if (!confirm('確定要清空購物車嗎？此操作無法復原。')) return
  const fingerprint = window.app?.state?.fingerprint || 'anonymous'

  try {
    const response = await fetch(`/api/items?fingerprint=${encodeURIComponent(fingerprint)}`, {
      method: 'DELETE',
    })
    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error?.message || '清空失敗')
    }

    console.log('[ItemList] 清空成功', data)
    await loadItems()
  } catch (err) {
    console.error('[ItemList] 清空失敗', err)
    alert('清空失敗：' + err.message)
  }
}

/**
 * 格式化 Unix ms 時間為相對時間
 */
function formatTime(unixMs) {
  if (!unixMs) return ''
  const diff = Date.now() - unixMs
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return '剛剛'
  if (sec < 3600) return `${Math.floor(sec / 60)} 分鐘前`
  if (sec < 86400) return `${Math.floor(sec / 3600)} 小時前`
  return `${Math.floor(sec / 86400)} 天前`
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

/**
 * 格式化商品名稱（翻譯放第二行）
 */
function formatItemName(name) {
  if (!name) return ''
  const escaped = escapeHtml(name)
  const match = escaped.match(/^(.+?)\s*\((.+?)\)$/)
  if (match) {
    return `<span class="name-original">${match[1]}</span><span class="name-translation">${match[2]}</span>`
  }
  return `<span class="name-original">${escaped}</span>`
}
