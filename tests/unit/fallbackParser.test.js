// 🤖 tests/unit/fallbackParser.test.js
// fallbackParser 三層 Fallback 解析的單元測試
// 跑法：node --test tests/unit/fallbackParser.test.js

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  parseVLMResponse,
  tryJsonParse,
  tryRegexParse,
  tryHeuristicParse,
  isValidProductObject,
  ERROR_CODES,
} = require('../../src/ai/fallbackParser');

const {
  PERFECT_JSON,
  REGEX_PARSABLE,
  HEURISTIC_PARSABLE,
  UNPARSABLE,
  ALL_SAMPLES,
} = require('../fixtures/vlm-responses');

// ============================================================================
// 整合測試：parseVLMResponse 處理 50 個樣本
// ============================================================================
test('整合：50 個樣本的整體成功率應 ≥ 95%', () => {
  let success = 0;
  let total = ALL_SAMPLES.length;

  for (const sample of ALL_SAMPLES) {
    const result = parseVLMResponse(sample.input);
    if (result.success === sample._expectedSuccess) {
      success++;
    }
  }

  const successRate = (success / total) * 100;
  console.log(`  整體成功率: ${success}/${total} = ${successRate.toFixed(1)}%`);
  assert.ok(successRate >= 95, `整體成功率 ${successRate}% 應 >= 95%`);
});

test('整合：完美 JSON 場景（20 個）應 100% 用第一層解析', () => {
  let jsonCount = 0;

  for (const sample of PERFECT_JSON) {
    const result = parseVLMResponse(sample.input);
    assert.equal(result.success, true, `樣本應成功: ${sample.input.substring(0, 50)}`);
    assert.equal(result.parseMethod, 'json');
    assert.equal(result.name, sample.expected.name);
    assert.equal(result.price, sample.expected.price);
    jsonCount++;
  }

  assert.equal(jsonCount, 20, '20 個完美 JSON 應全部成功');
});

test('整合：Regex 場景（15 個）應 100% 用第二層解析', () => {
  for (const sample of REGEX_PARSABLE) {
    const result = parseVLMResponse(sample.input);
    assert.equal(result.success, true, `樣本應成功: ${sample.input.substring(0, 50)}`);
    assert.equal(result.parseMethod, 'regex');
    assert.equal(result.name, sample.expected.name);
    assert.equal(result.price, sample.expected.price);
  }
});

test('整合：啟發式場景應用第三層解析（成功或失敗）', () => {
  for (const sample of HEURISTIC_PARSABLE) {
    const result = parseVLMResponse(sample.input);
    if (sample.expected.success === false) {
      assert.equal(result.success, false);
    } else {
      assert.equal(result.success, true);
      assert.equal(result.parseMethod, 'heuristic');
      assert.equal(result.name, sample.expected.name);
      assert.equal(result.price, sample.expected.price);
    }
  }
});

test('整合：完全無法解析的場景應回傳 failure', () => {
  for (const sample of UNPARSABLE) {
    const result = parseVLMResponse(sample.input);
    assert.equal(result.success, false);
    assert.notEqual(result.errorCode, null);
  }
});

// ============================================================================
// 第一層：tryJsonParse
// ============================================================================
test('tryJsonParse: 完美 JSON 應成功', () => {
  const result = tryJsonParse('{"name":"Apple","price":45,"currency":"TWD"}');
  assert.equal(result.success, true);
  assert.equal(result.data.name, 'Apple');
});

test('tryJsonParse: markdown 包裝的 JSON 應成功（去除 ```）', () => {
  const result = tryJsonParse('```json\n{"name":"Apple","price":45}\n```');
  assert.equal(result.success, true);
  assert.equal(result.data.name, 'Apple');
});

test('tryJsonParse: 嵌入在文字中的 JSON 應成功', () => {
  const result = tryJsonParse('Here is the result: {"name":"Apple","price":45} That\'s it.');
  assert.equal(result.success, true);
  assert.equal(result.data.name, 'Apple');
});

test('tryJsonParse: 非 JSON 字串應失敗', () => {
  const result = tryJsonParse('not a json at all');
  assert.equal(result.success, false);
  assert.equal(result.errorCode, ERROR_CODES.PARSE_JSON_FAILED);
});

test('tryJsonParse: 損壞的 JSON 應失敗', () => {
  const result = tryJsonParse('{name: "Apple", price:}'); // 不合法 JSON
  assert.equal(result.success, false);
});

test('tryJsonParse: 純 error 物件應失敗（避免誤判）', () => {
  const result = tryJsonParse('{"error":"image too blurry"}');
  assert.equal(result.success, false);
  assert.equal(result.errorCode, ERROR_CODES.PARSE_JSON_INVALID_STRUCTURE);
});

test('tryJsonParse: 必須有 name 或 price 其中之一', () => {
  assert.equal(tryJsonParse('{}').success, false);
  assert.equal(tryJsonParse('{"random":"value"}').success, false);
  assert.equal(tryJsonParse('{"name":"Apple"}').success, true); // 只有 name
  assert.equal(tryJsonParse('{"price":45}').success, true); // 只有 price
});

// ============================================================================
// 第二層：tryRegexParse
// ============================================================================
test('tryRegexParse: 中文標籤風格應成功', () => {
  const result = tryRegexParse('商品名稱：蘋果 價格：45元');
  assert.equal(result.success, true);
  assert.equal(result.data.name, '蘋果');
  assert.equal(result.data.price, 45);
});

test('tryRegexParse: 英文標籤風格應成功', () => {
  const result = tryRegexParse('Name: Milk, Price: $3.99');
  assert.equal(result.success, true);
  assert.equal(result.data.name, 'Milk');
  assert.equal(result.data.price, 3.99);
});

test('tryRegexParse: 符號在前應成功', () => {
  const result = tryRegexParse('NT$45 蘋果');
  assert.equal(result.success, true);
  assert.equal(result.data.name, '蘋果');
  assert.equal(result.data.price, 45);
});

test('tryRegexParse: 數字在前應成功', () => {
  const result = tryRegexParse('45 元 蘋果');
  assert.equal(result.success, true);
  assert.equal(result.data.name, '蘋果');
  assert.equal(result.data.price, 45);
});

test('tryRegexParse: 缺 name 時應回傳 partial', () => {
  const result = tryRegexParse('price: 45');
  assert.equal(result.success, false);
  assert.equal(result.partial, true);
  assert.equal(result.errorCode, ERROR_CODES.REGEX_PARTIAL_MATCH);
});

test('tryRegexParse: 缺 price 時應回傳 partial', () => {
  const result = tryRegexParse('name: Apple');
  assert.equal(result.success, false);
  assert.equal(result.partial, true);
});

test('tryRegexParse: 完全無匹配應失敗', () => {
  const result = tryRegexParse('this has no structured data at all');
  assert.equal(result.success, false);
  assert.equal(result.errorCode, ERROR_CODES.REGEX_NO_MATCH);
});

// ============================================================================
// 第三層：tryHeuristicParse
// ============================================================================
test('tryHeuristicParse: 含數字的純描述應成功', () => {
  const result = tryHeuristicParse('This is a fresh apple, costs about 45 dollars');
  assert.equal(result.success, true);
  assert.equal(result.data.price, 45);
});

test('tryHeuristicParse: 多個數字取最大', () => {
  const result = tryHeuristicParse('Bread with weight 500g costs 80');
  // 啟發式策略：取最大數字
  assert.equal(result.data.price, 500);
});

test('tryHeuristicParse: 無數字應失敗', () => {
  const result = tryHeuristicParse('This is a banana');
  assert.equal(result.success, false);
  assert.equal(result.errorCode, ERROR_CODES.HEURISTIC_NO_NUMERIC);
});

test('tryHeuristicParse: 應總是返回品名（清理後）', () => {
  const result = tryHeuristicParse('```json {"name":"Apple","price":45} ```');
  // 移除 markdown 區塊與 JSON 符號
  assert.equal(result.data.name, 'json name Apple price 45');
  assert.equal(result.data.price, 45);
});

// ============================================================================
// isValidProductObject
// ============================================================================
test('isValidProductObject: 必須有 name 或 price', () => {
  assert.equal(isValidProductObject(null), false);
  assert.equal(isValidProductObject({}), false);
  assert.equal(isValidProductObject({ name: 'A' }), true);
  assert.equal(isValidProductObject({ price: 1 }), true);
  assert.equal(isValidProductObject({ name: 'A', price: 1 }), true);
  assert.equal(isValidProductObject({ random: 'value' }), false);
});

test('isValidProductObject: 純 error 物件不算有效', () => {
  assert.equal(isValidProductObject({ error: 'no image' }), false);
  assert.equal(isValidProductObject({ error: 'no image', name: 'A' }), true); // 有 name 就算
});

// ============================================================================
// 邊界情況
// ============================================================================
test('parseVLMResponse: null 輸入應失敗', () => {
  const result = parseVLMResponse(null);
  assert.equal(result.success, false);
});

test('parseVLMResponse: 空字串應失敗', () => {
  const result = parseVLMResponse('');
  assert.equal(result.success, false);
});

test('parseVLMResponse: 應包含 timestamp 與 rawResponse', () => {
  const result = parseVLMResponse('{"name":"Apple","price":45}');
  assert.ok(result.timestamp);
  assert.match(result.timestamp, /^\d{4}-\d{2}-\d{2}T/); // ISO 8601
  assert.equal(result.rawResponse, '{"name":"Apple","price":45}');
});
