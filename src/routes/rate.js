// 🤖 src/routes/rate.js
// 匯率 API 路由
// 對應 [todo_progress.md B-08]
// GET /api/rate?currency=USD → 回傳匯率
// GET /api/rates → 回傳所有匯率

'use strict'

const express = require('express')
const { getRateService } = require('../services/rate.service')
const logger = require('../utils/logger')
const { AppError } = require('../middleware/errorHandler')

const router = express.Router()

/**
 * GET /api/rate?currency=USD
 * 查詢特定幣別的匯率（相對於 USD）
 */
router.get('/rate', async (req, res, next) => {
  try {
    const currency = (req.query.currency || 'USD').toUpperCase()

    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new AppError('無效的幣別格式，請使用3 碼大寫字母（如 USD、TWD）', {
        code: 'INVALID_CURRENCY',
        status: 400,
      })
    }

    const rateService = getRateService()
    const rate = await rateService.getRate('USD', currency)

    if (rate === null) {
      throw new AppError(`查無 ${currency} 匯率`, {
        code: 'RATE_NOT_FOUND',
        status: 404,
      })
    }

    logger.debug('💱匯率查詢', { currency, rate })

    res.json({
      success: true,
      currency,
      rate,
      base: 'USD',
    })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/rates
 * 回傳所有可用匯率
 */
router.get('/rates', async (req, res, next) => {
  try {
    const rateService = getRateService()
    // API 回傳「每 1 USD = X 外幣」，需轉換為「每 1 外幣 = Y TWD」
    // 公式：TWD_rate = TWD_USD_rate / ForeignCurrency_USD_rate
    const usdRates = await rateService.getRates('USD')
    const twdPerUsd = usdRates.TWD || 31.5

    // 將「每 USD」格式轉換為「每單位外幣可換多少 TWD」
    const ratesAsTwd = {}
    for (const [currency, ratePerUsd] of Object.entries(usdRates)) {
      if (currency === 'TWD') {
        ratesAsTwd[currency] = 1
      } else if (typeof ratePerUsd === 'number' && ratePerUsd > 0) {
        // 1 外幣 = TWD_USD / ForeignCurrency_USD TWD
        ratesAsTwd[currency] = parseFloat((twdPerUsd / ratePerUsd).toFixed(6))
      }
    }

    logger.debug('💱 匯率列表查詢（已轉換為 TWD 格式）', { currencies: Object.keys(ratesAsTwd) })

    res.json({
      success: true,
      base: 'USD',
      rates: ratesAsTwd,
      timestamp: Date.now(),
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
