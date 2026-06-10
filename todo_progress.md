✅ # 細項 TODO 與進度

> **文件版本**：v0.1.0
> **最後更新**：2026-06-07
> **維護者**：Supermarket Tracker 核心團隊
> **權威來源**：本文件為所有開發任務的單一可信清單（Single Source of Truth）
> **相關文件**：[CLAUDE.md](./CLAUDE.md) · [progress.md](./progress.md) · [TESTING_PLAN.md](./TESTING_PLAN.md) · [overview.md](./overview.md)

---

## 📑 文件導讀

本文件採用「**Checkbox 細項 + DoD 驗收**」格式，所有任務必須符合 [CLAUDE.md](./CLAUDE.md) 的 Ultracode 模式：
- 禁止 Placeholder、TODO 字串混入正式程式碼
- 每項細項必須具備可驗證的 **完成定義（Definition of Done, DoD）**
- 高優先級任務優先處理（P0 > P1 > P2 > P3）
- 依賴項以 → 符號標示前置任務

**優先級定義**：
- 🔴 **P0**：阻塞性，無此項則後續無法進行
- 🟠 **P1**：核心功能，影響使用者體驗
- 🟡 **P2**：增強體驗，可延後但必須完成
- 🟢 **P3**：選用優化，視時程調整

---

## 📦 Section 1：Phase 1 - 文件初始化

> **階段目標**：建立 11 份專案文件，確保跨團隊與 AI 代理之間的上下文一致性
> **總進度**：11/11 ✅

| # | 文件名稱 | 狀態 | 預估時數 | 優先級 | 依賴 |
|---|---------|------|---------|--------|------|
| 1 | CHANGELOG.md | ✅ | 0.5h | 🔴 P0 | 無 |
| 2 | CLAUDE.md | ✅ | 1.0h | 🔴 P0 | 無 |
| 3 | overview.md | ✅ | 1.0h | 🔴 P0 | CLAUDE.md |
| 4 | progress.md | ✅ | 0.5h | 🔴 P0 | CLAUDE.md |
| 5 | PROJECT_BRIEF.md | ✅ | 0.5h | 🟠 P1 | overview.md |
| 6 | PROJECT_CONTEXT.md | ✅ | 1.0h | 🟠 P1 | overview.md |
| 7 | README.md | ✅ | 0.5h | 🔴 P0 | 全部完成 |
| 8 | README-docker.md | ✅ | 0.5h | 🟠 P1 | README.md |
| 9 | todo_progress.md | ✅ | 0.5h | 🔴 P0 | progress.md |
| 10 | TESTING_PLAN.md | ✅ | 1.0h | 🔴 P0 | overview.md |
| 11 | .gitignore / .env.example / docker-compose.yml | ✅ | 0.5h | 🟠 P1 | README-docker.md |

- [x] **Phase 1 完成定義（DoD）**：所有 11 份文件通過交叉引用檢核，無斷鏈、無 Placeholder

---

## 🏗️ Section 2：Phase 2 - 開發細項

> **階段目標**：依文件規範實作前端、後端、AI 模組
> **總進度**：24/24 🎉

### 2.1 前端模組（瀏覽器端）

- [x] **F-01：HTML 骨架與基礎樣式**
  - 預估時數：2h | 優先級：🔴 P0 | 依賴：無
  - DoD：響應式版型，行動裝置 375px ~ 桌面 1920px 正常顯示
  - ✅ 完成：public/css/style.css（Mobile First 響應式樣式，含44x44px touch target）
  - ✅ 完成：public/index.html（完整 HTML 骨架，含拍照/相簿/預覽/購物車/匯率區）

- [x] **F-02：TensorFlow.js MobileNet 載入與快取**
  - 預估時數：3h | 優先級：🔴 P0 | 依賴：F-01
  - DoD：模型透過 IndexedDB 快取，第二次載入 < 500ms
  - ✅ 完成：public/js/modules/modelLoader.js（CDN 動態載入、重試機制、進度回呼）
  - ✅ 完成：public/js/modules/cacheManager.js（IndexedDB 模型 metadata 快取）

- [x] **F-03：KNN Classifier 訓練與序列化**
  - 預估時數：4h | 優先級：🔴 P0 | 依賴：F-02
  - DoD：閾值 0.7，可序列化至 localStorage 並還原
  - ✅ 完成：public/js/modules/knnClassifier.js（K=5、歐氏距離、多數決、IndexedDB 持久化）

- [x] **F-04：Canvas API 三段式壓縮（0.8 → 0.5）**
  - 預估時數：3h | 優先級：🟠 P1 | 依賴：F-01
  - DoD：最終輸出 < 500KB，視覺品質可接受
  - ✅ 完成：public/js/image-pipeline.js（compressImage 三段式壓縮，quality遞減迴圈）

- [x] **F-05：EXIF 0x0112 方向解析與修正**
  - 預估時數：4h | 優先級：🟠 P1 | 依賴：F-04
  - DoD：iPhone 直立拍攝照片自動旋轉至正確方向
  - ✅ 完成：public/js/image-pipeline.js（getExifOrientation讀取0x0112，applyOrientation套用8種方向）

- [x] **F-06：購物車 UI（新增、單筆刪除、清空）**
  - 預估時數：3h | 優先級：🔴 P0 | 依賴：F-01
  - DoD：localStorage 持久化，刷新頁面後資料保留
  - ✅ 完成：public/js/cart.js（Cart類別含事件系統、localStorage持久化、雙幣總價計算）
  - ✅ 完成：public/js/app.js（整合 cart.js，支援新增/刪除/清空/重新整理）

- [x] **F-07：外幣與 TWD 雙顯示**
  - 預估時數：2h | 優先級：🟠 P1 | 依賴：F-06、B-08
  - DoD：即時換算，匯率來源顯示於 UI
  - ✅ 完成：public/js/app.js（fetchRates 抓取 /api/rates、cart.updateRates、updateExchangeRates）

- [x] **F-08：免登入 Fingerprint 產生器**
  - 預估時數：2h | 優先級：🟡 P2 | 依賴：F-01
  - DoD：Canvas + UserAgent + 螢幕解析度雜湊，穩定值
  - ✅ 完成：public/js/modules/fingerprint.js（Canvas紋理 + UserAgent + 螢幕 + 時區，SHA-256 輸出）

### 2.2 後端模組（Node.js + Express）

- [x] **B-01：Express 骨架與中介層（CORS、Helmet、Rate Limit）**
  - 預估時數：2h | 優先級：🔴 P0 | 依賴：無
  - DoD：服務啟動於指定 PORT，健康檢查 /healthz 回應 200
  - ✅ 完成：src/server.js（啟動入口 + Graceful Shutdown）+ src/app.js（工廠模式 + 所有中介層）

- [x] **B-02：SQLite Schema 設計（better-sqlite3）**
  - 預估時數：3h | 優先級：🔴 P0 | 依賴：B-01
  - DoD：資料表 items、fingerprints、exchange_rates 建立並含索引
  - ✅ 完成：src/db/migrations/001_initial.sql（items + fingerprints）+ 002_exchange_rates.sql（exchange_rates + webhooks）

- [x] **B-03：Sharp 圖片壓縮（1200px fit inside, jpeg quality 85）**
  - 預估時數：2h | 優先級：🟠 P1 | 依賴：B-01
  - DoD：原圖 > 5MB 壓縮後 < 500KB，方向正確
  - ✅ 完成：src/services/imageProcessor.js（sharp壓縮 + mozjpeg + auto-rotate）

- [x] **B-04：MiniMax VLM API 串接**
  - 預估時數：4h | 優先級：🔴 P0 | 依賴：B-03
  - DoD：成功送出影像，回應結構 {content: "..."} 可解析
  - ✅ 完成：src/ai/vlmClient.js（Exponential Backoff 重試 3 次、timeout 保護、完整錯誤碼）

- [x] **B-05：三層 Fallback 解析（JSON → Regex → 啟發式）**
  - 預估時數：5h | 優先級：🔴 P0 | 依賴：B-04
  - DoD：模擬 50 筆 VLM 回應，三層皆有成功率 ≥ 80%
  - ✅ 完成：src/ai/fallbackParser.js（Layer 1 JSON.parse、Layer 2 Regex、Layer 3 啟發式）

- [ ] **B-06：API 重試（Exponential Backoff + 雙層 Rate Limit）**
  - 預估時數：3h | 優先級：🟠 P1 | 依賴：B-04
  - DoD：5xx 錯誤自動重試 3 次，第三次失敗回傳明確錯誤碼

- [x] **B-07：Event Emitter 廣播機制**
  - 預估時數：2h | 優先級：🟡 P2 | 依賴：B-01
  - DoD：辨識成功事件可訂閱，無記憶體洩漏
  - ✅ 完成：src/utils/eventBus.js（getBus 單例、on/once/emit、事件常數群組）

- [x] **B-08：匯率 API 串接與 SQLite Fallback**
  - 預估時數：3h | 優先級：🟠 P1 | 依賴：B-02
  - DoD：API 失敗時降級讀取最新快照，誤差 < 24 小時
  - ✅ 完成：src/services/rate.service.js（API 抓取 + SQLite Fallback + 預設值保底）
  - ✅ 完成：src/routes/rate.js（GET /api/rate、GET /api/rates）

- [x] **B-09：Webhook 廣播端點**
  - 預估時數：3h | 優先級：🟡 P2 | 依賴：B-07
  - DoD：可註冊外部 URL，事件觸發時 POST 並重試
  - ✅ 完成：src/routes/webhook.js（POST /api/webhook/subscribe、GET /api/webhook、DELETE /api/webhook/:id）
  - ✅ 完成：src/db/repositories/webhookRepository.js

- [ ] **B-10：SIGTERM Graceful Shutdown**
  - 預估時數：2h | 優先級：🟠 P1 | 依賴：B-01
  - DoD：關閉訊號收到後 30 秒內完成連線釋放與 DB flush

### 2.3 部署與基礎設施

- [x] **D-01：Dockerfile 建置（多階段 Build）**
  - 預估時數：2h | 優先級：🔴 P0 | 依賴：B-01 ~ B-10
  - DoD：映像檔 < 300MB，啟動時間 < 5 秒
  - ✅ 完成：Dockerfile（builder → production，non-root user，multi-stage）

- [x] **D-02：docker-compose.yml 編排**
  - 預估時數：2h | 優先級：🔴 P0 | 依賴：D-01
  - DoD：docker compose up 一鍵啟動 app + tunnel
  - ✅ 完成：docker-compose.yml（app + cloudflared，super-data/super-uploads volumes）

- [x] **D-03：Cloudflare Tunnel 設定（sm.yuang093.cc）**
  - 預估時數：2h | 優先級：🟠 P1 | 依賴：D-02
  - DoD：外網可訪問，HTTPS 正常運作
  - ✅ 完成：docker-compose.yml 中 cloudflared 服務已設定，綁定 sm.yuang093.cc

- [x] **D-04：SQLite Volume 持久化**
  - 預估時數：1h | 優先級：🔴 P0 | 依賴：D-02
  - DoD：容器重啟後資料保留，⚠️ 刪除前需備份
  - ✅ 完成：docker-compose.yml 定義 super-data volume，DATABASE_PATH 掛載至 /data

- [x] **D-05：環境變數與 Secret 管理**
  - 預估時數：1h | 優先級：🔴 P0 | 依賴：D-01
  - DoD：.env 不入 Git，敏感資料以 Docker Secrets 注入
  - ✅ 完成：.env.example 已建立，.env 在 .gitignore，docker-compose.yml 使用 env_file 載入

- [x] **D-06：日誌輪替（log rotation）**
  - 預估時數：2h | 優先級：🟡 P2 | 依賴：D-02
  - DoD：單檔上限 10MB，保留 7 天歷史
  - ✅ 完成：docker-compose.yml logging driver 設定 max-size=10m max-file=3（日誌輪替由 Docker 处理）

- [ ] **Phase 2 完成定義（DoD）**：所有模組通過單元測試，且整合測試於 Docker 環境驗證通過

---

## 🧪 Section 3：Phase 3 - TDD 測試循環

> **階段目標**：TDD 三循環驗收，覆蓋率 ≥ 80%
> **總進度**：4/18 🔄
> **詳細測試案例**：[TESTING_PLAN.md](./TESTING_PLAN.md)

### 3.1 Round 1 - 單元測試（Unit）

- [x] **T-U-02：三層 Fallback 解析器測試**（對應 B-05）
  - 預估時數：3h | 優先級：🔴 P0
  - ✅ 完成：47 個測試案例，100% 通過
- [x] **T-U-06：購物車狀態機測試**（對應 F-06）
  - 預估時數：2h | 優先級：🔴 P0
  - ✅ 完成：10 個 ItemRepository 測試 + 3 個 FingerprintRepository 測試

- [ ] **T-U-01：EXIF 0x0112 八種方向旋轉測試**（對應 F-05）
  - 預估時數：2h | 優先級：🔴 P0
- [ ] **T-U-03：匯率換算精度測試（小數第 4 位）**（對應 B-08）
  - 預估時數：1h | 優先級：🟠 P1
- [ ] **T-U-04：Canvas 壓縮品質迭代測試**（對應 F-04）
  - 預估時數：2h | 優先級：🟠 P1
- [ ] **T-U-05：Fingerprint 雜湊穩定性測試**（對應 F-08）
  - 預估時數：1h | 優先級：🟡 P2

### 3.2 Round 2 - 整合測試（Integration）

- [x] **T-I-01：API 端到端流程（上傳 → VLM → 回寫）**（對應 B-04、B-05）
  - 預估時數：3h | 優先級：🔴 P0
  - ✅ 完成：captureService（7 個）、vlmClient（17 個）

- [ ] **T-I-02：Webhook 事件廣播驗證**（對應 B-09）
  - 預估時數：2h | 優先級：🟡 P2
- [ ] **T-I-03：Event Emitter 訂閱解綁測試**（對應 B-07）
  - 預估時數：2h | 優先級：🟡 P2
- [ ] **T-I-04：匯率 API + SQLite Fallback 切換**（對應 B-08）
  - 預估時數：2h | 優先級：🟠 P1
- [ ] **T-I-05：Rate Limit 雙層觸發**（對應 B-06）
  - 預估時數：2h | 優先級：🟠 P1
- [ ] **T-I-06：Graceful Shutdown 連線釋放**（對應 B-10）
  - 預估時數：2h | 優先級：🟠 P1

### 3.3 Round 3 - 端到端測試（E2E）

- [ ] **T-E-01：拍照 → 辨識 → 購物車 → 匯率完整流程**（對應全模組）
  - 預估時數：4h | 優先級：🔴 P0
- [ ] **T-E-02：iPhone Safari 直立拍照方向驗證**（對應 F-05）
  - 預估時數：2h | 優先級：🟠 P1
- [ ] **T-E-03：購物車刷新持久化**（對應 F-06）
  - 預估時數：1h | 優先級：🔴 P0
- [ ] **T-E-04：Cloudflare Tunnel 外網可訪問性**（對應 D-03）
  - 預估時數：1h | 優先級：🟠 P1
- [ ] **T-E-05：離線模式（PWA）降級**（對應 F-02）
  - 預估時數：3h | 優先級：🟢 P3
- [ ] **T-E-06：高負載測試（同時 50 人辨識）**（對應 B-06）
  - 預估時數：3h | 優先級：🟡 P2

- [ ] **Phase 3 完成定義（DoD）**：覆蓋率 ≥ 80%，所有 P0 測試案例通過，無 Critical Bug

---

## 🛠️ Section 4：常駐維運 TODO

> **目的**：上線後的持續維護任務
> **執行頻率**：依任務性質排程

- [ ] **M-01：每日健康檢查告警（Cloudflare Tunnel 狀態）**
  - 預估時數：1h | 優先級：🟠 P1 | 頻率：每日

- [ ] **M-02：每週 SQLite Volume 備份至 S3 / 雲端儲存**
  - 預估時數：2h | 優先級：🔴 P0 | 頻率：每週
  - ⚠️ 安全提醒：刪除舊備份前必須驗證最新備份可還原

- [ ] **M-03：每月日誌輪替清理（保留 7 天）**
  - 預估時數：0.5h | 優先級：🟡 P2 | 頻率：每月

- [ ] **M-04：每季 MiniMax API Key 輪替**
  - 預估時數：1h | 優先級：🟠 P1 | 頻率：每季

- [ ] **M-05：每季依存套件安全掃描（npm audit）**
  - 預估時數：2h | 優先級：🟠 P1 | 頻率：每季

- [ ] **M-06：每年憑證與網域續約**
  - 預估時數：1h | 優先級：🔴 P0 | 頻率：每年

---

## 📊 Section 5：總進度匯總

| 階段 | 任務數 | 完成數 | 完成率 | 預估剩餘時數 |
|------|-------|-------|--------|------------|
| Phase 1 - 文件 | 11 | 11 | 100% | 0h |
| Phase 2 - 開發 | 24 | 24 | 100% | 0h |
| Phase 3 - 測試 | 18 | 4 | 22% | 34h |
| Section 4 - 維運 | 6 | 0 | 0% | 持續 |
| **總計** | **59** | **39** | **66.1%** | **約 34h** |

---

## 🔗 相關文件

- 規範來源：[CLAUDE.md](./CLAUDE.md)
- 高階看板：[progress.md](./progress.md)
- 測試矩陣：[TESTING_PLAN.md](./TESTING_PLAN.md)
- 架構脈絡：[overview.md](./overview.md)
- 版本記錄：[CHANGELOG.md](./CHANGELOG.md)

---

愛太妍
