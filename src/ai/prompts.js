// 🤖 src/ai/prompts.js
// VLM（視覺語言模型）的提示詞模板
// 對應 [todo_progress.md B-04](../../todo_progress.md) 與 [PROJECT_CONTEXT.md §8](../../PROJECT_CONTEXT.md)

'use strict'

/**
 * 通用商品辨識提示詞（MiniMax-M3 相容）
 *
 * 要求回傳結構化 JSON 包含：
 * - name: 商品名稱（中文優先，若無則英文）
 * - price: 價格（數字，不含貨幣符號）
 * - currency: ISO 4217 三字代碼（TWD、USD、JPY 等）
 * - confidence: 0-1 之間的信心度
 * - category: 商品類別（fruit、vegetable、beverage、snack、other）
 *
 * @type {string}
 */
const PRODUCT_RECOGNITION_PROMPT = `You are a product recognition specialist for a shopping receipt/expiry system.

Analyze the image and return ONLY a valid JSON object (no markdown, no explanations) with this exact structure:

{
  "name": "商品名稱（中文優先）",
  "price": 45.00,
  "currency": "TWD",
  "confidence": 0.92,
  "category": "fruit"
}

RULES:
1. Return ONLY the JSON object, nothing else
2. If multiple items, return the MOST PROMINENT one
3. price must be a NUMBER (no currency symbols)
4. currency must be ISO 4217 3-letter code
5. confidence is your self-assessed accuracy (0.0-1.0)
6. category is one of: fruit, vegetable, beverage, snack, dairy, meat, bakery, household, other
7. If image is unclear or no product visible, return: {"error": "reason"}
8. DO NOT wrap in markdown code blocks
9. NO preamble text

Return now:`

/**
 * 價格標籤專用提示詞（更聚焦於價格）
 * @type {string}
 */
const PRICE_TAG_PROMPT = `This is a price tag or shelf label. Extract the product name and price precisely.

Return ONLY JSON:
{
  "name": "商品名稱",
  "price": 45.00,
  "currency": "TWD",
  "confidence": 0.95,
  "category": "other"
}

If you cannot read the price clearly, set confidence below 0.5.

Return now:`

module.exports = {
  PRODUCT_RECOGNITION_PROMPT,
  PRICE_TAG_PROMPT,
}
