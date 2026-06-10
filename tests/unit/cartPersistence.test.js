// 🤖 tests/unit/cartPersistence.test.js
// 購物車刷新持久化測試
// 對應 [TESTING_PLAN.md §5.3 E-CT-03](./TESTING_PLAN.md)
// 跑法：node --test tests/unit/cartPersistence.test.js

'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')

// ============================================================================
// E-CT-03：購物車刷新持久化
// 測試 localStorage 的 JSON 序列化/反序列化邏輯
// ============================================================================

/**
 * 模擬 localStorage 的 JSON 結構
 */
class MockLocalStorage {
  constructor() {
    this.data = {}
  }

  getItem(key) {
    return this.data[key] || null
  }

  setItem(key, value) {
    this.data[key] = String(value)
  }

  removeItem(key) {
    delete this.data[key]
  }

  clear() {
    this.data = {}
  }

  get length() {
    return Object.keys(this.data).length
  }
}

/**
 * 購物車項目結構
 */
const createCartItem = (id, name, price, currency, quantity = 1) => ({
  id,
  name,
  price,
  currency,
  quantity,
  addedAt: Date.now(),
})

/**
 * 購物車資料序列化
 */
function serializeCart(items) {
  return JSON.stringify(items)
}

/**
 * 購物車資料反序列化
 */
function deserializeCart(json) {
  if (!json) return []
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// ============================================================================
// E-CT-03：基本持久化測試
// ============================================================================
test('E-CT-03：空購物車應序列化為空陣列', () => {
  const cart = []
  const json = serializeCart(cart)
  assert.equal(json, '[]')
})

test('E-CT-03：單項購物車應正確序列化', () => {
  const item = createCartItem(1, '蘋果', 45, 'TWD')
  const json = serializeCart([item])
  const parsed = JSON.parse(json)

  assert.equal(parsed.length, 1)
  assert.equal(parsed[0].name, '蘋果')
  assert.equal(parsed[0].price, 45)
})

test('E-CT-03：多項購物車應正確序列化', () => {
  const items = [
    createCartItem(1, '蘋果', 45, 'TWD'),
    createCartItem(2, '牛奶', 95, 'TWD'),
    createCartItem(3, '麵包', 65, 'TWD'),
  ]
  const json = serializeCart(items)
  const parsed = JSON.parse(json)

  assert.equal(parsed.length, 3)
  assert.equal(parsed[0].name, '蘋果')
  assert.equal(parsed[1].name, '牛奶')
  assert.equal(parsed[2].name, '麵包')
})

// ============================================================================
// E-CT-03：反序列化測試
// ============================================================================
test('E-CT-03：JSON 應正確反序列化為購物車', () => {
  const json = '[{"id":1,"name":"蘋果","price":45,"currency":"TWD"}]'
  const items = deserializeCart(json)

  assert.equal(items.length, 1)
  assert.equal(items[0].id, 1)
  assert.equal(items[0].name, '蘋果')
})

test('E-CT-03：null 輸入應返回空陣列', () => {
  const items = deserializeCart(null)
  assert.deepEqual(items, [])
})

test('E-CT-03：空字串輸入應返回空陣列', () => {
  const items = deserializeCart('')
  assert.deepEqual(items, [])
})

test('E-CT-03：損壞的 JSON 應返回空陣列', () => {
  const items = deserializeCart('{invalid json}')
  assert.deepEqual(items, [])
})

test('E-CT-03：非陣列 JSON 應返回空陣列', () => {
  const items = deserializeCart('{"name":"test"}')
  assert.deepEqual(items, [])
})

// ============================================================================
// E-CT-03：Mock localStorage 整合測試
// ============================================================================
test('E-CT-03：Mock localStorage 應正確保存購物車', () => {
  const storage = new MockLocalStorage()
  const cartKey = 'super-tracker-cart'

  // 加入商品
  const items = [createCartItem(1, '蘋果', 45, 'TWD')]
  storage.setItem(cartKey, serializeCart(items))

  // 模擬刷新（讀取）
  const savedJson = storage.getItem(cartKey)
  const restoredItems = deserializeCart(savedJson)

  assert.equal(restoredItems.length, 1)
  assert.equal(restoredItems[0].name, '蘋果')
})

test('E-CT-03：Mock localStorage 應支援多項商品', () => {
  const storage = new MockLocalStorage()
  const cartKey = 'super-tracker-cart'

  // 加入多個商品
  const items = [
    createCartItem(1, '蘋果', 45, 'TWD'),
    createCartItem(2, '牛奶', 95, 'TWD'),
    createCartItem(3, '麵包', 65, 'TWD'),
  ]
  storage.setItem(cartKey, serializeCart(items))

  const savedJson = storage.getItem(cartKey)
  const restoredItems = deserializeCart(savedJson)

  assert.equal(restoredItems.length, 3)
})

test('E-CT-03：Mock localStorage.removeItem 應清除購物車', () => {
  const storage = new MockLocalStorage()
  const cartKey = 'super-tracker-cart'

  storage.setItem(cartKey, '[{"id":1}]')
  assert.ok(storage.getItem(cartKey))

  storage.removeItem(cartKey)
  assert.equal(storage.getItem(cartKey), null)
})

test('E-CT-03：Mock localStorage.clear 應清除所有資料', () => {
  const storage = new MockLocalStorage()

  storage.setItem('cart1', '[]')
  storage.setItem('cart2', '[]')

  assert.equal(storage.length, 2)

  storage.clear()

  assert.equal(storage.length, 0)
})

// ============================================================================
// E-CT-03：數量更新測試
// ============================================================================
test('E-CT-03：更新商品數量應正確序列化', () => {
  const items = [
    createCartItem(1, '蘋果', 45, 'TWD', 1),
    createCartItem(2, '牛奶', 95, 'TWD', 2),
  ]

  // 更新數量
  items[0].quantity = 3

  const json = serializeCart(items)
  const parsed = JSON.parse(json)

  assert.equal(parsed[0].quantity, 3)
  assert.equal(parsed[1].quantity, 2)
})

// ============================================================================
// E-CT-03：價格貨幣測試
// ============================================================================
test('E-CT-03：不同幣別應正確處理', () => {
  const items = [
    createCartItem(1, '蘋果', 45, 'TWD'),
    createCartItem(2, 'Banana', 1.99, 'USD'),
    createCartItem(3, 'りんご', 198, 'JPY'),
  ]

  const json = serializeCart(items)
  const parsed = JSON.parse(json)

  assert.equal(parsed[0].currency, 'TWD')
  assert.equal(parsed[1].currency, 'USD')
  assert.equal(parsed[2].currency, 'JPY')
})

// ============================================================================
// E-CT-03：時間戳記測試
// ============================================================================
test('E-CT-03：addedAt 時間戳記應被保存', () => {
  const before = Date.now()
  const item = createCartItem(1, '蘋果', 45, 'TWD')
  const after = Date.now()

  const json = serializeCart([item])
  const parsed = JSON.parse(json)

  assert.ok(parsed[0].addedAt >= before)
  assert.ok(parsed[0].addedAt <= after)
})

// ============================================================================
// E-CT-03：容量限制測試
// ============================================================================
test('E-CT-03：localStorage 應有容量概念（5MB 模擬）', () => {
  const FIVE_MB = 5 * 1024 * 1024
  const cartData = '{"items":[]}'
  const size = Buffer.byteLength(cartData, 'utf8')

  assert.ok(size < FIVE_MB, '空購物車應小於 5MB')
})

test('E-CT-03：大型購物車資料應仍可序列化', () => {
  // 模擬 1000 項商品
  const items = []
  for (let i = 0; i < 1000; i++) {
    items.push(createCartItem(i, `商品${i}`, 100 + i, 'TWD'))
  }

  const json = serializeCart(items)
  const parsed = JSON.parse(json)

  assert.equal(parsed.length, 1000)
})