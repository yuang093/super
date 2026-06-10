-- 🤖 003_visit_counter.sql
-- 瀏覽計數器資料表
-- 對應 [todo_progress.md 瀏覽計數器功能]

CREATE TABLE IF NOT EXISTS visit_counter (
  id INTEGER PRIMARY KEY CHECK (id = 1),  -- 單列，固定 id=1
  count INTEGER NOT NULL DEFAULT 0         -- 瀏覽次數
);

-- 初始化計數器（若尚無資料）
INSERT OR IGNORE INTO visit_counter (id, count) VALUES (1, 0);