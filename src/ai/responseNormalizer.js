// 🤖 src/ai/responseNormalizer.js
// 將任何 parser 的結果標準化為統一格式
// 對應 [todo_progress.md B-05](../../todo_progress.md)

'use strict';

/**
 * 標準化回傳格式
 * @typedef {Object} NormalizedResult
 * @property {boolean} success
 * @property {'json'|'regex'|'heuristic'|'none'} parseMethod
 * @property {string|null} name
 * @property {number|null} price
 * @property {string|null} currency
 * @property {number|null} confidence
 * @property {string|null} errorCode
 * @property {string|null} errorMessage
 * @property {string} rawResponse
 * @property {string} timestamp
 */

/**
 * 已知的 ISO 4217 貨幣代碼白名單
 * 避免將任意 3 字母字串誤判為貨幣代碼
 */
const ISO_4217_CODES = new Set([
  'TWD', 'USD', 'JPY', 'EUR', 'GBP', 'KRW', 'CNY',
  'AUD', 'CAD', 'CHF', 'HKD', 'SGD', 'NZD', 'THB',
  'MYR', 'PHP', 'IDR', 'VND', 'INR', 'RUB', 'BRL',
  'MXN', 'ARS', 'CLP', 'COP', 'PEN', 'ZAR', 'TRY',
  'AED', 'SAR', 'ILS', 'EGP', 'NOK', 'SEK', 'DKK',
  'PLN', 'CZK', 'HUF', 'THB', 'MYR', 'NZD',
]);

/**
 * 標準化貨幣代碼
 * @param {string} raw
 * @returns {string|null}
 */
function normalizeCurrency(raw) {
  if (!raw || typeof raw !== 'string') return null;

  const upper = raw.toUpperCase().trim();
  // ISO 4217 常見幣別對照
  const currencyMap = {
    'NT$': 'TWD',
    'NT': 'TWD',
    '新台幣': 'TWD',
    'TW': 'TWD',
    '$': 'USD',
    'USD': 'USD',
    'US': 'USD',
    '美金': 'USD',
    '¥': 'JPY',
    'JPY': 'JPY',
    '円': 'JPY',
    '日圓': 'JPY',
    '€': 'EUR',
    'EUR': 'EUR',
    '歐元': 'EUR',
    '£': 'GBP',
    'GBP': 'GBP',
    '英鎊': 'GBP',
    '₩': 'KRW',
    'KRW': 'KRW',
    '韓元': 'KRW',
    'RMB': 'CNY',
    'CNY': 'CNY',
    '人民幣': 'CNY',
  };

  if (currencyMap[upper]) return currencyMap[upper];

  // 必須是已知 ISO 4217 代碼才能接受
  if (ISO_4217_CODES.has(upper)) return upper;

  return null;
}

/**
 * 標準化品名
 * @param {string} raw
 * @returns {string|null}
 */
function normalizeName(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > 100) return trimmed.substring(0, 100) + '…';
  return trimmed;
}

/**
 * 標準化價格
 * @param {*} raw
 * @returns {number|null}
 */
function normalizePrice(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
    return Math.round(raw * 100) / 100; // 保留兩位小數
  }
  if (typeof raw === 'string') {
    // 若字串含負號，視為無效（價格不應為負）
    if (raw.includes('-') && !/^\s*-?\d/.test(raw)) {
      // 例外：開頭的 - 才視為負號
      // 若 - 出現在字串中間（例如 "100 - 5"），不算負
    }
    // 簡化：若字串以 - 開頭，視為負數
    if (/^\s*-/.test(raw)) {
      return null;
    }
    // 提取數字（含小數）
    const match = raw.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
    if (match) {
      const num = parseFloat(match[0]);
      if (Number.isFinite(num) && num >= 0) {
        return Math.round(num * 100) / 100;
      }
    }
  }
  return null;
}

/**
 * 標準化信心度
 * @param {*} raw
 * @returns {number}
 */
function normalizeConfidence(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.max(0, Math.min(1, raw));
  }
  return 0.5; // 預設中等信心
}

/**
 * 建立成功結果
 * @param {Object} params
 * @returns {NormalizedResult}
 */
function buildSuccess({ parseMethod, name, price, currency, confidence, rawResponse }) {
  return {
    success: true,
    parseMethod,
    name: normalizeName(name),
    price: normalizePrice(price),
    currency: normalizeCurrency(currency),
    confidence: normalizeConfidence(confidence),
    errorCode: null,
    errorMessage: null,
    rawResponse: rawResponse || '',
    timestamp: new Date().toISOString(),
  };
}

/**
 * 建立失敗結果
 * @param {Object} params
 * @returns {NormalizedResult}
 */
function buildFailure({ errorCode, errorMessage, rawResponse, parseMethod = 'none' }) {
  return {
    success: false,
    parseMethod,
    name: null,
    price: null,
    currency: null,
    confidence: null,
    errorCode: errorCode || 'PARSE_FAILED',
    errorMessage: errorMessage || '解析失敗',
    rawResponse: rawResponse || '',
    timestamp: new Date().toISOString(),
  };
}

/**
 * 將任一物件欄位標準化（容忍欄位缺失）
 * @param {Object} raw
 * @returns {Object}
 */
function normalizeFields(raw) {
  if (!raw || typeof raw !== 'object') {
    return { name: null, price: null, currency: null, confidence: null };
  }
  return {
    name: raw.name || raw.productName || raw.product || null,
    price: raw.price !== undefined ? raw.price : (raw.cost || raw.amount || null),
    currency: raw.currency || raw.unit || null,
    confidence: raw.confidence !== undefined ? raw.confidence : (raw.score || null),
  };
}

module.exports = {
  normalizeCurrency,
  normalizeName,
  normalizePrice,
  normalizeConfidence,
  buildSuccess,
  buildFailure,
  normalizeFields,
};
