// 🤖 src/utils/logger.js
// 結構化 JSON 日誌工具
// 不依賴第三方套件（pino / winston），保持輕量與可移植性

'use strict';

const { getEnv } = require('../config/env');

/**
 * 結構化日誌記錄器
 * 輸出格式（每行一個 JSON 物件，便於日誌聚合工具解析）：
 * {"timestamp":"2026-06-07T14:50:00.000Z","level":"info","message":"...","requestId":"...","meta":{}}
 */
class Logger {
  constructor() {
    /** @type {'debug' | 'info' | 'warn' | 'error'} */
    this.level = 'info';
    /** @type {number} 數字越大越詳細 */
    this.levelRank = { debug: 0, info: 1, warn: 2, error: 3 };
  }

  /**
   * 初始化（於啟動時呼叫，讀取 LOG_LEVEL）
   */
  init() {
    try {
      this.level = getEnv().LOG_LEVEL;
    } catch {
      // 啟動階段 env 尚未驗證時，使用預設
      this.level = 'info';
    }
  }

  /**
   * 判斷該層級是否需要輸出
   * @param {string} targetLevel
   * @returns {boolean}
   */
  shouldLog(targetLevel) {
    return this.levelRank[targetLevel] >= this.levelRank[this.level];
  }

  /**
   * 輸出日誌
   * @param {string} level
   * @param {string} message
   * @param {Object} [meta]
   */
  log(level, message, meta = {}) {
    if (!this.shouldLog(level)) return;

    const record = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...meta,
    };

    const line = JSON.stringify(record);

    if (level === 'error') {
      process.stderr.write(line + '\n');
    } else {
      process.stdout.write(line + '\n');
    }
  }

  debug(message, meta) {
    this.log('debug', message, meta);
  }

  info(message, meta) {
    this.log('info', message, meta);
  }

  warn(message, meta) {
    this.log('warn', message, meta);
  }

  error(message, meta) {
    this.log('error', message, meta);
  }
}

// 單例
const logger = new Logger();

module.exports = logger;
