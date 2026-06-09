// 🤖 src/ai/fallbackParser.js
// 三層 Fallback 解析（JSON → Regex → 啟發式）
// 對應 [todo_progress.md B-05](../../todo_progress.md)

'use strict'

const {
  buildSuccess,
  buildFailure,
  normalizeFields,
  normalizeName,
  normalizePrice,
  normalizeCurrency,
  normalizeConfidence,
} = require('./responseNormalizer')

/**
 * 錯誤碼常數
 */
const ERROR_CODES = {
  PARSE_JSON_FAILED: 'PARSE_JSON_FAILED',
  PARSE_JSON_INVALID_STRUCTURE: 'PARSE_JSON_INVALID_STRUCTURE',
  REGEX_NO_MATCH: 'REGEX_NO_MATCH',
  REGEX_PARTIAL_MATCH: 'REGEX_PARTIAL_MATCH',
  HEURISTIC_LOW_CONFIDENCE: 'HEURISTIC_LOW_CONFIDENCE',
  HEURISTIC_NO_NUMERIC: 'HEURISTIC_NO_NUMERIC',
  PARSE_FAILED: 'PARSE_FAILED',
}

/**
 * 第一層：JSON 解析
 * 嘗試從字串中提取 JSON 物件
 * @param {string} content
 * @returns {{success: boolean, data?: any, errorCode?: string, errorMessage?: string}}
 */
function tryJsonParse(content) {
  if (!content || typeof content !== 'string') {
    return {
      success: false,
      errorCode: ERROR_CODES.PARSE_JSON_FAILED,
      errorMessage: '內容為空或非字串',
    }
  }

  // 策略 1：直接 JSON.parse
  try {
    const trimmed = content.trim()
    const parsed = JSON.parse(trimmed)
    if (isValidProductObject(parsed)) {
      return { success: true, data: parsed }
    }
    return {
      success: false,
      errorCode: ERROR_CODES.PARSE_JSON_INVALID_STRUCTURE,
      errorMessage: 'JSON 結構不符合商品格式',
    }
  } catch (_) {
    // 繼續下一個策略
  }

  // 策略 2：去除 markdown 程式碼區塊後再解析
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1].trim())
      if (isValidProductObject(parsed)) {
        return { success: true, data: parsed }
      }
    } catch (_) {
      // 繼續
    }
  }

  // 策略 3：在字串中尋找最外層的 { ... } JSON 物件
  const jsonMatch = content.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])
      if (isValidProductObject(parsed)) {
        return { success: true, data: parsed }
      }
    } catch (_) {
      // 繼續
    }
  }

  return {
    success: false,
    errorCode: ERROR_CODES.PARSE_JSON_FAILED,
    errorMessage: '所有 JSON 解析策略皆失敗',
  }
}

/**
 * 驗證是否為有效的商品物件
 * @param {any} obj
 * @returns {boolean}
 */
function isValidProductObject(obj) {
  if (!obj || typeof obj !== 'object') return false
  // 必須有 name 或 price 至少一個
  if (!obj.name && obj.price === undefined) return false
  // 不能是純 error 物件
  if (obj.error && !obj.name) return false
  return true
}

/**
 * 第二層：Regex 解析
 * 從結構化文字中提取 name、price、currency
 * @param {string} content
 * @returns {{success: boolean, data?: any, partial?: boolean, errorCode?: string, errorMessage?: string}}
 */
function tryRegexParse(content) {
  if (!content || typeof content !== 'string') {
    return {
      success: false,
      errorCode: ERROR_CODES.REGEX_NO_MATCH,
      errorMessage: '內容為空或非字串',
    }
  }

  // 先清洗字串：移除 JSON 符號，標準化空白
  const cleaned = content
    .replace(/[{}[\]"'`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  let name = null
  let price = null
  let currency = null
  let confidence = null

  // === 抓取品名（必須避開「價格」「Price」「Cost」這類結界詞） ===
  // 策略：使用 lookahead 確保只抓到結界前的內容
  const namePatterns = [
    // JSON 風格：name: "Apple"（引號已被移除）
    /\bname\s*[:：=]\s*([^,，\n]{1,50}?)(?=\s*(?:[，,]|$|價格|Price|Cost|售價|價錢|Amount))/i,
    // 中文標籤風格：商品名稱：蘋果
    /(?:商品名稱|商品|品名|Product)\s*[:：=]\s*([^,，\n]{1,50}?)(?=\s*(?:[，,]|$|價格|Price|Cost|售價|價錢))/i,
    // productName 風格
    /\bproductName\s*[:：=]\s*([^,，\n]{1,50}?)(?=\s*(?:[，,]|$|價格|Price|Cost))/i,
    // product 風格
    /\bproduct\s*[:：=]\s*([^,，\n]{1,50}?)(?=\s*(?:[，,]|$|價格|Price|Cost))/i,
  ]
  for (const pattern of namePatterns) {
    const match = cleaned.match(pattern)
    if (match && match[1]) {
      const candidate = match[1].trim()
      // 排除純數字或空字串
      if (candidate.length > 0 && !/^[\d.,，\s]+$/.test(candidate)) {
        name = candidate
        break
      }
    }
  }

  // === 抓取價格（更寬鬆，因為價格就是數字） ===
  // 順序：JSON 風格 > 標籤風格 > 符號在前 > 數字在前
  const pricePatterns = [
    // JSON 風格
    /\bprice\s*[:：=]\s*["']?([\d,]+\.?\d*)/i,
    // 標籤風格：價格: 45
    /(?:價格|Price|售價|價錢|Amount|Cost)\s*[:：=]?\s*(?:約|NT\$|NT|US\$|\$|¥|€|£|₩|RMB)?\s*([\d,]+\.?\d*)/i,
    // 符號在前：NT$45, $1.99
    /(?:NT\$|NT|US\$|\$|¥|€|£|₩|RMB)\s*([\d,]+\.?\d*)/,
    // 數字在前：45元, 45 TWD
    /([\d,]+\.?\d*)\s*(?:NT\$|NT|新台幣|美金|美元|日圓|日幣|歐元|英鎊|韓元|元|圓|TWD|USD|JPY|EUR|GBP|KRW|CNY|RMB)/,
  ]
  for (const pattern of pricePatterns) {
    const match = cleaned.match(pattern)
    if (match && match[1]) {
      const num = parseFloat(match[1].replace(/,/g, ''))
      if (Number.isFinite(num) && num >= 0 && num < 1_000_000) {
        price = num
        break
      }
    }
  }

  // === 抓取貨幣 ===
  const currencyPatterns = [
    /\bcurrency\s*[:：=]\s*["']?([A-Z]{3})/i,
    /(NT\$|NT|新台幣|美金|美元|日圓|日幣|歐元|英鎊|韓元|RMB|CNY)/i,
  ]
  for (const pattern of currencyPatterns) {
    const match = cleaned.match(pattern)
    if (match && match[1]) {
      currency = match[1].trim()
      break
    }
  }

  // === 抓取信心度 ===
  const confidenceMatch = cleaned.match(/\bconfidence\s*[:：=]\s*([\d.]+)/i)
  if (confidenceMatch) {
    const conf = parseFloat(confidenceMatch[1])
    if (conf >= 0 && conf <= 1) confidence = conf
  }

  // === 新策略：當 price 匹配但 name 沒匹配時，從剩餘文字提取第一個有意義詞組 ===
  // 處理「NT$45 蘋果」「45 元 蘋果」這類無 name 標籤的場景
  if (price !== null && !name) {
    let remaining = cleaned
    // 移除已匹配的價格相關字串
    remaining = remaining.replace(/\bprice\s*[:：=]?\s*[\d.,]+/gi, '')
    remaining = remaining.replace(/(?:NT\$|NT|US\$|\$|¥|€|£|₩|RMB)\s*[\d.,]+/g, '')
    remaining = remaining.replace(
      /(?:[\d.,]+)\s*(?:NT\$|NT|新台幣|美金|美元|日圓|日幣|歐元|英鎊|韓元|元|圓|TWD|USD|JPY|EUR|GBP|KRW|CNY|RMB)/g,
      ''
    )
    remaining = remaining.replace(/\b\d+(?:\.\d+)?\b/g, '') // 移除剩餘數字
    remaining = remaining.replace(/\b(?:價格|Price|售價|價錢|Amount|Cost)\b/gi, '')

    // 取第一個有意義的詞組
    const firstWord = remaining
      .trim()
      .split(/[\s,，。.!?！？]+/)
      .find((w) => w.length > 0 && !/^[\d.,\s]+$/.test(w))
    if (firstWord) {
      name = firstWord
    }
  }

  // 判斷是否成功
  if (name && price !== null) {
    return {
      success: true,
      data: { name, price, currency, confidence: confidence ?? 0.7 },
    }
  }
  if (name || price !== null) {
    return {
      success: false,
      partial: true,
      errorCode: ERROR_CODES.REGEX_PARTIAL_MATCH,
      errorMessage: `只匹配到部分欄位（name: ${name}, price: ${price}）`,
    }
  }
  return {
    success: false,
    errorCode: ERROR_CODES.REGEX_NO_MATCH,
    errorMessage: '所有 regex 模式皆無匹配',
  }
}

/**
 * 第三層：啟發式解析
 * 將整段文字視為可能的品名，並提取任何數字作為價格
 * @param {string} content
 * @returns {{success: boolean, data?: any, errorCode?: string, errorMessage?: string}}
 */
function tryHeuristicParse(content) {
  if (!content || typeof content !== 'string') {
    return {
      success: false,
      errorCode: ERROR_CODES.HEURISTIC_NO_NUMERIC,
      errorMessage: '內容為空或非字串',
    }
  }

  // 移除 JSON 區塊、特殊字元，保留文字內容
  const cleaned = content
    .replace(/```+/g, ' ') // 移除所有反引號
    .replace(/[{}[\]":,;]/g, ' ') // 移除 JSON 符號（括號、引號、冒號、逗號、分號）
    .replace(/\s+/g, ' ')
    .trim()

  if (cleaned.length === 0) {
    return {
      success: false,
      data: { name: '', price: null, currency: null, confidence: 0.3 },
      errorCode: ERROR_CODES.HEURISTIC_NO_NUMERIC,
      errorMessage: '清理後內容為空',
    }
  }

  // 啟發式規則：
  // 1. 取前 50 字作為品名
  // 2. 若有數字，取最大數字作為價格
  // 3. confidence 永遠 < 0.5

  let name = cleaned.substring(0, 50).trim()
  // 移除尾端標點
  name = name.replace(/[。，、,.!?！？\s]+$/, '')

  // 提取任何數字
  const numbers = cleaned.match(/\d+(?:\.\d+)?/g)
  let price = null
  if (numbers && numbers.length > 0) {
    // 取最大的數字（通常價格會是最大數字）
    const nums = numbers.map(parseFloat).filter((n) => Number.isFinite(n) && n >= 0)
    if (nums.length > 0) {
      price = Math.max(...nums)
    }
  }

  if (price === null) {
    return {
      success: false,
      data: { name, price: null, currency: null, confidence: 0.3 },
      errorCode: ERROR_CODES.HEURISTIC_NO_NUMERIC,
      errorMessage: '啟發式解析未找到數字',
    }
  }

  return {
    success: true,
    data: { name, price, currency: null, confidence: 0.3 },
  }
}

/**
 * 三層 Fallback 主函式
 * @param {string} content - VLM 回傳的 content 欄位
 * @returns {NormalizedResult}
 */
function parseVLMResponse(content) {
  // 第一層：JSON
  const jsonResult = tryJsonParse(content)
  if (jsonResult.success) {
    const fields = normalizeFields(jsonResult.data)
    return buildSuccess({
      parseMethod: 'json',
      name: fields.name,
      price: fields.price,
      currency: fields.currency,
      confidence: fields.confidence,
      rawResponse: content,
    })
  }

  // 第二層：Regex
  const regexResult = tryRegexParse(content)
  if (regexResult.success) {
    const fields = normalizeFields(regexResult.data)
    return buildSuccess({
      parseMethod: 'regex',
      name: fields.name,
      price: fields.price,
      currency: fields.currency,
      confidence: fields.confidence,
      rawResponse: content,
    })
  }

  // 第三層：啟發式
  const heuristicResult = tryHeuristicParse(content)
  if (heuristicResult.success) {
    return buildSuccess({
      parseMethod: 'heuristic',
      name: heuristicResult.data.name,
      price: heuristicResult.data.price,
      currency: heuristicResult.data.currency,
      confidence: heuristicResult.data.confidence,
      rawResponse: content,
    })
  }

  // 全部失敗
  return buildFailure({
    errorCode: ERROR_CODES.PARSE_FAILED,
    errorMessage: `JSON: ${jsonResult.errorCode}; Regex: ${regexResult.errorCode}; Heuristic: ${heuristicResult.errorCode}`,
    rawResponse: content,
  })
}

module.exports = {
  parseVLMResponse,
  tryJsonParse,
  tryRegexParse,
  tryHeuristicParse,
  isValidProductObject,
  ERROR_CODES,
}
