-- 🤖 004_page_views.sql
-- 頁面瀏覽記錄資料表（用於統計儀表板）
-- 對應 [view.html 統計儀表板功能]

-- ============================================================================
-- page_views：每次頁面載入寫入一筆
-- ============================================================================
CREATE TABLE IF NOT EXISTS page_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fingerprint_hash TEXT NOT NULL,      -- IP 指紋（SHA-256(IP + salt)）
  visited_at INTEGER NOT NULL,          -- 拜訪時間（Unix ms）
  user_agent TEXT,                      -- 瀏覽器 UA
  path TEXT NOT NULL DEFAULT '/',        -- 瀏覽的路徑
  country TEXT,                          -- 國家（GeoIP）
  device_type TEXT DEFAULT 'unknown'     -- 設備類型（mobile/desktop/tablet/bot）
);

CREATE INDEX IF NOT EXISTS idx_pv_fingerprint ON page_views(fingerprint_hash);
CREATE INDEX IF NOT EXISTS idx_pv_visited_at ON page_views(visited_at);
CREATE INDEX IF NOT EXISTS idx_pv_country ON page_views(country);
CREATE INDEX IF NOT EXISTS idx_pv_device ON page_views(device_type);

-- ============================================================================
-- online_users：即時在線使用者追蹤（TTL 5 分鐘）
-- ============================================================================
CREATE TABLE IF NOT EXISTS online_users (
  fingerprint_hash TEXT PRIMARY KEY,     -- IP 指紋
  last_seen_at INTEGER NOT NULL,        -- 最後活動時間（Unix ms）
  user_agent TEXT                        -- 瀏覽器 UA
);