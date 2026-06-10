// 🤖 tests/helpers/test-env.js
// 測試環境變數 Mock
// 在所有整合測試之前，替換 process.env 為測試用變數

'use strict'

/**
 * 取得測試用環境變數物件
 * 所有必要變數皆為有效假值（不影響真實服務）
 * @returns {NodeJS.ProcessEnv}
 */
function getTestEnv() {
  return {
    NODE_ENV: 'test',
    PORT: '3001',
    LOG_LEVEL: 'error',

    // 資料庫（使用記憶體模式）
    DATABASE_PATH: ':memory:',

    // 路徑
    UPLOAD_DIR: '/tmp/super-test-uploads',
    MAX_UPLOAD_SIZE_MB: '10',

    // VLM（mock 有效格式）
    VLM_API_KEY: 'test-minimax-api-key-for-testing-only',
    VLM_API_ENDPOINT: 'https://api.minimax.io/v1/chat/completions',
    VLM_MODEL: 'MiniMax-M3',
    VLM_TIMEOUT_MS: '5000',
    VLM_MAX_RETRIES: '2',

    // 匯率
    EXCHANGE_API_ENDPOINT: 'https://api.exchangerate-api.com/v4/latest/USD',
    EXCHANGE_FALLBACK_TTL_HOURS: '24',

    // Webhook
    WEBHOOK_TIMEOUT_MS: '5000',
    WEBHOOK_SIGNING_SECRET: 'test-webhook-secret-for-testing-only-32chars',
    RATE_LIMIT_PER_MIN: '60',

    // IP Fingerprint
    IP_SALT: 'test-ip-salt-for-testing-only-32chars-min',
    TRUSTED_PROXY: 'true',

    // Cloudflare Tunnel
    CLOUDFLARE_TUNNEL_TOKEN: 'test-cloudflare-tunnel-token',
    TUNNEL_HOSTNAME: 'sm.yuang093.cc',

    // CORS
    CORS_ORIGINS: '',
  }
}

/**
 * 安裝測試環境（取代 process.env）
 * 會將所有必要的環境變數注入
 * @returns {NodeJS.ProcessEnv} 原始的 process.env（稍後可用 restoreEnv 恢復）
 */
function installTestEnv() {
  const originalEnv = { ...process.env }
  const testEnv = getTestEnv()

  // 清除並注入測試環境
  for (const key of Object.keys(process.env)) {
    if (!(key in testEnv)) {
      delete process.env[key]
    }
  }
  Object.assign(process.env, testEnv)

  return originalEnv
}

/**
 * 恢復原始環境
 * @param {NodeJS.ProcessEnv} originalEnv - installTestEnv 回傳的原始環境
 */
function restoreEnv(originalEnv) {
  process.env = originalEnv
}

module.exports = {
  getTestEnv,
  installTestEnv,
  restoreEnv,
}