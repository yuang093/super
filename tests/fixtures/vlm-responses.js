// 🤖 tests/fixtures/vlm-responses.js
// 50 個 VLM 回應 mock 樣本，覆蓋各種成功/失敗場景
// 對應 [TESTING_PLAN.md §3.1 U-AI-01 ~ U-AI-10](../../TESTING_PLAN.md)

'use strict';

/**
 * 第一層可解析：完美 JSON（20 個）
 */
const PERFECT_JSON = [
  // 場景 1-5：基本完美 JSON
  { input: '{"name":"Fuji Apple","price":45,"currency":"TWD","confidence":0.92,"category":"fruit"}', expected: { method: 'json', name: 'Fuji Apple', price: 45, currency: 'TWD' } },
  { input: '{"name":"Hokkaido Milk","price":98,"currency":"TWD","confidence":0.88,"category":"dairy"}', expected: { method: 'json', name: 'Hokkaido Milk', price: 98, currency: 'TWD' } },
  { input: '{"name":"Sourdough Loaf","price":145,"currency":"TWD","confidence":0.95,"category":"bakery"}', expected: { method: 'json', name: 'Sourdough Loaf', price: 145, currency: 'TWD' } },
  { input: '{"name":"Coffee Beans","price":420,"currency":"TWD","confidence":0.87,"category":"beverage"}', expected: { method: 'json', name: 'Coffee Beans', price: 420, currency: 'TWD' } },
  { input: '{"name":"Salmon Fillet","price":356,"currency":"TWD","confidence":0.91,"category":"meat"}', expected: { method: 'json', name: 'Salmon Fillet', price: 356, currency: 'TWD' } },

  // 場景 6-10：多幣別
  { input: '{"name":"Banana","price":1.99,"currency":"USD","confidence":0.93}', expected: { method: 'json', name: 'Banana', price: 1.99, currency: 'USD' } },
  { input: '{"name":"りんご","price":198,"currency":"JPY","confidence":0.89}', expected: { method: 'json', name: 'りんご', price: 198, currency: 'JPY' } },
  { input: '{"name":"Lait","price":2.50,"currency":"EUR","confidence":0.85}', expected: { method: 'json', name: 'Lait', price: 2.50, currency: 'EUR' } },
  { input: '{"name":"우유","price":3500,"currency":"KRW","confidence":0.88}', expected: { method: 'json', name: '우유', price: 3500, currency: 'KRW' } },
  { input: '{"name":"苹果","price":12.5,"currency":"CNY","confidence":0.90}', expected: { method: 'json', name: '苹果', price: 12.5, currency: 'CNY' } },

  // 場景 11-15：缺欄位（部分缺失）
  { input: '{"name":"Pineapple","price":80}', expected: { method: 'json', name: 'Pineapple', price: 80 } }, // 缺 currency
  { input: '{"name":"Mango","currency":"TWD","confidence":0.85}', expected: { method: 'json', name: 'Mango', price: null, currency: 'TWD' } }, // 缺 price
  { input: '{"price":99,"currency":"TWD","confidence":0.8}', expected: { method: 'json', name: null, price: 99, currency: 'TWD' } }, // 缺 name
  { input: '{"name":"Eggs","price":50,"currency":"TWD"}', expected: { method: 'json', name: 'Eggs', price: 50, currency: 'TWD' } }, // 缺 confidence
  { input: '{"name":"Tea","price":35,"currency":"TWD","confidence":1.5}', expected: { method: 'json', name: 'Tea', price: 35, currency: 'TWD' } }, // confidence > 1 應被 clamp

  // 場景 16-20：JSON 內含 markdown 包裝或前後文字
  { input: '```json\n{"name":"Apple","price":50,"currency":"TWD","confidence":0.9}\n```', expected: { method: 'json', name: 'Apple', price: 50, currency: 'TWD' } },
  { input: '```\n{"name":"Banana","price":30,"currency":"TWD","confidence":0.88}\n```', expected: { method: 'json', name: 'Banana', price: 30, currency: 'TWD' } },
  { input: 'Here is the result:\n{"name":"Orange","price":40,"currency":"TWD","confidence":0.91}\nThat\'s all.', expected: { method: 'json', name: 'Orange', price: 40, currency: 'TWD' } },
  { input: '  {"name":"Grape","price":120,"currency":"TWD","confidence":0.85}  ', expected: { method: 'json', name: 'Grape', price: 120, currency: 'TWD' } }, // 含多餘空白
  { input: '{"name":"Watermelon","price":250,"currency":"TWD","confidence":0.93,"category":"fruit","extraField":"ignored"}', expected: { method: 'json', name: 'Watermelon', price: 250, currency: 'TWD' } }, // 含多餘欄位
];

/**
 * 第二層可解析：Regex 場景（15 個）
 */
const REGEX_PARSABLE = [
  // 中文標籤風格
  { input: '商品名稱:富士蘋果 價格:45元', expected: { method: 'regex', name: '富士蘋果', price: 45 } },
  { input: '商品:番茄 價格:30元', expected: { method: 'regex', name: '番茄', price: 30 } },
  { input: 'Name: Apple Price: 50', expected: { method: 'regex', name: 'Apple', price: 50 } },
  { input: 'Product: Milk, Cost: $3.99', expected: { method: 'regex', name: 'Milk', price: 3.99 } },
  { input: '品名:巧克力 售價:NT$65', expected: { method: 'regex', name: '巧克力', price: 65 } },

  // 符號在前
  { input: 'NT$45 富士蘋果', expected: { method: 'regex', name: '富士蘋果', price: 45 } },
  { input: '$1.99 Banana', expected: { method: 'regex', name: 'Banana', price: 1.99 } },
  { input: '¥198 りんご', expected: { method: 'regex', name: 'りんご', price: 198 } },
  { input: '€2.50 Lait', expected: { method: 'regex', name: 'Lait', price: 2.50 } },

  // 數字在前
  { input: '45元 蘋果', expected: { method: 'regex', name: '蘋果', price: 45 } },
  { input: '120 TWD Cheese', expected: { method: 'regex', name: 'Cheese', price: 120 } },

  // 含 confidence
  { input: 'Name: Steak Price: 350 置信度: 0.95', expected: { method: 'regex', name: 'Steak', price: 350 } },

  // 注意:JSON 風格樣本(如 {productName:...})會被第一層 JSON 解析器捕獲,
  // 所以已從 REGEX_PARSABLE 移除。
];

/**
 * 第三層可解析：啟發式場景（10 個）
 */
const HEURISTIC_PARSABLE = [
  // 純描述但有數字
  { input: 'This is a fresh red apple, costs about 45 dollars', expected: { method: 'heuristic', name: 'This is a fresh red apple, costs about 45 dol', price: 45 } },
  { input: '我看到一個紅色的蘋果，大約 50 元', expected: { method: 'heuristic', name: '我看到一個紅色的蘋果，大約 50', price: 50 } },
  { input: 'A bag of oranges priced at 30', expected: { method: 'heuristic', name: 'A bag of oranges priced at', price: 30 } },
  { input: '一盒牛奶 65', expected: { method: 'heuristic', name: '一盒牛奶', price: 65 } },
  { input: 'Coffee beans 250g around 420 NT', expected: { method: 'heuristic', name: 'Coffee beans g around NT', price: 420 } },

  // 完全無數字（應該失敗）
  { input: 'This is a banana', expected: { method: 'heuristic', name: 'This is a banana', price: null, success: false } },
  { input: 'I cannot see clearly', expected: { method: 'heuristic', name: 'I cannot see clearly', price: null, success: false } },

  // 含多個數字（取最大）
  { input: 'Bread with weight 500g costs 80 TWD', expected: { method: 'heuristic', name: 'Bread with weight g costs TWD', price: 500 } }, // 啟發式取最大
  { input: 'Apple 3 pieces 45', expected: { method: 'heuristic', name: 'Apple pieces', price: 45 } },

  // 中文
  { input: '蘋果 45', expected: { method: 'heuristic', name: '蘋果', price: 45 } },
];

/**
 * 完全無法解析（5 個）
 */
const UNPARSABLE = [
  { input: '', expected: { success: false } },
  { input: null, expected: { success: false } },
  { input: '   ', expected: { success: false } },
  { input: '{"error":"image too blurry"}', expected: { success: false } },
  { input: 'not json at all and no numbers either', expected: { success: false } },
];

/**
 * 所有樣本彙總
 */
const ALL_SAMPLES = [
  ...PERFECT_JSON.map((s, i) => ({ ...s, _id: `PERFECT_JSON_${i + 1}`, _expectedSuccess: true })),
  ...REGEX_PARSABLE.map((s, i) => ({ ...s, _id: `REGEX_${i + 1}`, _expectedSuccess: true })),
  ...HEURISTIC_PARSABLE.map((s, i) => ({
    ...s,
    _id: `HEURISTIC_${i + 1}`,
    _expectedSuccess: s.expected.success !== false,
  })),
  ...UNPARSABLE.map((s, i) => ({ ...s, _id: `UNPARSABLE_${i + 1}`, _expectedSuccess: false })),
];

module.exports = {
  PERFECT_JSON,
  REGEX_PARSABLE,
  HEURISTIC_PARSABLE,
  UNPARSABLE,
  ALL_SAMPLES,
};
