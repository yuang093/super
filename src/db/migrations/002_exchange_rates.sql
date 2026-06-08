-- 🤖 002_exchange_rates.sql
-- 匯率快取 + Webhook 訂閱（為 B-08 與 B-09 預留）
-- 對應 [todo_progress.md B-08](../../todo_progress.md) 與 [B-09](../../todo_progress.md)

-- ============================================================================
-- exchange_rates：匯率 API 快取
-- ============================================================================
CREATE TABLE IF NOT EXISTS exchange_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  base_currency TEXT NOT NULL,              -- 基礎幣別（e.g. 'USD'）
  target_currency TEXT NOT NULL,            -- 目標幣別（e.g. 'TWD'）
  rate REAL NOT NULL,                       -- 匯率
  fetched_at INTEGER NOT NULL,              -- 抓取時間（Unix ms）
  source TEXT DEFAULT 'exchangerate-api.com' -- 資料來源
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_exchange_pair ON exchange_rates(base_currency, target_currency);
CREATE INDEX IF NOT EXISTS idx_exchange_fetched_at ON exchange_rates(fetched_at);

-- ============================================================================
-- webhook_subscriptions：B-09 預留
-- ============================================================================
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT UNIQUE NOT NULL,                 -- 接收端 URL
  events TEXT NOT NULL,                     -- JSON array，例如 ["item:added", "cart:over_budget"]
  secret_hash TEXT NOT NULL,                -- SHA-256(WEBHOOK_SIGNING_SECRET + url)
  is_active INTEGER DEFAULT 1,              -- 1 = 啟用, 0 = 停用
  created_at INTEGER NOT NULL,
  last_triggered_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_webhook_active ON webhook_subscriptions(is_active);
