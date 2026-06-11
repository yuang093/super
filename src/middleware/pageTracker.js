// 🤖 src/middleware/pageTracker.js
// 頁面瀏覽追蹤中介層
// 每次有人訪問網站時記錄到 page_views 表

'use strict'

const crypto = require('node:crypto')
const { getEnv } = require('../config/env')
const { getDatabase } = require('../db/database')

// geoip-lite 是懶惰載入（第一次 getGeoSync 才會初始化）
let geoip = null
function getGeoIP() {
  if (!geoip) {
    try {
      geoip = require('geoip-lite')
    } catch {
      // 沒有安裝 geoip-lite
    }
  }
  return geoip
}

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
 * 從 User-Agent 判斷設備類型
 * @param {string} ua - User-Agent 字串
 * @returns {string} mobile | desktop | tablet | bot | unknown
 */
function parseDeviceType(ua) {
  if (!ua || ua === 'unknown') return 'unknown'

  const lower = ua.toLowerCase()

  // Bot 檢測
  if (lower.includes('bot') || lower.includes('crawler') || lower.includes('spider') ||
      lower.includes('google') || lower.includes('bing') || lower.includes('slurp') ||
      lower.includes('facebook') || lower.includes('twitter')) {
    return 'bot'
  }

  // 行動裝置
  if (/mobile|android|iphone|ipad|ipod|blackberry|windows phone/i.test(lower)) {
    // 平板（通常有 mobile 但螢幕較大）
    if (/tablet|ipad|kindle|build\/silk/i.test(lower)) {
      return 'tablet'
    }
    return 'mobile'
  }

  // 桌面
  if (/windows|macintosh|mac os|x11|linux/i.test(lower)) {
    return 'desktop'
  }

  return 'unknown'
}

/**
 * 從 IP 取得國家
 * @param {string} ip - IP 位址
 * @returns {string|null} 國家碼（如 'TW', 'US'）或 null
 */
function getCountryFromIP(ip) {
  try {
    const geo = getGeoIP()
    if (!geo) return null

    // geoip-lite 需要純 IP，不含 port
    const cleanIP = ip.replace(/:\d+$/, '').replace(/^\[.*\]:/, '')
    const result = geo.lookup(cleanIP)
    return result?.country || null
  } catch {
    return null
  }
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
    const country = getCountryFromIP(ip) || null
    const deviceType = parseDeviceType(userAgent)

    // 寫入 page_views
    db.prepare(`
      INSERT INTO page_views (fingerprint_hash, visited_at, user_agent, path, country, device_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(fingerprintHash, now, userAgent, req.path, country, deviceType)

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
 * @param {Object} [options]
 * @param {Array<string>} [options.include] - 只追蹤這些路徑（空陣列 = 全部）
 * @param {Array<string>} [options.exclude] - 排除這些路徑（預設包含 /view）
 * @returns {express.RequestHandler}
 */
function createPageTrackerMiddleware(options = {}) {
  const { include = [], exclude = ['/view', '/stats/'] } = options
  return (req, res, next) => {
    // 排除清單優先
    if (exclude.includes(req.path)) {
      return next()
    }
    // 如果有指定 include，只追蹤這些路徑；否則全部追蹤
    const shouldTrack = include.length === 0 || include.includes(req.path)
    if (shouldTrack) {
      // 非同步執行，不阻擋回應
      setImmediate(() => trackPageView(req))
    }
    next()
  }
}

module.exports = { createPageTrackerMiddleware, trackPageView, computeFingerprint, parseDeviceType, getCountryFromIP }