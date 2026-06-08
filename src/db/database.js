// 🤖 src/db/database.js
// SQLite 連線工廠與生命週期管理
// 對應 [todo_progress.md B-02](../../todo_progress.md)

'use strict';

const path = require('node:path');
const fs = require('node:fs');
const Database = require('better-sqlite3');
const { getEnv } = require('../config/env');
const logger = require('../utils/logger');
const { runMigrations } = require('./migrations/runner');

/** @type {import('better-sqlite3').Database | null} */
let dbInstance = null;

/**
 * 建立 SQLite 連線並執行 migrations
 * @param {Object} [options]
 * @param {Object} [options.env] - 環境變數（測試可注入）
 * @returns {import('better-sqlite3').Database}
 */
function createDatabase(options = {}) {
  if (dbInstance) {
    logger.warn('⚠️ 資料庫已存在，重複呼叫 createDatabase() 將回傳現有實例');
    return dbInstance;
  }

  const env = options.env || getEnv();

  // 1. 確保資料目錄存在
  const dbDir = path.dirname(env.DATABASE_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    logger.info('📁 已建立資料目錄', { dir: dbDir });
  }

  // 2. 建立連線
  const db = new Database(env.DATABASE_PATH, {
    verbose: env.NODE_ENV === 'development' ? logger.debug.bind(logger) : null,
  });

  // 3. 設定效能與一致性選項
  db.pragma('journal_mode = WAL'); // Write-Ahead Logging，提升併發效能
  db.pragma('foreign_keys = ON'); // 啟用外鍵約束
  db.pragma('busy_timeout = 5000'); // 鎖定時等待 5 秒

  logger.info('🗄️ SQLite 連線建立', {
    path: env.DATABASE_PATH,
    mode: 'WAL',
    busyTimeoutMs: 5000,
  });

  // 4. 執行 migrations
  runMigrations(db);

  dbInstance = db;
  return db;
}

/**
 * 取得已建立的連線實例
 * @returns {import('better-sqlite3').Database}
 * @throws {Error} 當資料庫尚未初始化
 */
function getDatabase() {
  if (!dbInstance) {
    const error = new Error('資料庫尚未初始化，請先呼叫 createDatabase()');
    error.name = 'DatabaseNotInitializedError';
    error.code = 'DB_NOT_INITIALIZED';
    throw error;
  }
  return dbInstance;
}

/**
 * 關閉連線（於 SIGTERM 時呼叫）
 * @returns {boolean} 是否成功關閉
 */
function closeDatabase() {
  if (!dbInstance) return false;
  try {
    dbInstance.close();
    dbInstance = null;
    logger.info('🗄️ SQLite 連線已關閉');
    return true;
  } catch (err) {
    logger.error('❌ SQLite 關閉失敗', { error: err.message });
    return false;
  }
}

/**
 * 重設實例（測試專用）
 */
function resetDatabase() {
  closeDatabase();
  dbInstance = null;
}

module.exports = {
  createDatabase,
  getDatabase,
  closeDatabase,
  resetDatabase,
};
