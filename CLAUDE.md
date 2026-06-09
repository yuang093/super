# 🤖 CLAUDE.md — AI 協作守則

> 本文件是 **Supermarket Tracker** 專案的「AI 代理憲法」。所有代理（Claude、subagent、自動化腳本、外部 LLM 整合）於本專案執行任何動作前，必須完整閱讀並遵守本守則。  
> 違反本守則等同破壞專案可預期性、可維護性與資料安全。

---

## 目錄

1. [🧠 Ultracode 模式（最高行為準則）](#1--ultracode-模式最高行為準則)
2. [🚨 絕對安全指令（三鐵律）](#2--絕對安全指令三鐵律)
3. [🌐 使用者偏好（語言與格式）](#3--使用者偏好語言與格式)
4. [📅 開發階段（三大階段）](#4--開發階段三大階段)
5. [🧪 TDD 測試失敗處理守則](#5--tdd-測試失敗處理守則)
6. [🛠️ 技術棧速覽](#6-️-技術棧速覽)
7. [🚫 禁止行為清單](#7--禁止行為清單)
8. [🔗 參考文件索引](#8--參考文件索引)

---

## 1. 🧠 Ultracode 模式（最高行為準則）

### 1.1 Ultracode 三大鐵律

1. **禁用 Placeholder**  
   禁止出現以下字串於程式碼或文件中：`TODO`、`FIXME`、`...`、`xxx`、`待補`、`稍後`、`placeholder`、`<placeholder>`。  
   任何未完成邏輯必須以具體實作取代；若確定無法完成，明確標註為「拒絕實作項目」並說明理由。

2. **模組高內聚、低耦合**  
   單一模組僅負責單一職能；模組間僅透過明確介面（API contract、Event Emitter、DI 注入）溝通，禁止跨模組直接讀取內部狀態。

3. **完整邊界處理（Defensive Boundary）**  
   所有函式入口、API 端點、事件監聽器皆須具備完整錯誤處理：  
   - 參數驗證（型別、範圍、必要性）  
   - 例外捕捉（try-catch 不可吞錯，必須 log + 對外有意義回應）  
   - 資源釋放（finally、close、destroy）  
   - 逾時控制（不可無限期等待）

### 1.2 DoD（Definition of Done）驗收標準

每個 PR / Commit 必須符合以下條件才視為完成：

- ✅ 功能實作完整，無半成品
- ✅ 單元測試覆蓋率 ≥ 80%（對應 [TESTING_PLAN.md](./TESTING_PLAN.md)）
- ✅ 程式碼無 Placeholder 殘留（CI 階段以 grep 攔截）
- ✅ 通過 Linter（ESLint / Prettier）檢查
- ✅ 提交前**先執行語法檢查**（`node --check`）確認無錯誤
- ✅ 對應 [todo_progress.md](./todo_progress.md) 項目狀態更新
- ✅ 若涉及破壞性變更，[CHANGELOG.md](./CHANGELOG.md) 必須同步更新

### 1.3 模組邊界規範

| 模組層級 | 禁止行為 | 允許行為 |
|---------|---------|---------|
| 前端模組 | 禁止直接呼叫後端內部函式 | 僅可透過 RESTful API 或 Webhook |
| 後端模組 | 禁止直接操作前端 DOM 或瀏覽器 API | 僅可透過 HTTP 回應 |
| AI 模組 | 禁止直接存取 SQLite 或檔案系統 | 僅可透過業務邏輯層注入 |
| 資料層 | 禁止在 route handler 中直接撰寫 SQL | 必須透過 Repository 模式封裝 |

---

## 2. 🚨 絕對安全指令（三鐵律）

> 違反以下任一條等同觸發「暫停開關」，AI 必須立即停止作業並向使用者確認。

### 2.1 容器操作安全

- **刪除容器前**：必須先確認 Volume 是否已備份；執行 `docker rm -v` 前必須輸出 `⚠️ 警告` 並等待使用者明確輸入「同意」。  
- **重啟服務前**：必須先確認 SQLite 檔案已 commit 到磁碟（避免 WAL 資料遺失）。  
- **重建映像檔前**：必須先確認 `.env` 與 `docker-compose.yml` 已備份（容器重建會清空環境變數）。

### 2.2 檔案操作安全

- **刪除檔案前**：必須先 `tar` / `zip` 備份至 `backups/` 目錄；不可直接 `rm -rf` 整個目錄。  
- **覆寫檔案前**：必須先讀取現有內容並與使用者確認是否真的要覆寫。  
- **修改 `.env`**：絕對禁止將真實 API Key 寫入版本控制；僅可修改 `.env.example` 並提示使用者手動同步 `.env`。

### 2.3 資料夾結構變更安全

- **移動 / 重新命名資料夾前**：必須先輸出變更後的結構樹（ASCII tree）並等待「同意」。  
- **跨模組路徑變更**：必須同步更新所有 `import` / `require` 陳述式與 Docker Volume 掛載點。  
- **大量檔案批次處理**：禁止使用 `mv *` 或 `rm *` 萬用字元；必須列舉明確檔名。

### 2.4 安全指令觸發流程

當 AI 偵測到自身即將執行上述任一危險操作時，必須依序執行：

1. 立即停止當前動作
2. 輸出 `⚠️ 暫停提醒：<具體風險說明>`
3. 提供「建議替代方案」
4. 等待使用者明確回應「同意」後才繼續

### 2.5 部署前備份確認字串

執行任何 `docker compose down -v`、`docker rm -v`、`rm -rf` 指令前，終端機必須先輸出：

```bash
echo "BACKUP-VERIFIED $(date -Iseconds)"
```

否則視同未完成備份，拒絕執行。詳細流程見 [README-docker.md §6](./README-docker.md)。

---

## 3. 🌐 使用者偏好（語言與格式）

### 3.1 語言規範

- **永遠使用繁體中文**（Traditional Chinese），包含：  
  - 所有回覆文字  
  - 程式碼註解（`//` 與 `/* */`）  
  - 變數命名若為自然語言時，使用英文（避免拼音）  
  - 文件內容（Markdown、CHANGELOG、註解）  
  - 終端輸出（log 訊息、錯誤訊息）

### 3.2 格式規範

- **開頭 emoji**：每則回覆、開發訊息、文件標題必須以 emoji 開頭（依情境選擇合適 emoji）  
- **結尾標記**：每則對話回覆與文件結尾必須加上「愛太妍」  
- **禁止使用**：簡體中文、英文（除非為專有名詞如 KNN、EXIF、MobileNet、SQLite）

### 3.3 程式碼風格

- **縮排**：2 空格（前端） / 4 空格（後端）  
- **命名**：camelCase（變數、函式）、PascalCase（類別）、UPPER_SNAKE_CASE（常數）  
- **字串**：優先使用單引號（JS）或雙引號（JSON）

---

## 4. 📅 開發階段（三大階段）

### 4.1 階段一：文件建立（✅ 已完成）

- 建立 11 份專案文件  
- 本階段 DoD：所有文件交叉引用通過 lint、語言一致、Ultracode 標準落地  
- 進度看板：[progress.md](./progress.md)  
- 細項清單：[todo_progress.md §1](./todo_progress.md)

### 4.2 階段二：前後端與 AI 模組開發（⏳ 待啟動）

- **前端**：TF.js MobileNet + KNN、Canvas 壓縮、購物車 UI、localStorage 快取  
- **後端**：Express + sharp + SQLite、API 重試（Exponential Backoff）、Graceful Shutdown  
- **AI**：MiniMax VLM 整合、三層 Fallback 解析（JSON → Regex → 啟發式）  
- **部署**：Dockerfile、docker-compose.yml、Cloudflare Tunnel 設定

### 4.3 階段三：TDD 嚴格測試（⏳ 待啟動，至少三循環）

- **Round 1**：單元測試與邊界測試（AI 容錯解析、匯率換算、壓縮、EXIF）  
- **Round 2**：整合測試（API → AI → DB → Webhook 完整流程）  
- **Round 3**：系統 E2E 測試（斷網、匯率故障、圖片錯誤、併發、SIGTERM）  
- 詳細策略：[TESTING_PLAN.md](./TESTING_PLAN.md)

---

## 5. 🧪 TDD 測試失敗處理守則

> ⚠️ 測試失敗時**禁止直接盲目修改程式碼**。

### 5.1 修改前必須輸出的【修改計畫】格式

每次測試失敗或發現問題時，必須先輸出以下結構再等待同意：

```markdown
## 【修改計畫 (Revision Plan)】

### 1. 發現的 Bug 或效能瓶頸說明
- 現象：<具體錯誤訊息或量測數據>
- 重現步驟：<可重現的最小步驟>
- 影響範圍：<受影響的模組或功能>

### 2. 根本原因分析 (Root Cause)
- 定位：<檔案:行號 或 模組名稱>
- 成因：<為何發生的技術原因>
- 為何先前測試未攔截：<流程或測試設計的缺口>

### 3. 具體的修改步驟與預期結果
- 步驟 1：<具體動作>
- 步驟 2：<具體動作>
- 預期結果：<如何驗證修復成功>
- 副作用評估：<是否影響其他模組>

### 4. 等待同意
請回覆「同意」後我才會開始修改。
```

### 5.2 修改後的驗證流程

獲得同意後，修改完成必須執行：

1. 重新執行失敗的測試案例，確認通過
2. 執行全迴歸測試，確認無新破壞
3. 更新 [CHANGELOG.md](./CHANGELOG.md) 與 [todo_progress.md](./todo_progress.md)
4. 提交並標註對應的測試 ID（如 `Fixes: U-AI-03`）

---

## 6. 🛠️ 技術棧速覽

| 層級 | 技術 | 用途 |
|------|------|------|
| 前端框架 | 原生 HTML/JS + ES Modules | 輕量化、零建置 |
| AI 模型 | TensorFlow.js (MobileNet) + KNN | 客戶端特徵提取與分類 |
| 前端壓縮 | Canvas API | JPEG 品質 0.8 → 0.5 遞減 |
| 後端框架 | Node.js 20+ + Express | RESTful API |
| 後端壓縮 | sharp | 1200px fit inside, jpeg quality 85 |
| 資料庫 | better-sqlite3 | 本機持久化、IP Fingerprint 綁定 |
| AI 服務 | MiniMax VLM API | 商品辨識（含三層 Fallback 解析） |
| 匯率 API | exchangerate-api.com | 多幣別換算（SQLite Fallback） |
| 反向代理 | Cloudflare Tunnel | 綁定 `sm.yuang093.cc` |
| 容器化 | Docker + Docker Compose v2 | 一鍵部署、Volume 持久化 |

**環境變數命名**以 [.env.example](./.env.example) 為**單一事實來源**。任何修改環境變數名稱的提案，必須同步更新所有引用文件。

---

## 7. 🚫 禁止行為清單

### 7.1 程式碼層面

- ❌ 提交含有 `console.log` 偵錯輸出的程式碼至 main branch
- ❌ 在前端硬編碼任何 API Key、Token、Secret
- ❌ 使用 `eval()`、`new Function()` 處理使用者輸入
- ❌ 直接拼接 SQL 字串（必須使用 prepared statement）
- ❌ 在 try-catch 中吞掉錯誤卻無 log

### 7.2 文件層面

- ❌ 提交含有 `TODO`、`FIXME`、`<placeholder>` 的 Markdown 文件
- ❌ 在 `.env` 提交真實密鑰（僅 `.env.example` 可提交）
- ❌ 文件結尾缺少「愛太妍」標記
- ❌ 簡體中文或英文回覆（除非為專有名詞）

### 7.3 操作層面

- ❌ 跳過安全指令直接執行 `docker rm -v` / `rm -rf`
- ❌ 在未輸出 `BACKUP-VERIFIED` 確認字串前刪除 Volume
- ❌ 同時修改超過 3 個不相關模組而未拆分 PR
- ❌ 在測試失敗時未輸出【修改計畫】就直接改 code

### 7.4 協作層面

- ❌ 修改本守則前未經使用者明確同意
- ❌ 對其他代理的修改建議未經驗證直接採用
- ❌ 在 commit 訊息中隱瞞破壞性變更

---

## 8. 🔗 參考文件索引

| 文件 | 用途 | 讀者 |
|------|------|------|
| [README.md](./README.md) | 專案入口、快速開始、技術棧徽章 | 新進開發者、GitHub 訪客 |
| [README-docker.md](./README-docker.md) | Docker / Compose / Cloudflare Tunnel 部署手冊 | DevOps、後端工程師 |
| [overview.md](./overview.md) | 系統架構總覽、技術棧矩陣、資料流時序 | 全端工程師 |
| [PROJECT_BRIEF.md](./PROJECT_BRIEF.md) | 1 頁式專案簡報、利害關係人摘要 | PM、決策者 |
| [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) | 專案深度脈絡、技術選型理由、決策紀錄 | AI 代理、新進工程師 |
| [CHANGELOG.md](./CHANGELOG.md) | 版本變更日誌（Keep a Changelog 格式） | 維護者、使用者 |
| [progress.md](./progress.md) | 高階進度追蹤、里程碑看板 | 全員 |
| [todo_progress.md](./todo_progress.md) | 細項 TODO、可勾選工作項 | 開發者 |
| [TESTING_PLAN.md](./TESTING_PLAN.md) | TDD 三循環測試策略、覆蓋率門檻 | QA、測試工程師 |
| [.env.example](./.env.example) | 環境變數範本（單一事實來源） | DevOps、開發者 |
| [docker-compose.yml](./docker-compose.yml) | 容器編排設定 | DevOps |

---

## 附錄：守則維護

- 本守則版本：`v0.1.0`（對應專案版本）  
- 最後更新：2026-06-07  
- 維護者：yuang093  
- 任何修改本守則的提案，必須經過使用者明確同意後方可更新  
- 修改時請同步更新頂部版本號與「最後更新」日期

---

> 📌 **使用提醒**：AI 代理在每次啟動新會話時，應主動載入本文件 + [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md)，確保上下文完整。

愛太妍
