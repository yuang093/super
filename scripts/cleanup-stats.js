// 🤖 scripts/cleanup-stats.js
// 清除拜訪統計測試資料
// 使用方式：node scripts/cleanup-stats.js

'use strict'

const path = require('node:path')

// 直接引用 database.js（不走 Express app）
const { createDatabase, getDatabase, closeDatabase } = require('../src/db/database')

// 載入 env（會自動讀取 .env）
const { loadEnv } = require('../src/config/env')
loadEnv()

function cleanup() {
  console.log('🧹 開始清除統計測試資料...\n')

  const db = getDatabase()

  // 取得清除前的數據
  const before = {
    pageViews: db.prepare('SELECT COUNT(*) as count FROM page_views').get().count,
    onlineUsers: db.prepare('SELECT COUNT(*) as count FROM online_users').get().count,
  }
  console.log('清除前：')
  console.log(`  - page_views: ${before.pageViews} 筆`)
  console.log(`  - online_users: ${before.onlineUsers} 筆`)

  // 清除 page_views（保留結構）
  const pvDeleted = db.prepare('DELETE FROM page_views').run()
  console.log(`\n✅ 已刪除 page_views: ${pvDeleted.changes} 筆`)

  // 清除 online_users
  const ouDeleted = db.prepare('DELETE FROM online_users').run()
  console.log(`✅ 已刪除 online_users: ${ouDeleted.changes} 筆`)

  // 清除後的數據
  const after = {
    pageViews: db.prepare('SELECT COUNT(*) as count FROM page_views').get().count,
    onlineUsers: db.prepare('SELECT COUNT(*) as count FROM online_users').get().count,
  }
  console.log('\n清除後：')
  console.log(`  - page_views: ${after.pageViews} 筆`)
  console.log(`  - online_users: ${after.onlineUsers} 筆`)

  console.log('\n✨ 清理完成！')
}

// 主程式
async function main() {
  try {
    // 初始化資料庫
    createDatabase()
    cleanup()
  } catch (err) {
    console.error('❌ 清理失敗：', err.message)
    process.exit(1)
  } finally {
    closeDatabase()
    process.exit(0)
  }
}

main()