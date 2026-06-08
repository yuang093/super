// 🤖 src/server.js
// 應用程式啟動入口
// 職責：載入環境變數、建立 Express app、啟動 HTTP 伺服器、註冊信號處理

'use strict';

require('dotenv').config();

const logger = require('./utils/logger');
const { getEnv, loadEnv } = require('./config/env');
const { createApp } = require('./app');
const { createDatabase, closeDatabase } = require('./db/database');

/**
 * 啟動 HTTP 伺服器
 * @returns {Promise<import('http').Server>}
 */
async function start() {
  // 步驟 1：驗證環境變數（缺少必要變數時拋出明確錯誤）
  const env = loadEnv();
  logger.init();
  logger.info('🚀 Supermarket Tracker 啟動中', {
    env: env.NODE_ENV,
    port: env.PORT,
    nodeVersion: process.version,
  });

  // 步驟 2：建立 SQLite 連線並執行 migrations
  createDatabase();

  // 步驟 3：建立 Express 應用
  const app = createApp();

  // 步驟 4：啟動 HTTP 伺服器
  const server = app.listen(env.PORT, () => {
    logger.info('✅ HTTP 伺服器已啟動', {
      url: `http://localhost:${env.PORT}`,
      healthcheck: `http://localhost:${env.PORT}/healthz`,
    });
  });

  // 步驟 4：設定伺服器逾時（避免 Slowloris 攻擊）
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  // 步驟 5：註冊作業系統信號處理（基本版本，B-10 將實作完整 Graceful Shutdown）
  const shutdown = (signal) => {
    logger.info(`📡 收到 ${signal} 信號，準備關閉伺服器`, { signal });
    // 先停止接受新連線
    server.close((err) => {
      if (err) {
        logger.error('❌ 伺服器關閉失敗', { error: err.message });
        process.exit(1);
      }
      // 關閉 SQLite（將 WAL 寫回磁碟）
      closeDatabase();
      logger.info('✅ 伺服器與資料庫已關閉');
      process.exit(0);
    });

    // 強制退出保險絲（30 秒後）
    setTimeout(() => {
      logger.error('⚠️ 強制退出（逾時 30 秒）');
      process.exit(1);
    }, 30_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // 步驟 6：捕捉未處理的例外與 Promise 拒絕
  process.on('uncaughtException', (err) => {
    logger.error('💥 未捕捉的例外', { error: err.message, stack: err.stack });
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('💥 未處理的 Promise 拒絕', {
      reason: reason instanceof Error ? reason.message : String(reason),
    });
  });

  return server;
}

// 僅當此檔案被直接執行（require.main === module）時才啟動
if (require.main === module) {
  start().catch((err) => {
    logger.error('❌ 啟動失敗', { error: err.message, code: err.code });
    process.exit(1);
  });
}

module.exports = { start };
