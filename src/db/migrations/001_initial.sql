-- 🤖 001_initial.sql
-- Phase 2 初始 Schema：items（商品） + fingerprints（IP 綁定）
-- 對應 [todo_progress.md B-02](../../todo_progress.md)

-- ============================================================================
-- items：使用者加入購物車的商品
-- ============================================================================
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fingerprint TEXT NOT NULL,                -- IP Fingerprint（SHA-256(IP + salt)）
  name TEXT NOT NULL,                       -- 商品名稱（VLM 辨識結果）
  price REAL NOT NULL,                      -- 價格
  currency TEXT NOT NULL DEFAULT 'TWD',     -- 幣別（ISO 4217）
  image_path TEXT,                          -- 壓縮後圖片路徑
  vlm_raw_response TEXT,                    -- VLM 原始回應（除錯用）
  created_at INTEGER NOT NULL,              -- Unix ms
  updated_at INTEGER NOT NULL               -- Unix ms
);

CREATE INDEX IF NOT EXISTS idx_items_fingerprint ON items(fingerprint);
CREATE INDEX IF NOT EXISTS idx_items_created_at ON items(created_at);
CREATE INDEX IF NOT EXISTS idx_items_fingerprint_created ON items(fingerprint, created_at DESC);

-- ============================================================================
-- fingerprints：IP Fingerprint 統計
-- ============================================================================
CREATE TABLE IF NOT EXISTS fingerprints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fingerprint_hash TEXT UNIQUE NOT NULL,    -- SHA-256(IP + salt)
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  total_items INTEGER DEFAULT 0             -- 累計加入商品數
);

CREATE INDEX IF NOT EXISTS idx_fp_hash ON fingerprints(fingerprint_hash);
CREATE INDEX IF NOT EXISTS idx_fp_last_seen ON fingerprints(last_seen_at);
