// 🤖 src/config/env.js
// 環境變數驗證與設定載入
// 單一事實來源：[.env.example](../../.env.example) 與 [CLAUDE.md §6](../../CLAUDE.md)

'use strict'

const path = require('node:path')
const { z } = require('zod')

// 環境變數驗證 Schema
// 必要變數於啟動時即驗證；選用變數提供預設值
const envSchema = z.object({
  // 執行環境
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // 儲存路徑
  DATABASE_PATH: z.string().default(path.join(process.cwd(), 'data', 'super.db')),
  UPLOAD_DIR: z.string().default(path.join(process.cwd(), 'uploads')),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().int().positive().max(50).default(2),

  // VLM 設定
  VLM_API_KEY: z.string().min(1, 'VLM_API_KEY 不可為空（部署時必填）'),
  VLM_API_ENDPOINT: z.string().url().default('https://api.minimax.io/v1/chat/completions'),
  VLM_MODEL: z.string().default('MiniMax-M3'),
  VLM_TIMEOUT_MS: z.coerce.number().int().positive().max(120000).default(30000),
  VLM_MAX_RETRIES: z.coerce.number().int().min(0).max(10).default(2),

  // 匯率設定
  EXCHANGE_API_ENDPOINT: z.string().url().default('https://api.exchangerate-api.com/v4/latest/USD'),
  EXCHANGE_FALLBACK_TTL_HOURS: z.coerce.number().int().positive().default(24),

  // Webhook 設定
  WEBHOOK_TIMEOUT_MS: z.coerce.number().int().positive().max(30000).default(5000),
  WEBHOOK_SIGNING_SECRET: z
    .string()
    .min(
      32,
      'WEBHOOK_SIGNING_SECRET 至少需 32 字元，建議使用 crypto.randomBytes(32).toString("hex")'
    ),
  RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().max(10000).default(60),

  // IP Fingerprint
  IP_SALT: z
    .string()
    .min(32, 'IP_SALT 至少需 32 字元，建議使用 crypto.randomBytes(32).toString("hex")'),
  TRUSTED_PROXY: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .default('true'),

  // Cloudflare Tunnel
  CLOUDFLARE_TUNNEL_TOKEN: z.string().min(1, 'CLOUDFLARE_TUNNEL_TOKEN 不可為空'),
  TUNNEL_HOSTNAME: z.string().default('sm.yuang093.cc'),

  // CORS
  CORS_ORIGINS: z.string().default(''),
})

/**
 * 載入並驗證環境變數
 * @param {NodeJS.ProcessEnv} [source=process.env] - 環境變數來源（測試可注入 mock）
 * @returns {Readonly<z.infer<typeof envSchema>>} 驗證後的設定物件（唯讀）
 * @throws {Error} 當必要變數缺失或格式錯誤
 */
function loadEnv(source = process.env) {
  const result = envSchema.safeParse(source)

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  • ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n')
    const error = new Error(
      `❌ 環境變數驗證失敗，請檢查 .env 設定：\n${issues}\n\n` +
        `📖 參考範本：.env.example\n` +
        `🔐 產生隨機密鑰：node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
    )
    error.name = 'EnvValidationError'
    error.code = 'ENV_VALIDATION_FAILED'
    error.issues = result.error.issues
    throw error
  }

  return Object.freeze(result.data)
}

// 模組層級載入（啟動時即驗證）
let cached = null

/**
 * 取得快取的設定物件
 * @returns {Readonly<z.infer<typeof envSchema>>}
 */
function getEnv() {
  if (!cached) {
    cached = loadEnv()
  }
  return cached
}

/**
 * 重設快取（測試專用）
 * @param {NodeJS.ProcessEnv} mockEnv
 */
function resetEnv(mockEnv) {
  cached = mockEnv ? loadEnv(mockEnv) : null
}

module.exports = {
  loadEnv,
  getEnv,
  resetEnv,
  envSchema,
}
