// 🤖 src/routes/rate.js
// 匯率 API 路由
// 對應 [todo_progress.md B-08]
// GET /api/rate?currency=USD → 回傳匯率
// GET /api/rates → 回傳所有匯率

'use strict';

const express = require('express');
const { getRateService } = require('../services/rate.service');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * GET /api/rate?currency=USD
 * 查詢特定幣別的匯率（相對於 USD）
 */
router.get('/rate', async (req, res, next) => {
  try {
    const currency = (req.query.currency || 'USD').toUpperCase();

    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new AppError('無效的幣別格式，請使用3 碼大寫字母（如 USD、TWD）', {
        code: 'INVALID_CURRENCY',
        status: 400,
      });
    }

    const rateService = getRateService();
    const rate = await rateService.getRate('USD', currency);

    if (rate === null) {
      throw new AppError(`查無 ${currency} 匯率`, {
        code: 'RATE_NOT_FOUND',
        status: 404,
      });
    }

    logger.debug('💱匯率查詢', { currency, rate });

    res.json({
      success: true,
      currency,
      rate,
      base: 'USD',
 });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/rates
 * 回傳所有可用匯率
 */
router.get('/rates', async (req, res, next) => {
  try {
    const rateService = getRateService();
    const rates = await rateService.getRates('USD');

    logger.debug('💱 匯率列表查詢', { currencies: Object.keys(rates) });

    res.json({
      success: true,
      base: 'USD',
      rates,
      timestamp: Date.now(),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
