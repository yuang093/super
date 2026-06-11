// 🤖 src/routes/stats.js
// 拜訪統計 API
// GET /api/stats/summary - 摘要（總拜訪、線上、新/回訪）
// GET /api/stats/hourly - 每小時拜訪量（24小時）
// GET /api/stats/daily - 每日拜訪量（30天）
// GET /api/stats/now - 即時在線人數

'use strict'

const express = require('express')
const { getDatabase } = require('../db/database')

const router = express.Router()

const FIVE_MINUTES_MS = 5 * 60 * 1000
const ONE_DAY_MS = 24 * 60 * 60 * 1000

// ============================================================================
// GET /api/stats/now - 即時在線人數
// ============================================================================
router.get('/stats/now', (req, res) => {
  try {
    const db = getDatabase()
    const now = Date.now()
    const cutoff = now - FIVE_MINUTES_MS

    const row = db.prepare(`
      SELECT COUNT(*) as count FROM online_users WHERE last_seen_at > ?
    `).get(cutoff)

    res.json({ online: row.count, updated_at: now })
  } catch (err) {
    res.status(500).json({ error: '讀取失敗' })
  }
})

// ============================================================================
// GET /api/stats/summary - 摘要統計
// ============================================================================
router.get('/stats/summary', (req, res) => {
  try {
    const db = getDatabase()
    const now = Date.now()
    const todayStart = new Date().setHours(0, 0, 0, 0)
    const weekStart = now - 7 * ONE_DAY_MS

    // 總拜訪次數（page_views 表）
    const totalViews = db.prepare('SELECT COUNT(*) as count FROM page_views').get().count

    // 今日拜訪
    const todayViews = db.prepare(
      'SELECT COUNT(*) as count FROM page_views WHERE visited_at >= ?'
    ).get(todayStart).count

    // 本週拜訪
    const weekViews = db.prepare(
      'SELECT COUNT(*) as count FROM page_views WHERE visited_at >= ?'
    ).get(weekStart).count

    // 總獨立訪客數
    const totalVisitors = db.prepare(
      'SELECT COUNT(DISTINCT fingerprint_hash) as count FROM page_views'
    ).get().count

    // 今日新訪客（第一次出現在今日的）
    const todayNewVisitors = db.prepare(`
      SELECT COUNT(DISTINCT fingerprint_hash) as count
      FROM page_views
      WHERE visited_at >= ? AND fingerprint_hash NOT IN (
        SELECT DISTINCT fingerprint_hash FROM page_views WHERE visited_at < ?
      )
    `).get(todayStart, todayStart).count

    // 即時在線
    const onlineCutoff = now - FIVE_MINUTES_MS
    const onlineUsers = db.prepare(
      'SELECT COUNT(*) as count FROM online_users WHERE last_seen_at > ?'
    ).get(onlineCutoff).count

    res.json({
      total_views: totalViews,
      today_views: todayViews,
      week_views: weekViews,
      total_visitors: totalVisitors,
      today_new_visitors: todayNewVisitors,
      online: onlineUsers,
      updated_at: now,
    })
  } catch (err) {
    res.status(500).json({ error: '讀取失敗' })
  }
})

// ============================================================================
// GET /api/stats/hourly - 每小時拜訪量（24小時）
// ============================================================================
router.get('/stats/hourly', (req, res) => {
  try {
    const db = getDatabase()
    const now = Date.now()
    const oneDayAgo = now - ONE_DAY_MS

    const rows = db.prepare(`
      SELECT
        visited_at,
        COUNT(*) as count
      FROM page_views
      WHERE visited_at >= ?
      GROUP BY strftime('%Y-%m-%d %H:00', datetime(visited_at / 1000, 'unixepoch', 'localtime'))
      ORDER BY visited_at ASC
    `).all(oneDayAgo)

    // 格式化為小時陣列
    const hourlyData = []
    for (let i = 0; i < 24; i++) {
      hourlyData.push({ hour: i, count: 0 })
    }

    for (const row of rows) {
      const date = new Date(row.visited_at)
      const hour = date.getHours()
      const existing = hourlyData.find((h) => h.hour === hour)
      if (existing) {
        existing.count = row.count
      }
    }

    res.json({ data: hourlyData, updated_at: now })
  } catch (err) {
    res.status(500).json({ error: '讀取失敗' })
  }
})

// ============================================================================
// GET /api/stats/daily - 每日拜訪量（30天）
// ============================================================================
router.get('/stats/daily', (req, res) => {
  try {
    const db = getDatabase()
    const now = Date.now()
    const thirtyDaysAgo = now - 30 * ONE_DAY_MS

    const rows = db.prepare(`
      SELECT
        date(visited_at / 1000, 'unixepoch', 'localtime') as day,
        COUNT(*) as count
      FROM page_views
      WHERE visited_at >= ?
      GROUP BY day
      ORDER BY day ASC
    `).all(thirtyDaysAgo)

    res.json({ data: rows, updated_at: now })
  } catch (err) {
    res.status(500).json({ error: '讀取失敗' })
  }
})

// ============================================================================
// GET /api/stats/devices - 設備類型統計
// ============================================================================
router.get('/stats/devices', (req, res) => {
  try {
    const db = getDatabase()
    const now = Date.now()
    const thirtyDaysAgo = now - 30 * ONE_DAY_MS

    // 設備類型分布（30天）
    const deviceRows = db.prepare(`
      SELECT device_type, COUNT(*) as count
      FROM page_views
      WHERE visited_at >= ?
      GROUP BY device_type
      ORDER BY count DESC
    `).all(thirtyDaysAgo)

    // 設備類型（今日）
    const todayStart = new Date().setHours(0, 0, 0, 0)
    const todayDeviceRows = db.prepare(`
      SELECT device_type, COUNT(*) as count
      FROM page_views
      WHERE visited_at >= ?
      GROUP BY device_type
      ORDER BY count DESC
    `).all(todayStart)

    res.json({
      total: deviceRows,
      today: todayDeviceRows,
      updated_at: now,
    })
  } catch (err) {
    res.status(500).json({ error: '讀取失敗' })
  }
})

// ============================================================================
// GET /api/stats/geo - 流量來源國家分布
// ============================================================================
router.get('/stats/geo', (req, res) => {
  try {
    const db = getDatabase()
    const now = Date.now()
    const thirtyDaysAgo = now - 30 * ONE_DAY_MS

    // 國家分布（30天）
    const geoRows = db.prepare(`
      SELECT country, COUNT(*) as count
      FROM page_views
      WHERE visited_at >= ? AND country IS NOT NULL
      GROUP BY country
      ORDER BY count DESC
      LIMIT 20
    `).all(thirtyDaysAgo)

    // 國家分布（今日）
    const todayStart = new Date().setHours(0, 0, 0, 0)
    const todayGeoRows = db.prepare(`
      SELECT country, COUNT(*) as count
      FROM page_views
      WHERE visited_at >= ? AND country IS NOT NULL
      GROUP BY country
      ORDER BY count DESC
      LIMIT 20
    `).all(todayStart)

    // 未知國家數
    const unknownCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM page_views
      WHERE visited_at >= ? AND (country IS NULL OR country = '')
    `).get(thirtyDaysAgo).count

    res.json({
      total: geoRows,
      today: todayGeoRows,
      unknown: unknownCount,
      updated_at: now,
    })
  } catch (err) {
    res.status(500).json({ error: '讀取失敗' })
  }
})

module.exports = router