// 🤖 src/routes/visit.js
// 瀏覽計數器 API
// GET /api/visit → { count: number }

'use strict'

const express = require('express')
const fs = require('node:fs')
const path = require('node:path')

const router = express.Router()
const COUNTER_FILE = path.join(__dirname, '..', '..', 'counter.json')

/**
 * 讀取當前計數
 * @returns {number}
 */
function readCounter() {
  try {
    if (fs.existsSync(COUNTER_FILE)) {
      const data = fs.readFileSync(COUNTER_FILE, 'utf8')
      const parsed = JSON.parse(data)
      return typeof parsed.count === 'number' ? parsed.count : 0
    }
  } catch (err) {
    // 檔案損壞或讀取失敗，回傳 0
  }
  return 0
}

/**
 * 寫入計數
 * @param {number} count
 */
function writeCounter(count) {
  fs.writeFileSync(COUNTER_FILE, JSON.stringify({ count }, null, 2), 'utf8')
}

/**
 * GET /api/visit
 * 瀏覽 +1 並回傳最新數字
 */
router.get('/visit', (req, res) => {
  try {
    const current = readCounter()
    const next = current + 1
    writeCounter(next)
    res.json({ count: next })
  } catch (err) {
    res.status(500).json({ error: '計數器讀寫失敗' })
  }
})

module.exports = router