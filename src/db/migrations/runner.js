// 🤖 src/db/migrations/runner.js
// 冪等性 Migrations 執行器
// 讀取 migrations/ 目錄下所有 .sql 檔，依檔名順序執行
// 已執行的 migration 記錄於 _migrations 表，重啟不會重複執行
// 對應 [CLAUDE.md §1.1 Ultracode 模式](../../CLAUDE.md)

'use strict'

const fs = require('node:fs')
const path = require('node:path')
const logger = require('../../utils/logger')

/**
 * 執行所有未套用的 migrations
 * @param {import('better-sqlite3').Database} db - SQLite 連線實例
 */
function runMigrations(db) {
  // 1. 建立 _migrations 記錄表（若不存在）
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `)

  // 2. 取得已套用的 migrations
  const appliedRows = db.prepare('SELECT name FROM _migrations').all()
  const applied = new Set(appliedRows.map((r) => r.name))

  // 3. 讀取所有 .sql 檔（依檔名排序）
  const migrationsDir = __dirname
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  if (files.length === 0) {
    logger.warn('⚠️ 找不到任何 migration 檔案', { dir: migrationsDir })
    return
  }

  // 4. 依序執行未套用的 migrations（每個包在 transaction 內）
  let appliedCount = 0
  for (const file of files) {
    if (applied.has(file)) {
      logger.debug('⏭️ Migration 已套用，略過', { file })
      continue
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
    const txn = db.transaction(() => {
      db.exec(sql)
      db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)').run(file, Date.now())
    })
    txn()

    logger.info('✅ Migration 套用成功', { file })
    appliedCount++
  }

  if (appliedCount === 0) {
    logger.info('🗄️ 所有 migrations 已套用，無需更新', { total: files.length })
  } else {
    logger.info('🎉 Migrations 完成', { applied: appliedCount, total: files.length })
  }
}

module.exports = { runMigrations }
