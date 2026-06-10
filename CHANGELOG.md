# 📦 Changelog

本專案所有重大變更皆記錄於此檔案。

格式採用 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/) 規範，版本號遵循 [語意化版本 2.0.0 (SemVer)](https://semver.org/lang/zh-TW/)。

---

## 變更類型說明

- **Added**：新增功能或檔案
- **Changed**：既有功能的調整
- **Deprecated**：即將移除的功能
- **Removed**：本版已移除的功能
- **Fixed**：錯誤修正
- **Security**：安全性修補

---

## [Unreleased]

### 已完成（Phase 2 — 2026-06-10）
- ✅ UI/UX 優化（千分位逗號、自动分析、退稅常駐通知）
- ✅ EXIF 旋轉問題修復（移除多餘手動旋轉，瀏覽器自動處理）
- ✅ 壓縮目標從 500KB 降至 300KB
- ✅ UI 區塊順序調整（Summary → Capture → Cart → Exchange）
- ✅ Toast 背景色修復（!important 強制顯示）
- ✅ 匯率顯示格式優化（USD: $1=X, JPY: ¥100=X, KRW: ₩1000=X）
- ✅ 街口支付斗內連結（☕ 斗內按鈕替換匯率 Tab）
- ✅ 底部相機按鈕(label for)綁定原生相機
- ✅ PWA App Icon（manifest.json + apple-touch-icon）
- ✅ 瀏覽計數器（SQLite 持久化，Docker 部屬不歸零）
- ✅ 預覽區塊按鈕移除（自動分析不需要）
- ✅ 結帳按鈕位置優化（z-index、bottom 調整）
- ✅ 商品譯名放第二行顯示（手機小螢幕優化）

### 恢復（2026-06-10）
- Reverted：Ultracode 效能優化（base64→Blob fetch、Canvas 共用）因導致功能異常已回溯

### 已完成（Phase 2 — 2026-06-09）
- ✅ 前端：style.css（Mobile First）、camera.js、cart.js、image-pipeline.js（EXIF+壓縮）、fingerprint.js（SHA-256）、knnClassifier.js（K=5）
- ✅ 後端：vlmClient.js（MiniMax VLM + Backoff）、fallbackParser.js（JSON→Regex→啟發式三層解析）
- ✅ 後端：rate.service.js + rate.js（匯率 API + SQLite Fallback）
- ✅ 後端：eventBus.js（Event Emitter單例）、webhook.js + webhookRepository.js（Webhook 訂閱管理）
- ✅ 部署：D-01~D-06 全部就緒（Dockerfile、docker-compose、Cloudflare Tunnel、Volume、Secrets、日誌輪替）

### 修正（2026-06-09）
- Fixed：package.json 重複 script key（test:watch、test:coverage 已合併）
- Fixed：health check 端點統一為 /healthz（與 Dockerfile HEALTHCHECK 一致）
- Fixed：草稿檔案移至 docs/drafts/，.gitignore 新增 docs/drafts/ 排除規則
- Fixed：BUG-01 — 移除 btn-camera-trigger 的 capture="environment" 屬性，改由瀏覽器自行判斷（桌面彈檔案選擇器、手機彈拍照/相簿選單）
- Fixed：BUG-02 — 重構 showToast 函式，加入 type 參數與 .visible class 動畫機制
- Fixed：BUG-03 — handleAddToCart 的 base64 切分加入防禦性檢查，同時支援有無 data URL 前綴
- Fixed：BUG-04 — 確認 /api/rates 路由掛載正確（rateRouter 掛於 /api，前端 fetchRates 可正常呼叫）

### 規劃中
- 階段三：TDD 三循環測試（單元 → 整合 → E2E），覆蓋率 ≥ 80%

---

## [0.1.0] - 2026-06-07

### Initial project scaffolding - Phase 1 文件初始化

本版本為專案首次釋出之文件骨架，建立 11 份核心專案文件，定義 Ultracode 模式、安全指令鐵律、交叉引用矩陣，作為後續第二、三階段開發之單一可信源（Single Source of Truth）。

### Added

本次新增之 11 個專案文件：

1. **CHANGELOG.md**：版本變更日誌（本檔案），採 Keep a Changelog 規範。
2. **CLAUDE.md**：AI 協作守則，定義 Ultracode 模式、安全指令三鐵律、語言與格式規範。
3. **overview.md**：系統架構總覽，含技術棧矩陣、模組圖、資料流時序圖、韌性設計。
4. **progress.md**：高階里程碑進度追蹤，對應三階段執行計畫看板。
5. **PROJECT_BRIEF.md**：1 頁式利害關係人簡報，非技術讀者友善版本。
6. **PROJECT_CONTEXT.md**：AI 代理深度脈絡知識庫，含領域知識、ADR、術語表。
7. **README.md**：GitHub 專案入口，含快速開始、技術棧徽章、常用指令。
8. **README-docker.md**：Docker / Compose / Cloudflare Tunnel 完整部署手冊。
9. **todo_progress.md**：可勾選細項 TODO，每項含負責人、DoD 與測試案例 ID。
10. **TESTING_PLAN.md**：三階段測試策略，含測試金字塔與覆蓋率門檻。
11. **補充配置檔**：.gitignore、.env.example、docker-compose.yml 三項基礎運作配置。

### Changed

- 確立專案技術棧：前端 HTML/JS + TensorFlow.js（MobileNet + KNN 0.7 閾值快篩） + Canvas API 壓縮 + localStorage 快取；後端 Node.js + Express + sharp + SQLite (better-sqlite3)；AI 辨識採 MiniMax VLM API；匯率採免費 API + SQLite Fallback；部署採 Docker Compose + Cloudflare Tunnel（sm.yuang093.cc）。
- 確立兩段式視覺辨識流程：前端 TF.js 快篩 → 後端 VLM 精辨。
- 確立雙端三段式圖片壓縮策略：前端 Canvas 0.8 → 0.5 壓至 < 500KB，後端 sharp 1200px fit inside、jpeg quality 85。
- 確立 MiniMax VLM 回應三層 Fallback 解析：JSON → Regex → 啟發式。

### Security

- 確立安全指令三鐵律：刪除容器、移除檔案、變更資料夾結構前必須暫停並提醒備份（詳見 [CLAUDE.md §2](./CLAUDE.md)）。
- 確立 `BACKUP-VERIFIED` 確認字串流程：執行 `docker compose down -v` / `docker rm -v` / `rm -rf` 任何一個指令前，終端機必須先輸出 `echo "BACKUP-VERIFIED $(date -Iseconds)"`，否則視同未完成備份，拒絕執行（詳見 [README-docker.md §6](./README-docker.md)）。
- .env.example 標註所有敏感變數（`VLM_API_KEY`、`IP_SALT`、`CLOUDFLARE_TUNNEL_TOKEN`）並要求由部署者自行填入；真實 `.env` 嚴禁進版控。
- .gitignore 排除 .env、*.db、*.sqlite、logs/、uploads/、.claude/ 等敏感與本地專屬目錄。
- **敏感資料洩漏處置**：若發現 `VLM_API_KEY` / `CLOUDFLARE_TUNNEL_TOKEN` / `IP_SALT` / `WEBHOOK_SIGNING_SECRET` 任何一項曾被 commit 至 Git 歷史，必須立即：
  1. 於對應服務（MiniMax 控制台、Cloudflare Zero Trust）撤銷並 Rotate 新密鑰
  2. 使用 `git filter-repo` 或 `bfg-repo-cleaner` 清洗歷史
  3. 強制所有協作者重新 pull 與重設本地 `.env`
  4. 於本檔案新增 `### Security` 條目記錄事件時間與處置
- **WebHook 簽章**：所有對外 Webhook 推送皆須以 `WEBHOOK_SIGNING_SECRET` 進行 HMAC-SHA256 簽章，並於 HTTP Header `X-Super-Signature` 傳遞；接收端須驗章後才處理（詳見 [PROJECT_CONTEXT.md §8](./PROJECT_CONTEXT.md)）。
- **IP Fingerprint 隱私**：`IP_SALT` 必須於容器啟動時從環境變數注入，不可 hard-code 於程式碼或設定檔；建議每 90 天輪換一次並同步部署紀錄。

---

## 版本標籤規則

- **MAJOR.MINOR.PATCH**
  - MAJOR：不相容 API 變更
  - MINOR：向下相容功能新增
  - PATCH：向下相容錯誤修正
- 首版 0.1.0 為文件骨架（Phase 1），預計 0.2.0 釋出後端 API 與前端 MVP，1.0.0 為正式上線版。

---

## 相關文件

- [README.md](./README.md)：專案入口與快速開始
- [overview.md](./overview.md)：系統架構總覽
- [progress.md](./progress.md)：高階進度追蹤
- [todo_progress.md](./todo_progress.md)：細項 TODO

---

愛太妍
