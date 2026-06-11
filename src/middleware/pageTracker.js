// 🤖 src/middleware/pageTracker.js
// 頁面瀏覽追蹤中介層
// 每次有人訪問網站時記錄到 page_views 表

'use strict'

const crypto = require('node:crypto')
const { getEnv } = require('../config/env')
const { getDatabase } = require('../db/database')

const FIVE_MINUTES_MS = 5 * 60 * 1000

/**
 * 計算 IP 指紋
 * @param {string} ip - 客戶端 IP
 * @param {string} salt - IP_SALT
 * @returns {string} SHA-256 hash
 */
function computeFingerprint(ip, salt) {
  return crypto.createHash('sha256').update(ip + salt).digest('hex')
}

/**
 * 追蹤頁面瀏覽（自動呼叫）
 * @param {express.Request} req
 */
function trackPageView(req) {
  try {
    const env = getEnv()
    const db = getDatabase()

    // 取得 IP（支援 proxy）
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || req.headers['x-real-ip']
      || req.socket.remoteAddress
      || 'unknown'

    const fingerprintHash = computeFingerprint(ip, env.IP_SALT || 'default-salt')
    const now = Date.now()
    const userAgent = req.headers['user-agent'] || 'unknown'

    // 寫入 page_views
    db.prepare(`
      INSERT INTO page_views (fingerprint_hash, visited_at, user_agent, path)
      VALUES (?, ?, ?, ?)
    `).run(fingerprintHash, now, userAgent, req.path)

    // 更新 online_users
    db.prepare(`
      INSERT OR REPLACE INTO online_users (fingerprint_hash, last_seen_at, user_agent)
      VALUES (?, ?, ?)
    `).run(fingerprintHash, now, userAgent)

    // 清理過期的 online_users
    const cutoff = now - FIVE_MINUTES_MS
    db.prepare('DELETE FROM online_users WHERE last_seen_at < ?').run(cutoff)
  } catch (err) {
    // 不影響主要功能
  }
}

/**
 * Express 中介層工廠
 * @param {Array<string>} paths - 要追蹤的路徑（空陣列 = 全部）
 * @returns {express.RequestHandler}
 */
function createPageTrackerMiddleware(paths = []) {
  return (req, res, next) => {
    // 如果有指定路徑，只追蹤這些路徑；否則全部追蹤
    const shouldTrack = paths.length === 0 || paths.includes(req.path)
    if (shouldTrack) {
      // 非同步執行，不阻擋回應
      setImmediate(() => trackPageView(req))
    }
    next()
  }
}

module.exports = { createPageTrackerMiddleware, trackPageView, computeFingerprint }