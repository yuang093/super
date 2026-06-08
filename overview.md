# 🏗️ 系統架構總覽

> Supermarket Tracker — 出國購物記帳與匯率換算 Web App
> 文件版本：v0.1.0｜最後更新：2026-06-07
> 適用對象：工程師、AI 協作代理、技術審查者
> 閱讀時間：≈ 5 分鐘

---

## 一、系統願景

### 1.1 問題陳述

出國旅遊或在國外超市購物時，旅客常面臨以下痛點：

- **記帳繁瑣**：每一筆結帳後需手動輸入品項、單價、幣別，累積數十筆後極易出錯。
- **匯率換算不便**：收據上的外幣金額需以手機計算機換算回新台幣（TWD），無法即時掌握總花費。
- **視覺辨識門檻高**：超市收據字體小、欄位密集、語系不一，傳統 OCR 工具（Google Vision、Tesseract）對多語系小字辨識率不足 60%。
- **隱私疑慮**：將收據上傳至第三方雲端 OCR 服務，涉及個資與消費紀錄外洩風險。
- **離線場景**：海外網路不穩或漫遊昂貴，需要在無網環境下仍能記帳。

### 1.2 解決方案

Supermarket Tracker 提供一套 **離線優先（Offline-First）** 的視覺辨識記帳系統：

1. 使用者拍照收據 → 瀏覽器端先以 TensorFlow.js MobileNet + KNN 快篩。
2. 若信心度 ≥ 0.7 視為已知品項，直接命中快取，跳過後端 AI 呼叫。
3. 信心度不足時，將壓縮後影像送至後端，由 MiniMax VLM 精辨並回傳結構化品項與金額。
4. 系統自動以當日匯率（免費 API + SQLite 快取）將外幣換算為 TWD，匯入購物車。
5. 整體流程在 3 秒內完成，且大部分操作可離線運作。

### 1.3 價值主張

| 面向 | 傳統方案 | Supermarket Tracker |
|------|---------|---------------------|
| 辨識速度 | 5–10 秒（雲端 OCR） | < 3 秒（前端快篩 + 後端精辨） |
| 離線能力 | ✗ | ✓（KNN 快取 + SQLite 本地） |
| 多語系支援 | 需付費 API | MiniMax VLM 原生多語系 |
| 隱私 | 上傳至第三方 | 影像前端壓縮後才送後端 |
| 成本 | USD 0.0015 / 張 | 命中快取 0；未命中 ≈ USD 0.0003 |

---

## 二、核心設計理念

### 2.1 兩段式視覺辨識（Two-Stage Recognition）

前端 TF.js + KNN 作為**粗篩層**，後端 VLM 作為**精辨層**，兼顧速度、成本與準確率。

### 2.2 Offline-First 優先

- localStorage 儲存購物車與快取。
- IndexedDB 儲存 KNN 特徵向量。
- SQLite 儲存匯率歷史與使用者綁定資料。
- 網路中斷時，購物車仍可累積，恢復連線後再同步匯率換算。

### 2.3 Graceful Degradation（優雅降級）

任一層失效時，系統不會完全崩潰，而是降級到下一層級：

```
VLM API 失敗 → 啟發式 Regex 解析 → 使用者手動輸入
匯率 API 失敗 → SQLite 歷史匯率 → 提示使用者手動輸入
資料庫寫入失敗 → 記憶體佇列 + 重試 → 最終落地
```

### 2.4 Ultracode 模組邊界

- 每個模組對外僅暴露**單一職責**的公開介面（export function）。
- 模組間通訊以**事件發射器（Event Emitter）** 解耦，禁止互相 import 內部實作。
- 任何修改都必須有對應的單元測試案例 ID（連結 TESTING_PLAN.md）。

---

## 三、技術棧矩陣

| 層級 | 技術選型 | 版本 | 角色 |
|------|---------|------|------|
| **前端框架** | Vanilla HTML/JS + ES Modules | — | 零建置成本、零框架包袱 |
| **前端 AI** | TensorFlow.js + MobileNet + KNN | 4.x / 2.x | 瀏覽器端粗篩 |
| **前端影像** | Canvas API | 內建 | EXIF 修正、雙段壓縮 |
| **後端框架** | Node.js + Express | 20 LTS / 4.x | RESTful API 服務 |
| **後端影像** | sharp | 0.33.x | 後端影像後處理 |
| **後端資料庫** | better-sqlite3 | 11.x | 同步 SQLite，零非同步成本 |
| **AI 服務** | MiniMax VLM API | — | 視覺語言模型精辨 |
| **匯率服務** | 免費匯率 API（exchangerate.host） | — | 每日匯率抓取 |
| **容器化** | Docker + Docker Compose | 24+ / 2.x | 一鍵部署 |
| **反向代理** | Cloudflare Tunnel | — | HTTPS + 防 DDoS |
| **版本控制** | Git + GitHub | — | main 分支保護 |

---

## 四、模組架構圖

### 4.1 前端模組（瀏覽器）

```
┌──────────────────────────────────────────────────────────────┐
│                     瀏覽器 (Browser)                          │
│                                                              │
│  ┌────────────┐   ┌────────────┐   ┌──────────────────────┐ │
│  │ UI Layer   │   │ Service    │   │ Storage Layer        │ │
│  │            │   │ Layer      │   │                      │ │
│  │ index.html │──▶│ camera.js  │──▶│ localStorage         │ │
│  │ style.css  │   │ cart.js    │   │ ├─ cart              │ │
│  │ app.js     │   │ api.js     │   │ ├─ fingerprint       │ │
│  └────────────┘   └────────────┘   │ └─ knn_cache_meta    │ │
│         │                │         │                      │ │
│         ▼                ▼         │ IndexedDB            │ │
│  ┌────────────┐   ┌────────────┐   │ └─ feature_vectors   │ │
│  │ AI Layer   │   │ Image      │   └──────────────────────┘ │
│  │ (TF.js)    │   │ Pipeline   │             ▲              │
│  │            │   │            │             │              │
│  │ mobilenet  │   │ exif_fix   │   ┌──────────────────────┐ │
│  │ knn_class  │   │ canvas_    │   │ Event Bus            │ │
│  │ (≥0.7)     │   │ compress   │   │ (event_emitter.js)   │ │
│  └────────────┘   └────────────┘   └──────────────────────┘ │
│         │                │                     │              │
│         └────────────────┴─────────────────────┘              │
│                          │                                   │
└──────────────────────────┼───────────────────────────────────┘
                           │ HTTPS (JSON + Base64 Image)
                           ▼
```

### 4.2 後端模組（Node.js Server）

```
┌──────────────────────────────────────────────────────────────┐
│                   Node.js Server (Express)                   │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │  Router      │  │  Controller  │  │  Service           │ │
│  │              │  │              │  │                    │ │
│  │ /api/recognize│─▶│ recognize.ctrl│─▶│ vlm.service.js    │ │
│  │ /api/cart     │  │ cart.ctrl    │  │ ├─ minimax_client │ │
│  │ /api/rate     │  │ rate.ctrl    │  │ ├─ fallback_regex │ │
│  │ /api/fp       │  │ fp.ctrl      │  │ └─ heuristic      │ │
│  │ /webhook/*    │  │ webhook.ctrl │  │                    │ │
│  └──────────────┘  └──────────────┘  │ sharp.service.js  │ │
│         │                │           │ ├─ exif_orient     │ │
│         ▼                ▼           │ └─ compress_1200  │ │
│  ┌─────────────────────────────────┐ │                    │ │
│  │  Middleware                     │ │ rate.service.js   │ │
│  │  ├─ rate_limit (token bucket)   │ │ ├─ fetch_live     │ │
│  │  ├─ retry (exp. backoff)        │ │ └─ sqlite_fallback│ │
│  │  ├─ ip_fingerprint              │ │                    │ │
│  │  └─ error_handler               │ │ cart.service.js   │ │
│  └─────────────────────────────────┘ │ fingerprint.svc   │ │
│         │                            └────────────────────┘ │
│         ▼                                     │              │
│  ┌─────────────────────────────────┐         │              │
│  │  Data Layer (better-sqlite3)    │◀────────┘              │
│  │  ├─ receipts                    │                        │
│  │  ├─ items                       │                        │
│  │  ├─ rates_history               │                        │
│  │  └─ fingerprint_bindings        │                        │
│  └─────────────────────────────────┘                        │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Process Manager                                     │    │
│  │  ├─ SIGTERM handler (graceful shutdown, 30s)         │    │
│  │  ├─ healthcheck (/health)                            │    │
│  │  └─ logger (structured JSON)                         │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  External Services     │
              │  ├─ MiniMax VLM API    │
              │  └─ Exchange Rate API  │
              └────────────────────────┘
```

---

## 五、資料流（端到端時序）

### 5.1 主流程：拍照到購物車

```
使用者          瀏覽器前端           後端 API            MiniMax VLM       SQLite
  │                │                    │                    │               │
  │ ① 拍照         │                    │                    │               │
  ├───────────────▶│                    │                    │               │
  │                │ ② EXIF 修正       │                    │               │
  │                │    (0x0112)        │                    │               │
  │                │ ③ Canvas 壓縮     │                    │               │
  │                │    (0.8→0.5, <500KB)                   │               │
  │                │ ④ TF.js 特徵抽取  │                    │               │
  │                │ ⑤ KNN 比對        │                    │               │
  │                │    ├─ ≥0.7 命中    │                    │               │
  │                │    │   → ⑥a 直接採用│                   │               │
  │                │    └─ <0.7 送後端  │                    │               │
  │                │ ⑥b POST /api/recognize (Base64)         │               │
  │                ├───────────────────▶│                    │               │
  │                │                    │ ⑦ sharp 後處理    │               │
  │                │                    │    (1200px, q=85)  │               │
  │                │                    │ ⑧ VLM 呼叫        │               │
  │                │                    ├───────────────────▶│               │
  │                │                    │ ⑨ content: "{...}"│               │
  │                │                    │◀───────────────────┤               │
  │                │                    │ ⑩ 三層 Fallback 解析              │
  │                │                    │    JSON → Regex → 啟發式          │
  │                │                    │ ⑪ 寫入 receipts / items           │
  │                │                    ├───────────────────────────────────▶│
  │                │                    │ ⑫ 匯率換算 USD/JPY → TWD          │
  │                │                    │     (API 優先，SQLite 備援)        │
  │                │ ⑬ 回傳 {items, total_twd, rate}        │               │
  │                │◀───────────────────┤                    │               │
  │ ⑭ 更新購物車  │                    │                    │               │
  │◀───────────────┤                    │                    │               │
  │                │                    │                    │               │
```

### 5.2 失敗 Fallback 時序

```
                ┌──────────────────────────────────────────────┐
                │ VLM API Timeout (10s) 或 5xx 錯誤            │
                └────────────────────┬─────────────────────────┘
                                     ▼
                ┌──────────────────────────────────────────────┐
                │ 第 1 次重試（延遲 1s，jitter ±200ms）        │
                └────────────────────┬─────────────────────────┘
                                     ▼ 仍失敗
                ┌──────────────────────────────────────────────┐
                │ 第 2 次重試（延遲 2s，jitter ±400ms）        │
                └────────────────────┬─────────────────────────┘
                                     ▼ 仍失敗
                ┌──────────────────────────────────────────────┐
                │ 第 3 次重試（延遲 4s，jitter ±800ms）        │
                └────────────────────┬─────────────────────────┘
                                     ▼ 仍失敗
                ┌──────────────────────────────────────────────┐
                │ Fallback：Regex 解析使用者提供的品項          │
                │ 若仍不足 → 啟發式 + 手動輸入 UI              │
                └──────────────────────────────────────────────┘
```

---

## 六、兩段式視覺辨識詳解

### 6.1 前端：TF.js MobileNet + KNN（粗篩層）

**目標**：在 200ms 內決定是否要呼叫昂貴的 VLM API。

**流程**：

1. 影像前處理：縮放至 224×224、正規化至 [-1, 1]。
2. 透過 MobileNet（不含最後分類層）抽取 1024 維特徵向量。
3. 與 IndexedDB 中的已知品項特徵向量做 KNN（K=5，歐氏距離）。
4. 計算最近鄰距離的平均信心分數。
5. **信心度 ≥ 0.7** → 視為命中，直接回傳該品項的快取資料。
6. **信心度 < 0.7** → 將影像送至後端精辨。

**特徵向量儲存**：

- 每個已知品項至少需要 5 張不同角度的訓練樣本。
- 訓練時即時抽取特徵並寫入 IndexedDB，無須後端參與。
- 使用者首次辨識成功後，自動將該筆結果加入 KNN 訓練集。

**效能指標**：

| 階段 | 目標時間 | 實測環境 |
|------|---------|---------|
| MobileNet 推論 | ≤ 150ms | iPhone 13 / Chrome 120 |
| KNN 比對（100 個樣本） | ≤ 50ms | 同上 |
| 整體前端粗篩 | ≤ 250ms | — |

### 6.2 後端：MiniMax VLM（精辨層）

**目標**：在 3 秒內回傳結構化品項與金額。

**API 合約**：

```
POST https://api.minimax.io/v1/chat/completions
Headers:
  Authorization: Bearer ${VLM_API_KEY}
  Content-Type: application/json
Body:
  {
    "model": "MiniMax-M3",
    "messages": [
      {
        "role": "user",
        "content": [
          { "type": "text", "text": "請辨識此收據上的所有品項與金額，回傳 JSON 格式。" },
          { "type": "image_url", "image_url": { "url": "data:image/jpeg;base64,..." } }
        ]
      }
    ]
  }

Response:
  {
    "choices": [
      {
        "message": {
          "content": "{\"items\": [{\"name\": \"Apple\", \"price\": 1.99, \"qty\": 3}]}"
        }
      }
    ]
  }
```

**三層 Fallback 解析**：

```
Layer 1 — JSON.parse
    ├─ 成功 → 回傳 items
    └─ 失敗（不是合法 JSON）
        ▼
Layer 2 — Regex 萃取
    ├─ 成功（找到 name + price 配對）→ 回傳 items
    └─ 失敗（無可辨識模式）
        ▼
Layer 3 — 啟發式
    ├─ 行分割 + 數字偵測
    ├─ 語言模型字典比對
    └─ 回傳部分結果 + 標記 confidence: low
        ▼
最終保底
    └─ 回傳空陣列 + UI 提示「請手動輸入」
```

### 6.3 兩段式協作效益

| 指標 | 純後端 VLM | 兩段式（KNN + VLM） |
|------|-----------|---------------------|
| 平均延遲 | 2.8 秒 | 0.4 秒（命中 80%）|
| VLM 呼叫量 | 100% | 20% |
| 月成本（1 萬張） | USD 15 | USD 3 |
| 離線可用性 | ✗ | ✓（命中快取時） |

---

## 七、影像處理管線

### 7.1 完整管線圖

```
原始拍照 (iPhone, 3–8MB, EXIF 0x0112=6)
        │
        ▼
┌────────────────────────────────────────────────────────────┐
│ 階段 A：瀏覽器端預處理（< 200ms）                          │
│                                                            │
│  A1. EXIF Orientation 讀取                                 │
│      ├─ Orientation 1: 保持                                │
│      ├─ Orientation 3: 旋轉 180°                           │
│      ├─ Orientation 6: 旋轉 90° (iPhone 直立常見)          │
│      └─ Orientation 8: 旋轉 270°                           │
│  A2. Canvas 繪製（套用方向矩陣）                           │
│  A3. 雙段 Canvas 壓縮                                      │
│      ├─ 第 1 段：quality=0.8, maxWidth=1600                │
│      └─ 第 2 段：quality=0.5, target<500KB                 │
│  A4. Base64 編碼                                            │
└────────────────────────────────────────────────────────────┘
        │
        ▼ (Base64 字串，< 700KB)
        │
┌────────────────────────────────────────────────────────────┐
│ 階段 B：後端後處理（< 300ms）                              │
│                                                            │
│  B1. Base64 → Buffer                                       │
│  B2. sharp 重新解碼                                        │
│  B3. .rotate() 自動套用 EXIF（保險機制）                   │
│  B4. .resize({ width: 1200, fit: 'inside', withoutEnlargement: true }) │
│  B5. .jpeg({ quality: 85, mozjpeg: true })                 │
│  B6. .toBuffer()                                           │
│  B7. 重新編碼為 Base64 送 VLM                              │
└────────────────────────────────────────────────────────────┘
        │
        ▼
   MiniMax VLM API
```

### 7.2 雙端壓縮的理由

| 理由 | 說明 |
|------|------|
| **節省頻寬** | 前端先壓到 < 500KB，後端不必處理 8MB 原圖 |
| **避免 VLM 拒絕** | MiniMax API 對 > 4MB 的 Base64 容易 timeout |
| **隱私強化** | 原始 EXIF GPS 座標在前端壓縮時已被 Canvas 抹除 |
| **後端保險** | 即使前端未做 EXIF 修正，sharp 仍會以 .rotate() 補救 |

### 7.3 已知限制

- iOS 17+ 的 HEIC 格式需先以 `<input type="file" accept="image/*">` 強制 JPEG 輸出。
- 過度模糊或褶皺的收據辨識率仍低於 50%，需手動輸入。
- 後端 sharp 的 withoutEnlargement 對小於 1200px 的影像不放大，避免失真。

---

## 八、系統韌性機制

### 8.1 API 重試（Exponential Backoff + Jitter）

```javascript
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries - 1) throw err;
      const baseDelay = Math.pow(2, attempt) * 1000;  // 1s, 2s, 4s
      const jitter = Math.random() * baseDelay * 0.2;  // ±20%
      await sleep(baseDelay + jitter);
    }
  }
}
```

### 8.2 雙層 Rate Limit

| 層級 | 限制 | 實作 |
|------|------|------|
| **前端** | 每分鐘 10 次拍攝 | localStorage 計數 + 倒數提示 |
| **後端** | 每 IP 每分鐘 30 次 | express-rate-limit + Redis（未來） |

### 8.3 Graceful Shutdown

收到 SIGTERM 時依序執行：

1. 停止接受新連線（`server.close()`）
2. 等待 30 秒讓進行中的請求完成
3. 關閉 SQLite 連線（`db.close()`）
4. 關閉 Event Emitter 監聽
5. 寫入關機日誌，process.exit(0)

### 8.4 事件廣播（Event Emitter）

後端內部模組透過事件解耦：

```javascript
// vlm.service.js
emitter.emit('receipt:recognized', { userId, items, totalTwd });

// webhook.controller.js
emitter.on('receipt:recognized', (payload) => {
  // 發送 Webhook 給外部系統（如 Notion、Line Bot）
});
```

### 8.5 失敗可觀測性

- 結構化 JSON 日誌（pino）寫入 `logs/app.log`。
- `/health` 端點回傳 SQLite 連線狀態、API 配額、Uptime。
- 失敗計數超過閾值時觸發告警（未來：整合 Sentry）。

---

## 九、與其他文件的引用

本文件為**技術入口**，與下列文件互鎖：

| 文件 | 引用方向 | 互補內容 |
|------|---------|---------|
| [PROJECT_BRIEF.md](./PROJECT_BRIEF.md) | 雙向 | 1 頁式非技術摘要，從本文件萃取 |
| [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) | 引用 | 領域知識、ADR 決策紀錄、術語表 |
| [TESTING_PLAN.md](./TESTING_PLAN.md) | 引用 | 測試金字塔、TDD 三循環、覆蓋率門檻 |
| [README.md](./README.md) | 引用 | 開發者 Onboarding 與快速開始 |
| [README-docker.md](./README-docker.md) | 引用 | Docker 部署、Cloudflare Tunnel 設定 |
| [CLAUDE.md](./CLAUDE.md) | 引用 | AI 協作守則、Ultracode 標準、安全指令 |
| [todo_progress.md](./todo_progress.md) | 引用 | 細項 TODO 與 DoD 驗收 |
| [progress.md](./progress.md) | 引用 | 三階段里程碑與完成度 |
| [CHANGELOG.md](./CHANGELOG.md) | 引用 | 版本變更日誌 |
| [.env.example](./.env.example) | 引用 | 環境變數說明 |
| [docker-compose.yml](./docker-compose.yml) | 引用 | 容器編排設定 |

> ⚠️ **安全指令提醒**：本文件涉及架構變更時，刪除容器 / 移除檔案 / 變更資料夾結構前，必須暫停並提醒備份（依 CLAUDE.md 安全指令三鐵律）。

---

## 十、版本歷程

| 版本 | 日期 | 變更 |
|------|------|------|
| 0.1.0 | 2026-06-07 | 初版建立（11 份文件藍圖第一階段） |

---

愛太妍
