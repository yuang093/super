# 🛒 Supermarket Tracker

> AI 影像辨識購物記帳 + 多幣別匯率即時換算

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](#-系統需求)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](#-部署)
[![TensorFlow.js](https://img.shields.io/badge/TensorFlow.js-MobileNet-FF6F00?style=for-the-badge&logo=tensorflow&logoColor=white)](#-技術棧)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](#-授權)
[![Version](https://img.shields.io/badge/Version-0.1.0-blue?style=for-the-badge)](./CHANGELOG.md)

> ⚠️ 本專案遵循 [CLAUDE.md](./CLAUDE.md) 之 Ultracode 模式與安全指令；任何容器、檔案、結構變更前，請先閱讀規範並完成備份。

---

## ✨ 特色功能

- 📸 **兩段式視覺辨識**：前端 TensorFlow.js MobileNet + KNN 快篩，後端 MiniMax VLM 精辨，兼顧速度與準確率。
- 🧭 **EXIF 方向修正**：自動處理 iPhone 直立拍照之 `0x0112` 旋轉標籤，避免影像旋轉 90° 誤判。
- 🗜️ **雙端三段式壓縮**：前端 Canvas 0.8 → 0.5、後端 `sharp` 1200px JPEG 85，最終 < 500KB，省流量更省時。
- 🛒 **購物車 UI**：單筆刪除 / 全部清空、外幣 + TWD 雙幣總價即時試算。
- 🪪 **免登入機制**：localStorage + IP Fingerprint 綁定 SQLite，跨裝置保留購物紀錄。
- 🔁 **系統韌性**：Exponential Backoff 重試、雙層 Rate Limit、SIGTERM Graceful Shutdown。

---

## 🎬 快速 Demo

```text
[ 首頁截圖 ]    [ 拍照辨識 ]    [ 購物車 ]    [ 匯率換算 ]
```

> 📸 截圖將於 [todo_progress.md §2.1 F-UI-01](./todo_progress.md)「首頁 UI 實作」完成後補入 `docs/screenshots/` 目錄，並於 [CHANGELOG.md](./CHANGELOG.md) 對應版本條目中標註。請以 Git LFS 追蹤 PNG 檔案（單檔 ≤ 2 MB）。

---

## 🚀 快速開始

### 前置需求
請先確認已安裝 [Node.js 20+](https://nodejs.org/)、[Docker](https://www.docker.com/) 與 [Docker Compose](https://docs.docker.com/compose/)。

### 三步驟啟動

```bash
# 1. 複製專案
git clone https://github.com/yuang093/super.git
cd super

# 2. 複製環境變數範本並填入金鑰
cp .env.example .env
# 編輯 .env：填入 VLM_API_KEY、EXCHANGE_API_ENDPOINT 等

# 3. 啟動服務
docker compose up -d
```

啟動完成後，瀏覽器開啟 <http://localhost:3000> 即可使用。

---

## 📋 系統需求

| 項目 | 最低版本 | 說明 |
|------|----------|------|
| Node.js | 20 LTS | 後端 Express 與 sharp 編譯需求 |
| Docker | 24+ | 容器化部署 |
| Docker Compose | v2.20+ | 多服務編排 |
| 磁碟空間 | 2 GB | 含 node_modules 與 SQLite Volume |
| 記憶體 | 2 GB | sharp + TF.js 推論基本需求 |

> 開發模式（無 Docker）需另行安裝 Python 3.10+ 供某些原生編譯情境使用。

---

## 🛠️ 技術棧

| 層 | 技術 | 用途 |
|----|------|------|
| 前端 | HTML / Vanilla JS | 輕量化 SPA，避免框架包袱 |
| 前端 | TensorFlow.js (MobileNet + KNN) | 端側影像快篩（< 100ms） |
| 前端 | Canvas API | 前端影像壓縮與 EXIF 方向修正 |
| 後端 | Node.js + Express | RESTful API + Webhook |
| 後端 | sharp | 後端高效率影像壓縮 |
| 後端 | better-sqlite3 | 本機持久化（Volume 掛載） |
| AI 辨識 | MiniMax VLM API | 雲端視覺語言模型精辨 |
| 匯率 | 免費匯率 API + SQLite Fallback | 多幣別即時換算 |
| 部署 | Docker / Compose | 服務容器化 |
| 部署 | Cloudflare Tunnel | 對外 HTTPS（sm.yuang093.cc） |

---

## 📂 專案結構

```text
super/
├── src/                      # 後端原始碼
│   ├── ai/                   # MiniMax VLM 整合與三層 Fallback 解析
│   ├── api/                  # Express 路由
│   ├── db/                   # better-sqlite3 資料層
│   ├── services/             # 業務邏輯（購物車、匯率、影像）
│   └── utils/                # 共用工具（EXIF、指紋、限流）
├── public/                   # 前端靜態資源（HTML/JS/CSS）
│   ├── js/                   # TF.js、KNN、購物車邏輯
│   └── css/                  # 樣式
├── tests/                    # 測試程式（單元 / 整合 / E2E）
├── data/                     # SQLite 與快取（Volume 掛載點）
├── .env.example              # 環境變數範本
├── docker-compose.yml        # 服務編排
├── README.md                 # 本檔
├── README-docker.md          # Docker 部署詳解
├── TESTING_PLAN.md           # 三循環 TDD 測試策略
├── PROJECT_BRIEF.md          # 1 頁式專案簡報
├── PROJECT_CONTEXT.md        # AI 代理背景知識庫
├── overview.md               # 系統架構總覽
├── progress.md               # 高階進度看板
├── todo_progress.md          # 細項 TODO
├── CHANGELOG.md              # 版本變更日誌
└── CLAUDE.md                 # AI 協作守則（Ultracode + 安全指令）
```

> ⚠️ 變更資料夾結構前請詳閱 [CLAUDE.md](./CLAUDE.md) 之安全指令，並先完成 `data/` 備份。

---

## 🧪 測試

本專案採 TDD 嚴格流程，至少三循環驗收：

1. **單元測試**：EXIF 解析、Fallback 三層解析、匯率換算、影像壓縮。
2. **整合測試**：RESTful API、Webhook、Event Emitter 廣播。
3. **E2E 測試**：拍照 → 壓縮 → VLM 辨識 → 購物車 → 匯率換算 完整鏈路。

覆蓋率門檻 **≥ 80%**。完整測試計畫請見 [TESTING_PLAN.md](./TESTING_PLAN.md)。

---

## 📦 部署

Docker 與 Cloudflare Tunnel 完整部署手冊請見 [README-docker.md](./README-docker.md)。

重點提醒：

- ⚠️ 刪除容器（`docker compose down -v`）將連同 SQLite Volume 一起清除，**請先備份**。
- ⚠️ 變更 `data/` 路徑前，必須先停止服務並 `cp` 整個資料夾。
- 對外網域預設為 `sm.yuang093.cc`，由 Cloudflare Tunnel 提供 HTTPS。

---

## 🤝 貢獻指南

1. 詳閱 [CLAUDE.md](./CLAUDE.md)，遵守 Ultracode 模式（禁 Placeholder、DoD 驗收）。
2. 從 [todo_progress.md](./todo_progress.md) 認領項目，每項皆含 DoD 與測試案例 ID。
3. 提交前確保：
   - `npm test` 全部通過、覆蓋率達標。
   - 無 TODO / FIXME / 假資料殘留。
   - Commit 訊息使用 Conventional Commits 格式。
4. 發 PR 至 `main`，標題須引用對應 todo 編號（例如 `feat(cart): 完成購物車單筆刪除 (#T-012)`）。

---

## 📄 授權

本專案以 **MIT License** 授權釋出，完整授權條文存放於 `LICENSE` 檔案（將於 v0.2.0 版本提交，當前請參閱 [opensource.org/licenses/MIT](https://opensource.org/licenses/MIT) 標準範本）。

---

## 🔗 相關文件索引

| 文件 | 用途 |
|------|------|
| [CLAUDE.md](./CLAUDE.md) | AI 協作守則（Ultracode + 安全指令） |
| [overview.md](./overview.md) | 系統架構總覽（5 分鐘看懂全局） |
| [PROJECT_BRIEF.md](./PROJECT_BRIEF.md) | 1 頁式專案簡報（給非技術讀者） |
| [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) | 專案深度脈絡（給 AI 代理） |
| [progress.md](./progress.md) | 高階進度看板（三階段） |
| [todo_progress.md](./todo_progress.md) | 細項 TODO（每項含 DoD） |
| [TESTING_PLAN.md](./TESTING_PLAN.md) | 三循環 TDD 測試策略 |
| [README-docker.md](./README-docker.md) | Docker 與 Cloudflare Tunnel 部署手冊 |
| [CHANGELOG.md](./CHANGELOG.md) | 版本變更日誌（Keep a Changelog） |

---

<div align="center">

🛒 **Supermarket Tracker** — 讓出國購物記帳，從此不再為換算而煩惱。

[⬆ 回到頂部](#-supermarket-tracker)

</div>

愛太妍
