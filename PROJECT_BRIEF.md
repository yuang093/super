# 📋 專案簡報 (Project Brief)

> 文件版本：v0.1.0｜建立日期：2026-06-07｜文件用途：利害關係人 1 頁式摘要
> 適用對象：產品決策者、贊助方、跨部門協作夥伴、新加入的非技術成員
> 規範來源：本文件之行為準則與安全守則統一由 [CLAUDE.md](./CLAUDE.md) 提供

---

## 一、一句話定位

> **「拍照即記帳，外幣即換算 —— 出國逛超市的口袋助理。」**（28 字）

Supermarket Tracker 將「拍照辨識商品」、「自動標價」、「即時匯率換算」三件事壓縮成一次點擊，
讓旅人不再為了記下一條巧克力的價格而手動翻譯包裝、查匯率、按計算機。

---

## 二、目標使用者畫像

| 維度 | 描述 |
|------|------|
| **主要族群** | 25–45 歲的自由行旅客，喜歡逛當地超市採購伴手禮 |
| **行為特徵** | 邊逛邊比價、習慣用手機拍照記錄、回國後常忘記實際花費 |
| **痛點場景** | 在日本唐吉訶德拿著三盒抹茶夾心猶豫該買哪盒、卻看不懂日文標籤與外幣金額 |
| **次要族群** | 代購業者、留學生、跨境電商選品人員 |
| **不適合對象** | 純線上購物者、僅在本地超市消費者（無需匯率換算） |
| **裝置假設** | iPhone / Android 智慧型手機（含相機與行動網路） |

---

## 三、核心價值主張

- **零學習成本**：開啟網頁 → 拍照 → 看到 TWD 金額，全流程不超過 5 秒，免註冊免登入。
- **離線快取**：前端 TF.js MobileNet + KNN 快篩，常見商品 0.7 秒內辨識完成，省雲端 API 費。
- **多幣別即時換算**：整合免費匯率 API，外幣與台幣總價並列顯示，旅遊預算一目了然。
- **資料自主**：購物紀錄綁定 IP Fingerprint 並存於 SQLite，使用者保有資料主導權、可一鍵清空。

---

## 四、MVP 功能清單

1. **兩段式視覺辨識**：前端 TF.js KNN 快篩（信心度 ≥ 0.7 直出）→ 後端 MiniMax VLM 精辨。
2. **EXIF 方向修正**：自動處理 iPhone 直立拍照 0x0112 旋轉問題，避免辨識失敗。
3. **雙端三段式圖片壓縮**：前端 Canvas（0.8 → 0.5，<500KB）+ 後端 sharp（1200px、JPEG 85）。
4. **購物車管理**：單筆刪除、整車清空、外幣 + TWD 雙欄總價即時更新。
5. **匯率自動換算**：API 失敗時自動 Fallback 至 SQLite 快取最近一筆匯率，永不斷線。
6. **免登入機制**：localStorage + IP Fingerprint 綁定，跨裝置仍可辨識同一使用者的歷史紀錄。
7. **Workflow Webhook**：辨識完成、購物車變動、匯率更新皆透過 Event Emitter 廣播，便於串接外部自動化。

---

## 五、成功指標（KPI）

| 指標類別 | 指標項 | 目標值 | 量測方式 |
|----------|--------|--------|----------|
| **辨識品質** | VLM 精辨準確率 | ≥ 85% | 100 張標註樣本 A/B 評測 |
| **辨識品質** | KNN 快篩命中率 | ≥ 40% | 後台統計「未呼叫 VLM」比例 |
| **效能** | 端到端 API 回應時間 | < 3 秒（P95） | APM 監控（含壓縮 + VLM） |
| **效能** | 前端首屏載入 | < 2 秒（4G 網路） | Lighthouse Performance |
| **可靠性** | 系統可用度 | ≥ 99.5%（月） | Cloudflare Tunnel + Healthcheck |
| **使用體驗** | 平均每筆紀錄操作時間 | < 5 秒 | 前端埋點（拍照 → 入車） |
| **測試品質** | 程式碼覆蓋率 | ≥ 80% | Jest / Vitest 覆蓋率報告 |

---

## 六、技術選型理由

採用 **TF.js + MiniMax VLM 兩段式辨識** 在「成本」與「準確率」間取得平衡；
後端以 **Node.js + Express + SQLite** 維持輕量單機可部署；
**Docker Compose + Cloudflare Tunnel** 確保零公網 IP 也能對外服務並保有 HTTPS。

---

## 七、時程規劃

### Phase 1 — 文件奠基（2026-06，本階段）
- 建立 11 份專案文件（含本簡報、CLAUDE 守則、TESTING 策略、Docker 部署等）。
- 完成交叉引用矩陣，確保未來 AI 代理與工程師可在 5 分鐘內理解全貌。
- **驗收**：11 份文件全數產出且通過 Markdown lint。

### Phase 2 — 模組實作（2026-07 預計）
- 前端：相機擷取、Canvas 壓縮、TF.js MobileNet + KNN、購物車 UI。
- 後端：Express 路由、sharp 壓縮、MiniMax VLM 串接（三層 Fallback）、SQLite Schema。
- 共用：EXIF 修正、匯率 API + Fallback、Fingerprint 綁定、Webhook 廣播。
- **驗收**：所有模組通過單元測試、可在本地 docker compose up 一鍵啟動。

### Phase 3 — TDD 三循環測試與上線（2026-08 預計）
- 循環一：單元測試（EXIF、Fallback、壓縮、匯率）。
- 循環二：整合測試（API、Webhook、Event Emitter）。
- 循環三：E2E 測試（拍攝 → 辨識 → 購物車 → 匯率）。
- **驗收**：覆蓋率 ≥ 80%、Cloudflare Tunnel 對外服務 sm.yuang093.cc 穩定運行 7 日。

---

## 八、風險與對策

| 風險編號 | 風險描述 | 影響等級 | 對策 | 對應文件 |
|----------|----------|----------|------|----------|
| R-01 | MiniMax VLM API 回應格式不穩，可能回傳非 JSON | 高 | 三層 Fallback（JSON → Regex → 啟發式），對應單元測試 | [TESTING_PLAN.md](./TESTING_PLAN.md) |
| R-02 | 免費匯率 API 限流或斷線 | 中 | Exponential Backoff 重試 + SQLite 最近匯率 Fallback | [overview.md](./overview.md) |
| R-03 | iPhone 直立拍照導致辨識方向錯誤 | 中 | EXIF 0x0112 解析 + 前端 Canvas 旋轉修正 | [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) |
| R-04 | 大圖上傳造成頻寬與儲存爆量 | 中 | 雙端三段式壓縮（前 Canvas、後 sharp），<500KB 入庫 | [overview.md](./overview.md) |
| R-05 | 容器或 Volume 誤刪導致資料遺失 | 高 | CLAUDE.md 安全三鐵律 + Docker 章節 ⚠️ 暫停提醒 | [README-docker.md](./README-docker.md) |
| R-06 | 無登入機制下使用者誤判他人資料 | 低 | IP Fingerprint + localStorage 雙因子綁定 | [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) |
| R-07 | Cloudflare Tunnel Token 外洩 | 高 | .env 加入 .gitignore、僅以環境變數注入 | [README-docker.md](./README-docker.md) |
| R-08 | 第三方 VLM API 計費超出預算 | 中 | KNN 快篩攔截 + 後台每日請求數量看板 | [progress.md](./progress.md) |

---

## 九、聯絡資訊

| 角色 | 對外聯繫管道 |
|------|--------------|
| 專案維護者 | GitHub Account：[yuang093](https://github.com/yuang093) |
| 程式碼倉庫 | <https://github.com/yuang093/super.git> |
| 部署網址 | <https://sm.yuang093.cc>（Phase 3 上線後可用） |
| 議題回報 | 請於 GitHub Issues 開立議題，並標註 `bug` / `enhancement` 標籤 |
| 安全性通報 | 請參考 [CLAUDE.md](./CLAUDE.md) 安全章節之回報流程 |

> 補充：本專案目前由個人維護，回覆時間以 GitHub Issues 為準；商務合作邀請請透過 GitHub Profile 提供之公開信箱聯繫。

---

## 相關文件

- 設計總覽：[overview.md](./overview.md)
- 工作規範：[CLAUDE.md](./CLAUDE.md)
- 進度看板：[progress.md](./progress.md)
- 細項 TODO：[todo_progress.md](./todo_progress.md)
- 測試策略：[TESTING_PLAN.md](./TESTING_PLAN.md)
- 部署指南：[README-docker.md](./README-docker.md)
- 版本日誌：[CHANGELOG.md](./CHANGELOG.md)

---

愛太妍
