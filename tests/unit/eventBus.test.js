// 🤖 tests/unit/eventBus.test.js
// Event Emitter 訂閱解綁測試
// 對應 [TESTING_PLAN.md §4.4 I-EE-01 ~ I-EE-06](./TESTING_PLAN.md)
// 跑法：node --test tests/unit/eventBus.test.js

'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')

const {
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
} = require('../../src/utils/eventBus')

// ============================================================================
// 測試前：重設 Event Bus
// ============================================================================
test.beforeEach(() => {
  resetBus()
})

// ============================================================================
// I-EE-01：應發送 item:added 事件
// ============================================================================
test('I-EE-01：on() 訂閱 item:added 應收到 payload', () => {
  let receivedPayload = null
  const testPayload = { id: 1, name: 'Apple', price: 45 }

  const unsubscribe = on(ITEM_EVENTS.ITEM_ADDED, (payload) => {
    receivedPayload = payload
  })

  emit(ITEM_EVENTS.ITEM_ADDED, testPayload)

  assert.deepEqual(receivedPayload, testPayload)
  unsubscribe()
})

test('I-EE-01：once() 訂閱 item:added 應自動解綁', () => {
  let callCount = 0
  const testPayload = { id: 1, name: 'Apple', price: 45 }

  once(ITEM_EVENTS.ITEM_ADDED, () => {
    callCount++
  })

  // 觸發第一次
  emit(ITEM_EVENTS.ITEM_ADDED, testPayload)
  assert.equal(callCount, 1)

  // 觸發第二次（不應再收到）
  emit(ITEM_EVENTS.ITEM_ADDED, testPayload)
  assert.equal(callCount, 1, 'once 監聽者應自動移除')
})

test('I-EE-01：應支援多個事件常數', () => {
  const events = [ITEM_EVENTS, RECOGNITION_EVENTS, RATE_EVENTS, WEBHOOK_EVENTS]

  for (const eventGroup of events) {
    for (const eventName of Object.values(eventGroup)) {
      assert.ok(typeof eventName === 'string', `${eventName} 應為字串`)
      assert.ok(eventName.length > 0, `${eventName} 不應為空`)
    }
  }
})

// ============================================================================
// I-EE-02：應發送 cart:over_budget 當總額超標
// ============================================================================
test('I-EE-02：cart:over_budget 事件應攜帶閾值資訊', () => {
  let receivedPayload = null
  const payload = {
    total: 5500,
    currency: 'TWD',
    budget: 5000,
    exceededBy: 500,
  }

  const unsubscribe = on('cart:over_budget', (p) => {
    receivedPayload = p
  })

  emit('cart:over_budget', payload)

  assert.equal(receivedPayload.total, 5500)
  assert.equal(receivedPayload.currency, 'TWD')
  assert.equal(receivedPayload.budget, 5000)
  assert.equal(receivedPayload.exceededBy, 500)
  unsubscribe()
})

test('I-EE-02：閾值判斷應由業務邏輯決定（這裡測試事件發送）', () => {
  // 測試事件可以正常發送，閾值判斷在業務層
  let called = false
  on('cart:over_budget', () => {
    called = true
  })

  // 發送超標事件
  emit('cart:over_budget', { total: 6000, currency: 'TWD', budget: 5000 })

  assert.equal(called, true)
})

// ============================================================================
// I-EE-03：應傳遞事件給所有訂閱者（不遺漏）
// ============================================================================
test('I-EE-03：10 個訂閱者應全部收到事件', () => {
  const callCounts = new Array(10).fill(0)
  const payloads = []

  // 建立 10 個訂閱者
  for (let i = 0; i < 10; i++) {
    const index = i
    on('test:multi', () => {
      callCounts[index]++
      payloads.push(index)
    })
  }

  // 發送一次事件
  emit('test:multi', { index: 'first' })

  // 全部都應該收到
  for (let i = 0; i < 10; i++) {
    assert.equal(callCounts[i], 1, `訂閱者 ${i} 應收到 1 次`)
  }

  // 再發送一次
  emit('test:multi', { index: 'second' })

  for (let i = 0; i < 10; i++) {
    assert.equal(callCounts[i], 2, `訂閱者 ${i} 應收到 2 次`)
  }
})

test('I-EE-03：訂閱順序應不影響接收（順序依賴 Node.js EventEmitter）', () => {
  const order = []

  on('test:order', () => order.push('a'))
  on('test:order', () => order.push('b'))
  on('test:order', () => order.push('c'))

  emit('test:order', {})

  assert.equal(order.length, 3)
  assert.deepEqual(order, ['a', 'b', 'c'])
})

// ============================================================================
// I-EE-04：事件負載驗證（測試輔助函式）
// ============================================================================
test('I-EE-04：事件 payload 結構驗證（可選功能）', () => {
  // 定義 schema 驗證函式
  function validateItemPayload(payload) {
    if (!payload || typeof payload !== 'object') {
      return { valid: false, error: 'payload 必須是物件' }
    }
    if (typeof payload.id !== 'number') {
      return { valid: false, error: 'id 必須是數字' }
    }
    if (typeof payload.name !== 'string' || payload.name.length === 0) {
      return { valid: false, error: 'name 必須是非空字串' }
    }
    return { valid: true }
  }

  // 有效 payload
  const valid = validateItemPayload({ id: 1, name: 'Apple' })
  assert.equal(valid.valid, true)

  // 無效 payload
  const noId = validateItemPayload({ name: 'Apple' })
  assert.equal(noId.valid, false)
  assert.ok(noId.error.includes('id'))

  const noName = validateItemPayload({ id: 1 })
  assert.equal(noName.valid, false)
  assert.ok(noName.error.includes('name'))
})

// ============================================================================
// I-EE-05：當訂閱者拋例外時，不應影響其他訂閱者（Node.js 原生行為）
// ============================================================================
test('I-EE-05：訂閱者拋例外時事件發送仍完成（例外被 log）', () => {
  let errorCallCount = 0

  // 錯誤的監聽者
  on('test:error', () => {
    errorCallCount++
    throw new Error('故意的錯誤')
  })

  // 發送事件不應拋出例外（emit 有 try-catch）
  assert.doesNotThrow(() => {
    emit('test:error', {})
  })

  assert.equal(errorCallCount, 1, '錯誤監聽者應被呼叫')
})

test('I-EE-05：emit 應捕获例外而不向外傳播', () => {
  // 如果 emit 沒有 try-catch，這個測試會因為未捕獲例外而失敗
  on('test:throws', () => {
    throw new Error('Test error')
  })

  // 不應拋出例外
  assert.doesNotThrow(() => {
    emit('test:throws', {})
  })
})

// ============================================================================
// I-EE-06：off() 應正確取消訂閱
// ============================================================================
test('I-EE-06：off() 應移除監聽者', () => {
  let callCount = 0
  const listener = () => {
    callCount++
  }

  const unsubscribe = on('test:off', listener)
  assert.ok(typeof unsubscribe === 'function', 'on() 應回傳取消訂閱函式')

  // 發送事件（應收到）
  emit('test:off', {})
  assert.equal(callCount, 1)

  // 取消訂閱
  unsubscribe()

  // 再次發送（不應收到）
  emit('test:off', {})
  assert.equal(callCount, 1, '取消後不應再收到事件')
})

test('I-EE-06：取消後監聽者數量應減少', () => {
  const beforeCount = listenerCount('test:off')

  const unsub1 = on('test:off', () => {})
  const unsub2 = on('test:off', () => {})

  assert.equal(listenerCount('test:off'), beforeCount + 2)

  unsub1()
  assert.equal(listenerCount('test:off'), beforeCount + 1)

  unsub2()
  assert.equal(listenerCount('test:off'), beforeCount)
})

test('I-EE-06：once() 回傳的取消訂閱應可正常運作', () => {
  let callCount = 0

  const unsubscribe = once('test:once-off', () => {
    callCount++
  })

  // 第一次
  emit('test:once-off', {})
  assert.equal(callCount, 1)

  // 取消（應該沒效果，因為 once 已自動移除）
  unsubscribe()

  // 第二次
  emit('test:once-off', {})
  assert.equal(callCount, 1, 'once 不應再被呼叫')
})

// ============================================================================
// 額外測試：removeAllListeners
// ============================================================================
test('removeAllListeners：應移除所有監聽者', () => {
  on('test:clear1', () => {})
  on('test:clear2', () => {})
  on('test:clear3', () => {})

  const before = listenerCount()
  assert.ok(before >= 3)

  removeAllListeners()

  const after = listenerCount()
  assert.equal(after, 0)
})

test('resetBus：應重設全域匯流排', () => {
  on('test:reset', () => {})

  const before = listenerCount('test:reset')
  assert.ok(before >= 1)

  resetBus()

  // resetBus 後，全域 bus 為 null，再次 getBus() 會建立新的
  const after = listenerCount('test:reset')
  assert.equal(after, 0)
})

// ============================================================================
// 額外測試：listenerCount 函式
// ============================================================================
test('listenerCount：無事件時應返回 0', () => {
  resetBus()
  assert.equal(listenerCount(), 0)
})

test('listenerCount：可查詢特定事件', () => {
  resetBus()
  on('test:count', () => {})
  on('test:count', () => {})
  on('test:count', () => {})

  assert.equal(listenerCount('test:count'), 3)
})

// ============================================================================
// 額外測試：事件發送後同步性
// ============================================================================
test('emit：應同步發送（不等待非同步）', () => {
  let order = []

  on('sync:test', () => order.push('listener'))
  emit('sync:test', {})
  order.push('after-emit')

  assert.deepEqual(order, ['listener', 'after-emit'])
})