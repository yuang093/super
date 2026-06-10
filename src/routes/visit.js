// 🤖 src/routes/visit.js
// 瀏覽計數器 API（使用 SQLite 持久化）
// GET /api/visit → { count: number }

'use strict'

const express = require('express')
const { getDatabase } = require('../db/database')

const router = express.Router()

/**
 * GET /api/visit
 * 瀏覽 +1 並回傳最新數字
 */
router.get('/visit', (req, res) => {
  try {
    const db = getDatabase()
    // 原子 increment（UPDATE + SELECT 在一個 transaction 內）
    const result = db.transaction(() => {
      db.prepare('UPDATE visit_counter SET count = count + 1 WHERE id = 1').run()
      const row = db.prepare('SELECT count FROM visit_counter WHERE id = 1').get()
      return row
    })()
    res.json({ count: result.count })
  } catch (err) {
    res.status(500).json({ error: '計數器讀寫失敗' })
  }
})

module.exports = router