// 🤖 tests/unit/responseNormalizer.test.js
// responseNormalizer 的單元測試
// 跑法：node --test tests/unit/responseNormalizer.test.js

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeCurrency,
  normalizeName,
  normalizePrice,
  normalizeConfidence,
  buildSuccess,
  buildFailure,
  normalizeFields,
} = require('../../src/ai/responseNormalizer');

// ============================================================================
// normalizeCurrency
// ============================================================================
test('normalizeCurrency: ISO 4217 三字代碼應原樣返回', () => {
  assert.equal(normalizeCurrency('TWD'), 'TWD');
  assert.equal(normalizeCurrency('USD'), 'USD');
  assert.equal(normalizeCurrency('JPY'), 'JPY');
  assert.equal(normalizeCurrency('EUR'), 'EUR');
  assert.equal(normalizeCurrency('KRW'), 'KRW');
  assert.equal(normalizeCurrency('CNY'), 'CNY');
});

test('normalizeCurrency: 帶前綴符號應映射到正確代碼', () => {
  assert.equal(normalizeCurrency('NT$'), 'TWD');
  assert.equal(normalizeCurrency('$'), 'USD');
  assert.equal(normalizeCurrency('¥'), 'JPY');
  assert.equal(normalizeCurrency('€'), 'EUR');
  assert.equal(normalizeCurrency('£'), 'GBP');
  assert.equal(normalizeCurrency('₩'), 'KRW');
});

test('normalizeCurrency: 中文貨幣名應映射到代碼', () => {
  assert.equal(normalizeCurrency('新台幣'), 'TWD');
  assert.equal(normalizeCurrency('美金'), 'USD');
  assert.equal(normalizeCurrency('日圓'), 'JPY');
  assert.equal(normalizeCurrency('歐元'), 'EUR');
  assert.equal(normalizeCurrency('英鎊'), 'GBP');
  assert.equal(normalizeCurrency('韓元'), 'KRW');
  assert.equal(normalizeCurrency('人民幣'), 'CNY');
});

test('normalizeCurrency: 大小寫不敏感', () => {
  assert.equal(normalizeCurrency('twd'), 'TWD');
  assert.equal(normalizeCurrency('usd'), 'USD');
  assert.equal(normalizeCurrency('NT$'), 'TWD');
});

test('normalizeCurrency: 輸入無效時返回 null', () => {
  assert.equal(normalizeCurrency(null), null);
  assert.equal(normalizeCurrency(undefined), null);
  assert.equal(normalizeCurrency(''), null);
  assert.equal(normalizeCurrency(123), null);
  assert.equal(normalizeCurrency({}), null);
  assert.equal(normalizeCurrency('XYZ'), null); // 未知貨幣
});

// ============================================================================
// normalizeName
// ============================================================================
test('normalizeName: 應去除前後空白', () => {
  assert.equal(normalizeName('  Apple  '), 'Apple');
  assert.equal(normalizeName('蘋果'), '蘋果');
});

test('normalizeName: 超過 100 字元應截斷', () => {
  const long = 'a'.repeat(150);
  const result = normalizeName(long);
  assert.ok(result.length <= 103); // 100 + '…'
  assert.ok(result.endsWith('…'));
});

test('normalizeName: 輸入無效時返回 null', () => {
  assert.equal(normalizeName(null), null);
  assert.equal(normalizeName(undefined), null);
  assert.equal(normalizeName(''), null);
  assert.equal(normalizeName('   '), null);
  assert.equal(normalizeName(123), null);
});

// ============================================================================
// normalizePrice
// ============================================================================
test('normalizePrice: 數字應保留兩位小數', () => {
  assert.equal(normalizePrice(45), 45);
  assert.equal(normalizePrice(45.5), 45.5);
  assert.equal(normalizePrice(45.123), 45.12); // 四捨五入到兩位
  assert.equal(normalizePrice(45.999), 46);
});

test('normalizePrice: 字串含逗號千分位應正確解析', () => {
  assert.equal(normalizePrice('1,234'), 1234);
  assert.equal(normalizePrice('1,234.56'), 1234.56);
  assert.equal(normalizePrice('45'), 45);
  assert.equal(normalizePrice('45.99'), 45.99);
});

test('normalizePrice: 從混雜字串中提取數字', () => {
  assert.equal(normalizePrice('NT$45'), 45);
  assert.equal(normalizePrice('約 50 元'), 50);
  assert.equal(normalizePrice('price: 99.99'), 99.99);
});

test('normalizePrice: 負數應返回 null', () => {
  assert.equal(normalizePrice(-1), null);
  assert.equal(normalizePrice('-5'), null);
});

test('normalizePrice: 無效輸入應返回 null', () => {
  assert.equal(normalizePrice(null), null);
  assert.equal(normalizePrice(undefined), null);
  assert.equal(normalizePrice('abc'), null);
  assert.equal(normalizePrice({}), null);
  assert.equal(normalizePrice(NaN), null);
});

// ============================================================================
// normalizeConfidence
// ============================================================================
test('normalizeConfidence: 0-1 範圍應原樣返回', () => {
  assert.equal(normalizeConfidence(0), 0);
  assert.equal(normalizeConfidence(0.5), 0.5);
  assert.equal(normalizeConfidence(1), 1);
});

test('normalizeConfidence: 超出範圍應 clamp', () => {
  assert.equal(normalizeConfidence(1.5), 1);
  assert.equal(normalizeConfidence(-0.5), 0);
});

test('normalizeConfidence: 無效輸入應返回預設 0.5', () => {
  assert.equal(normalizeConfidence(null), 0.5);
  assert.equal(normalizeConfidence(undefined), 0.5);
  assert.equal(normalizeConfidence('abc'), 0.5);
  assert.equal(normalizeConfidence(NaN), 0.5);
});

// ============================================================================
// buildSuccess
// ============================================================================
test('buildSuccess: 應建立完整成功結果', () => {
  const result = buildSuccess({
    parseMethod: 'json',
    name: 'Apple',
    price: 45,
    currency: 'TWD',
    confidence: 0.9,
    rawResponse: '...',
  });
  assert.equal(result.success, true);
  assert.equal(result.parseMethod, 'json');
  assert.equal(result.name, 'Apple');
  assert.equal(result.price, 45);
  assert.equal(result.currency, 'TWD');
  assert.equal(result.confidence, 0.9);
  assert.equal(result.errorCode, null);
  assert.equal(result.errorMessage, null);
  assert.equal(result.rawResponse, '...');
  assert.ok(result.timestamp);
});

// ============================================================================
// buildFailure
// ============================================================================
test('buildFailure: 應建立完整失敗結果', () => {
  const result = buildFailure({
    errorCode: 'PARSE_FAILED',
    errorMessage: '...',
    rawResponse: 'xxx',
  });
  assert.equal(result.success, false);
  assert.equal(result.parseMethod, 'none');
  assert.equal(result.name, null);
  assert.equal(result.errorCode, 'PARSE_FAILED');
  assert.equal(result.errorMessage, '...');
  assert.equal(result.rawResponse, 'xxx');
});

// ============================================================================
// normalizeFields
// ============================================================================
test('normalizeFields: 應容忍欄位命名變體', () => {
  assert.deepEqual(
    normalizeFields({ name: 'A', price: 1, currency: 'TWD', confidence: 0.9 }),
    { name: 'A', price: 1, currency: 'TWD', confidence: 0.9 }
  );
  assert.deepEqual(
    normalizeFields({ productName: 'B', cost: 2, unit: 'USD', score: 0.8 }),
    { name: 'B', price: 2, currency: 'USD', confidence: 0.8 }
  );
  assert.deepEqual(
    normalizeFields({ product: 'C', amount: 3 }),
    { name: 'C', price: 3, currency: null, confidence: null }
  );
});

test('normalizeFields: 空輸入應返回全部 null', () => {
  assert.deepEqual(normalizeFields(null), { name: null, price: null, currency: null, confidence: null });
  assert.deepEqual(normalizeFields({}), { name: null, price: null, currency: null, confidence: null });
});
