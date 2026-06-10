# 📊 進度追蹤

> **專案名稱**：Supermarket Tracker（超市購物記帳與匯率換算 Web App）
> **最後更新**：2026-06-07
> **維護者**：Claude Code 協作生成
> **相關文件**：[CLAUDE.md](./CLAUDE.md) · [todo_progress.md](./todo_progress.md) · [CHANGELOG.md](./CHANGELOG.md) · [TESTING_PLAN.md](./TESTING_PLAN.md) · [overview.md](./overview.md)

---

## 一、整體進度儀表板

| 階段 | 名稱 | 進度條 | 完成度 | 狀態 |
|------|------|--------|--------|------|
| Phase 1 | 專案文件建立（11 份） | ██████████ | 100% | ✅ 已完成 |
| Phase 2 | 前後端 + AI 模組開發 | ████████░░ | 80% | 🔄 開發中 |
| Phase 3 | TDD 三循環測試 | ░░░░░░░░░░ | 0% | ⬜ 待啟動 |

**整體完成度**：`[████████████████░░░░]` 66% （Phase 2 大部分已完成）
**預計時程**：2026-06-07（啟動）→ 2026-08-09（正式上線 sm.yuang093.cc）

---

## 二、Phase 1 — 專案文件建立（11 / 11 ✅）

| # | 文件名稱 | 核心目的 | 狀態 |
|---|---------|---------|------|
| 1 | [CHANGELOG.md](./CHANGELOG.md) | 遵循 Keep a Changelog 規範的版本日誌 | ✅ |
| 2 | [CLAUDE.md](./CLAUDE.md) | AI 代理協作憲法（Ultracode 與安全指令源頭） | ✅ |
| 3 | [overview.md](./overview.md) | 系統架構總覽（5 分鐘看懂全局） | ✅ |
| 4 | progress.md | 進度追蹤（本檔） | ✅ |
| 5 | [PROJECT_BRIEF.md](./PROJECT_BRIEF.md) | 1 頁式利害關係人摘要 | ✅ |
| 6 | [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) | 領域脈絡與決策紀錄（ADR） | ✅ |
| 7 | [README.md](./README.md) | GitHub 專案入口與 Onboarding | ✅ |
| 8 | [README-docker.md](./README-docker.md) | Docker / Compose / Tunnel 部署手冊 | ✅ |
| 9 | [todo_progress.md](./todo_progress.md) | 細項 TODO 與 DoD 驗收清單 | ✅ |
| 10 | [TESTING_PLAN.md](./TESTING_PLAN.md) | TDD 三循環測試策略矩陣 | ✅ |
| 11 | 補充配置（.gitignore / .env.example / docker-compose.yml） | 專案運作基礎配置 | ✅ |

**Phase 1 完成 DoD**：
- ✅ 11 份文件全部到位且通過交叉引用矩陣驗證
- ✅ Ultracode 落地：禁用 Placeholder、明列 DoD
- ✅ 安全指令落地：容器 / 檔案 / 結構變更前暫停機制已寫入 CLAUDE.md

---

## 三、Phase 2 — 模組開發待辦總覽（⏳ 規劃中）

### 3.1 前端模組（HTML / JS + TensorFlow.js + Canvas）
- ✅ TF.js MobileNet 模型載入與推論
- ✅ KNN 分類器訓練（threshold 0.7）
- ✅ Canvas 三段式影像壓縮（0.8 → 0.5 → 逐步遞減，目標 < 300KB）
- ✅ EXIF 0x0112 方向修正（iPhone 直立拍照，已移除多餘手動旋轉）
- ✅ 購物車 UI（單筆刪除 / 清空 / 外幣 + TWD 總價）
- ✅ 千分位逗號格式化（toThousands 輔助函式）
- ✅ 自動分析（isAutoAnalysis 標誌，跳過 isProcessing 鎖定）
- ✅ 退稅通知（¥5000 以上顯示於 Summary 常駐區塊）
- ✅ 底部相機按鈕(label for)綁定原生相機
- ✅ 街口支付斗內連結（☕ 斗內按鈕替換匯率 Tab）
- ✅ Toast 背景色修復（!important 強制顯示）
- ✅ 匯率顯示格式優化（USD: $1=X, JPY: ¥100=X, KRW: ₩1000=X）
- ⬜ LocalStorage 快取機制
- ⬜ IP Fingerprint 綁定流程

### 3.2 後端模組（Node.js + Express + sharp + SQLite）
- ⬜ Express 伺服器架設與中介層
- ⬜ sharp 後端壓縮（1200px fit inside / jpeg quality 85）
- ⬜ better-sqlite3 資料表設計（購物紀錄 + 使用者）
- ⬜ RESTful API 端點（拍照、購物車、匯率、健康檢查）
- ⬜ 標準化 Webhook 介面
- ⬜ Event Emitter 跨模組廣播
- ⬜ SIGTERM Graceful Shutdown 處理

### 3.3 AI 整合（MiniMax VLM）
- ⬜ MiniMax VLM API 串接
- ⬜ 三層 Fallback 解析（JSON → Regex → 啟發式）
- ⬜ Exponential Backoff 重試機制
- ⬜ 雙層 Rate Limit（前端節流 + 後端佇列）
- ⬜ 兩段式辨識協調（前端快篩 → 後端精辨）

### 3.4 容器化與部署
- ⬜ Dockerfile 多階段建置
- ⬜ docker-compose.yml 服務編排（app + tunnel）
- ⬜ Cloudflare Tunnel 設定（sm.yuang093.cc）
- ⬜ ⚠️ SQLite Volume 持久化與備份機制
- ⬜ Healthcheck 與 Restart Policy

---

## 四、Phase 3 — TDD 測試循環規劃（⬜ 待啟動）

> 完整測試策略請參閱 [TESTING_PLAN.md](./TESTING_PLAN.md)

| 循環 | 測試類型 | 主要範圍 | 覆蓋率門檻 | 狀態 |
|------|---------|---------|-----------|------|
| 循環 1 | 單元測試 | EXIF 修正、Fallback 解析、匯率換算、影像壓縮 | ≥ 80% | ⬜ |
| 循環 2 | 整合測試 | RESTful API、Webhook、Event Emitter、SQLite 交易 | ≥ 75% | ⬜ |
| 循環 3 | E2E 測試 | 拍攝 → 壓縮 → VLM 辨識 → 購物車 → 匯率換算 | ≥ 70% | ⬜ |

**TDD 工作流**：紅燈（先寫失敗測試）→ 綠燈（最小可行實作）→ 重構（優化可讀性與效能）
**Mock 策略**：MiniMax VLM 與匯率 API 採 Mock 注入，避免測試依賴外部網路

---

## 五、已知風險與緩解

| # | 風險描述 | 等級 | 緩解策略 | 對應文件 |
|---|---------|------|---------|---------|
| R1 | MiniMax VLM API 回應格式變動導致解析失敗 | 🔴 高 | 三層 Fallback + 單元測試覆蓋 | PROJECT_CONTEXT.md |
| R2 | 免費匯率 API 不穩定或失效 | 🟡 中 | SQLite 快取 Fallback + 排程更新 | overview.md |
| R3 | iPhone EXIF 方向導致 VLM 辨識誤判 | 🟡 中 | 前端 0x0112 修正 + E2E 測試案例 | TESTING_PLAN.md |
| R4 | 圖片過大造成傳輸瓶頸或 VLM 拒收 | 🟡 中 | 雙端三段式壓縮（目標 < 500KB） | overview.md |
| R5 | Cloudflare Tunnel 中斷 | 🟢 低 | Docker restart: always + healthcheck | README-docker.md |
| R6 | LocalStorage 容量上限（5–10MB） | 🟢 低 | IP Fingerprint 綁定後清理 + 定期 GC | PROJECT_CONTEXT.md |
| R7 | 容器誤刪導致 SQLite 資料遺失 | 🔴 高 | ⚠️ Volume 備份 + 刪除前雙重確認 | CLAUDE.md 安全段 |

---

## 六、里程碑時間軸

```
2026-06-07  ● Phase 1 啟動 ─── 11 份文件建立 ──────────── ✅ 已完成
            │
            ▼
2026-06-14  ◆ Phase 2 啟動 ─── 模組開發（4 週）────────── ⏳ 規劃中
            │   ├─ Week 1 (06-14)：前端 TF.js + Canvas 壓縮
            │   ├─ Week 2 (06-21)：後端 Express + SQLite
            │   ├─ Week 3 (06-28)：AI VLM 整合 + Fallback
            │   └─ Week 4 (07-05)：Docker 化 + Cloudflare Tunnel
            ▼
2026-07-12  ★ Phase 3 啟動 ─── TDD 三循環（4 週）──────── ⬜ 待啟動
            │   ├─ 循環 1 (07-12)：單元測試（紅 → 綠 → 重構）
            │   ├─ 循環 2 (07-19)：整合測試（API / Webhook / Event）
            │   ├─ 循環 3 (07-26)：E2E 測試（完整流程）
            │   └─ 收尾 (08-02)：覆蓋率審查 + 漏洞修復
            ▼
2026-08-09  🚀 正式上線（https://sm.yuang093.cc）
```

---

## 七、相關文件交叉引用

- **規範源頭**：[CLAUDE.md](./CLAUDE.md) — Ultracode 與安全指令單一可信源
- **細項工作**：[todo_progress.md](./todo_progress.md) — 每項對應 Commit/PR 的可勾選清單
- **版本歷史**：[CHANGELOG.md](./CHANGELOG.md) — 語意化版本（SemVer）紀錄
- **測試矩陣**：[TESTING_PLAN.md](./TESTING_PLAN.md) — 三循環覆蓋率門檻
- **架構總覽**：[overview.md](./overview.md) — 模組圖與資料流時序
- **部署手冊**：[README-docker.md](./README-docker.md) — Docker / Tunnel 操作步驟

---

## 八、變更紀錄

| 日期 | 版本 | 變更內容 | 維護者 |
|------|------|---------|--------|
| 2026-06-07 | 0.1.0 | 初版建立，三階段儀表板與 11 文件狀態 | Claude Code |

---

> 📌 **維護守則**：本檔案於每個 Phase 結束、重要里程碑達成或風險等級變動時同步更新，確保反映最新進度。所有更新須於 [CHANGELOG.md](./CHANGELOG.md) 留下對應紀錄。

愛太妍
