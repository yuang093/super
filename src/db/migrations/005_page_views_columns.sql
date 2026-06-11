-- 🤖 005_page_views_columns.sql
-- 為 page_views 表新增 country 和 device_type 欄位
-- 対応 [view.html 統計儀表板功能]

-- 如果欄位已存在（從 004 建立時就有了），則不會有任何影響
-- 但如果 004 失敗了或從舊版本升級，需要確保欄位存在

ALTER TABLE page_views ADD COLUMN country TEXT;
ALTER TABLE page_views ADD COLUMN device_type TEXT DEFAULT 'unknown';

CREATE INDEX IF NOT EXISTS idx_pv_country ON page_views(country);
CREATE INDEX IF NOT EXISTS idx_pv_device ON page_views(device_type);