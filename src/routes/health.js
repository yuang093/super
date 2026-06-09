// 🤖 src/routes/health.js
// 健康檢查路由
// 提供 /healthz 端點供 Docker healthcheck、負載均衡器、監控系統使用

'use strict'

const express = require('express')
const { getEnv } = require('../config/env')
const packageJson = require('../../package.json')

const router = express.Router()

/**
 * GET /healthz
 * 回傳服務健康狀態、啟動時間、版本、環境資訊
 * @returns {Object} {status, uptime, version, env, timestamp, checks}
 */
router.get('/healthz', (req, res) => {
  const env = getEnv()
  const uptime = process.uptime()

  res.status(200).json({
    status: 'ok',
    uptime: Math.floor(uptime),
    uptimeHuman: formatUptime(uptime),
    version: packageJson.version,
    env: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    checks: {
      // 後續批次可加入 SQLite 連線、磁碟空間、外部 API 等檢查
      // B-02: { database: 'ok' }
      // B-08: { exchangeApi: 'ok' }
    },
  })
})

/**
 * 將秒數格式化為「Xd Yh Zm Ws」格式
 * @param {number} seconds
 * @returns {string}
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  const parts = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  parts.push(`${secs}s`)

  return parts.join(' ')
}

module.exports = router
