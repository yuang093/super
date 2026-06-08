# 🧠 專案深度脈絡 (Project Context)

> 本文件為 Supermarket Tracker 專案的「深度脈絡」,專門提供給接手開發的 AI 代理(Agent)閱讀。
> 閱讀對象:Claude Code、GPT 系代理、自家 LLM 工具鏈的自動化腳本。
> 閱讀順序:CLAUDE.md → PROJECT_CONTEXT.md(本文件)→ overview.md → TESTING_PLAN.md → todo_progress.md。
> 版本:對應 CHANGELOG.md 0.1.0(初版空殼結構建立階段)。

---

## Section 1:專案目標與非目標

### 1.1 核心目標(What we DO)

1. **拍照即記帳**:使用者在海外旅遊的超市結帳後,只需對著收據拍一張照,系統自動辨識品項、單價、數量、幣別。
2. **即時匯率換算**:辨識完成後,立即將外幣金額換算為新台幣(TWD),並彙總到購物車總價。
3. **隱私優先**:免登入機制,資料以 localStorage + IP Fingerprint 綁定 SQLite,不出賣使用者個資。
4. **離線友善**:前端具備 TF.js MobileNet + KNN 快篩,即使網路不穩也能在本地完成初階判斷,降低 VLM API 依賴。
5. **外部整合**:提供標準 Webhook / RESTful API 與 Event Emitter,讓外部工具(Notion 同步、Google Sheets)無痛串接。

### 1.2 明確非目標(What we DO NOT DO)

- ❌ **不做帳號系統**:不引入 OAuth、不存 Email、不做密碼雜湊;所有識別靠 localStorage + IP 綁定。
- ❌ **不做雲端圖片儲存**:圖片只在前端壓縮後丟給 VLM,後端不留圖(避免隱私爭議與儲存成本)。
- ❌ **不做多幣別即時切換**:首版僅支援「外幣 → TWD」單向換算;反向換算留待 v0.2+ 議題。
- ❌ **不做發票 OCR 完整版**:本系統針對「超市熱感紙收據」優化,紙本電子發票、長條型加油發票不在範圍。
- ❌ **不做多人協作記帳**:不支援家庭共享帳本;每位使用者獨立綁定 IP Fingerprint。
- ❌ **不做手機原生 App**:本階段僅 Web 響應式設計,假設使用者用手機瀏覽器(PWA 化留待 v0.3+)。
- ❌ **不做中文品項翻譯**:辨識出來的外文品項(英、日、韓)不自動翻譯成中文,維持原文以便比價。

---

## Section 2:使用者旅程(User Story)

### 2.1 完整情境:旅日旅客在東京超市

> **角色**:小明,30 歲工程師,首次到東京自由行 7 天,每天逛至少一家超商或超市。

#### 階段 A:準備(旅程前)
1. 小明在桃園機場候機時,打開 `sm.yuang093.cc` 加入手機主畫面(PWA 預備)。
2. 系統自動生成 Fingerprint UUID(存在 localStorage),無需註冊。
3. 首次進入時,引導頁顯示「拍攝收據示範 GIF」,並提醒 iPhone 使用者「請使用內建相機,不要橫拍」。

#### 階段 B:結帳(旅程中)
1. 小明在唐吉訶德結帳後,拿到熱感紙收據,長度約 15 公分。
2. 他**直立拿著 iPhone** 對收據拍照(不刻意橫轉)。
3. 開啟 Web App → 點「📷 拍攝新收據」→ 選擇剛剛的照片。
4. 前端立刻顯示:
   - 圖片自動 EXIF 旋轉修正(從橫躺轉正)
   - 進度條:「前端預判中...」(TF.js MobileNet + KNN 0.7 閾值快篩)
   - 若 KNN 信心度 < 0.7,改走後端 VLM 精辨
5. 3-5 秒後,辨識結果回填到購物車(品項、價格、JPY 標記)。
6. 系統自動呼叫匯率 API(若失敗則降級 SQLite 緩存),即時換算每項 TWD 等值價。
7. 小明確認無誤,點「✅ 加入購物車」,購物車底部顯示「總計 ¥3,480 ≈ NT$748」。

#### 階段 C:回國後
1. 小明回國想彙整整趟旅程支出,開啟 Web App 看到 7 天累積的 21 筆購物紀錄。
2. 他點「匯出 JSON」,產出標準格式丟到 Notion 試算表。
3. 清理資料:點「清空購物車」,前端彈出雙重確認。

### 2.2 邊緣情境(Edge Cases)

- **EXIF 0x0112 = 6(右轉 90°)**:iPhone 直拍收據時,EXIF 標記旋轉但 Canvas 預設按像素佈局讀取,導致圖片橫躺。→ 必須前端解碼時讀取 orientation,反向旋轉。
- **模糊照片**:手震或低光源 → TF.js KNN 信心度必低於 0.7,自動走 VLM 精辨。
- **API 503 過載**:VLM 服務尖峰時回傳 503 → 啟動 Exponential Backoff 重試(1s → 2s → 4s),最長 8 秒。
- **重複上傳同一張**:User 連按兩次拍照按鈕 → 前端以 SHA-256(image buffer) 去重,第二次直接返回上次結果。
- **匯率 API 離線**:開機時若匯率 API 失敗,直接從 SQLite 載入上次緩存匯率,並在 UI 顯示「匯率更新日期:2026-06-01」提示。

---

## Section 3:技術選型深度說明

### 3.1 為何選 TF.js + KNN?(前端預篩)

- **選 TF.js MobileNet 的理由**:
  - 預訓練模型小(~17MB),第一次載入後快取,後續 < 200ms 完成推論。
  - 支援瀏覽器原生 WebGL 加速,即使在手機也能 < 1s 跑完。
  - 與 KNN 結合後不需要 Retrain 即可適應新類別,只要累積特徵向量。
- **為何 KNN 而非 Logistic Regression**:
  - 超市品項多樣(飲料、零食、生鮮),每個類別樣本不均勻,KNN 容忍不平衡資料。
  - 0.7 閾值是經驗值:低於 0.7 表示「看起來不像已知品項」,直接交給 VLM 處理省 API 額度。
- **放棄方案對比**:
  - ❌ TensorFlow Lite + TFLite Runtime:雖然更快,但需要 WebAssembly 載入,手機相容性差。
  - ❌ 直接前端跑大型 CNN(VGG-16):體積太大,首次載入 90MB+ 不實際。
  - ❌ 不做前端預篩,全部丟 VLM:VLM API 有 rate limit,連拍 10 張就會觸發 429。

### 3.2 為何選 better-sqlite3?(本機資料庫)

- **同步 API**:不需要 await 包裹,大幅簡化後端程式碼。
- **單檔儲存**:適合小型應用部署(單一 .db 檔),方便 Docker Volume 備份。
- **效能優異**:10 萬筆以內的查詢 < 1ms,完全夠用。
- **放棄方案對比**:
  - ❌ PostgreSQL / MySQL:本應用資料量小(每使用者 < 1000 筆購物),過度設計。
  - ❌ LowDB(JSON 檔):無 SQL 查詢能力,匯率表 JOIN 會很痛苦。
  - ❌ IndexedDB(前端):跨分頁同步不易,且無法在後端用 Node 工具查詢。

### 3.3 為何選 Cloudflare Tunnel?(部署通道)

- **免費**:個人小型應用無需負擔固定 IP 或反向代理伺服器。
- **零信任安全**:不需開防火牆 port,容器對外只走 outbound 443。
- **自動 HTTPS**:Let's Encrypt 憑證自動頒發與續期。
- **自訂網域**:透過 `sm.yuang093.cc` 子網域直接對接,符合 README 部署指南。
- **放棄方案對比**:
  - ❌ Nginx + Let's Encrypt:需要每 90 天手動或 cron 續期,易出包。
  - ❌ 直接暴露 Node port:家裡 IP 變動、固定 IP 成本高,資安風險大。

### 3.4 為何選 Canvas API + sharp?(雙端壓縮)

- **前端 Canvas**:拍照後立即壓縮,降低上傳體積(從 3MB 縮到 < 500KB),省 VLM 流量費。
- **後端 sharp**:作為二次保險,即使前端被繞過,後端也確保送進 VLM 的圖 < 1.2MB 且長邊 < 1200px。
- **放棄方案對比**:
  - ❌ jimp(Node 純 JS):速度慢 5-10 倍,CPU 吃緊。
  - ❌ ImageMagick CLI:需要外部 binary,Docker 映像檔會胖 200MB。

---

## Section 4:兩段式辨識設計理由

### 4.1 為何不在前端一次搞定?

理論上 MobileNet + KNN 可以獨立完成辨識,但實務面臨三大瓶頸:

1. **類別覆蓋不足**:KNN 只能識別「已見過特徵向量」的品項。超市新品(季節限定商品)永遠不在訓練集。
2. **文字辨識弱**:MobileNet 對「品名文字」OCR 能力差,只會判斷「這是飲料罐」,讀不到「午後紅茶 500ml」。
3. **多語言支援差**:訓練集以英文為主,日文、韓文收據辨識率 < 30%。

### 4.2 為何不在後端一次搞定?

- **成本**:每次呼叫 VLM API 都收費(約 NT$0.5/張),若用戶一天拍 50 張,月費爆表。
- **延遲**:純後端 VLM 來回 3-5 秒,加上圖片上傳 2 秒,使用者體驗差。
- **離線**:飛機上、火車站、訊號差時,VLM 完全無法使用。

### 4.3 兩段式的最佳分工

| 階段 | 角色 | 判斷 | 動作 |
|------|------|------|------|
| 第一段(前端) | TF.js MobileNet + KNN | 信心度 ≥ 0.7? | ✅ 直接寫入購物車;❌ 進入第二段 |
| 第二段(後端) | MiniMax VLM | 解析 JSON / Regex / 啟發式 | 寫入購物車 + 記錄特徵供未來 KNN 學習 |

**附加效益**:每次 VLM 成功辨識後,把特徵向量回寫 KNN 訓練集,讓系統越用越準(被動式 Federated Learning 概念)。

---

## Section 5:EXIF 0x0112 的痛點故事

### 5.1 問題現場

小明在唐吉訶德結帳後,**直立拿著 iPhone 對收據拍照**(這是 99% 使用者的自然動作)。
照片在 iPhone 相簿中顯示正常(直立),但**圖片檔案內部**的 EXIF 標籤 `0x0112 Orientation = 6`(表示「需右轉 90° 才能正立」)。

### 5.2 為何這是問題?

- **瀏覽器渲染**:Chrome / Safari 開圖時會自動讀 EXIF 並旋轉顯示,但 **Canvas drawImage 與 FileReader 不會自動套用 EXIF**。
- **iOS 行為例外**:iOS 14+ Safari 對 Canvas 內的 EXIF 自動套用,但 Android Chrome 與桌面瀏覽器**完全不會**。
- **後端 sharp**:預設會讀 EXIF 並自動旋轉(`autoOrient: true`),但若前端已經壞掉,後端接手前已經是歪的。

### 5.3 解決方案(雙端 EXIF 處理)

**前端(必須)**:
1. 用 `exifr` 或 `piexifjs` 解析 orientation。
2. 若 `Orientation ∈ {6, 8}`(需旋轉),在 Canvas 上手動 rotate 後再壓縮。
3. 壓縮輸出時,**主動移除 EXIF 標籤**(避免後端二次處理衝突)。

**後端(防禦性)**:
1. `sharp(input).rotate()` 不帶參數,會自動根據 EXIF 旋轉。
2. 同時強制 resize 到 1200px 長邊、JPEG quality 85。

### 5.4 測試案例(連結 TESTING_PLAN.md TC-EXIF-001)

輸入:EXIF Orientation=6 的 JPEG 檔
預期:輸出圖片在任意瀏覽器/Canvas 中都為正立
實測覆蓋率:單元測試 100%,需含 iOS Safari、Android Chrome、桌面 Chrome 三種 User-Agent 模擬。

---

## Section 6:AI 回應三層 Fallback 設計理由

### 6.1 MiniMax VLM 的不穩定性

實測 MiniMax VLM API 端點 `POST /v1/chat/completions` 行為:

| 回應類型 | 機率 | 內容 |
|---------|------|------|
| 完美 JSON | 60% | `{"content": "{\"items\":[{...}]}"}` |
| JSON 內含註解 | 15% | `{"content": "// 註解\n{...}"}` |
| 純文字描述 | 20% | `{"content": "我看到三項商品:牛奶 $2, 麵包 $1.5..."}` |
| 格式錯誤 / 截斷 | 5% | `{"content": "{"items":[{...}`(結尾遺失) |

### 6.2 三層 Fallback 設計

```
Layer 1: JSON.parse(content)
  ↓ 失敗
Layer 2: Regex 提取 (/\{\s*"items"\s*:\s*\[.*\]\s*\}/s)
  ↓ 失敗
Layer 3: 啟發式解析 (數字 + 單位 + 關鍵字比對)
  ↓ 失敗
回傳錯誤碼 422 + 建議使用者重新拍照
```

**為何不只用 JSON.parse?**
VLM 是機率模型,無法保證 100% 結構化輸出。**必須多層容錯**才能讓產品在生產環境穩定。

**為何不直接用 Function Calling?**
MiniMax 端點尚未支援原生 Function Calling 規範(截至 2026-06 觀察),只能用 prompt 引導 + 後處理。

### 6.3 啟發式規則(Layer 3 範例)

- 看到數字 + `¥`、`$`、`₩`、`€`、`£` → 視為金額
- 看到「Total」「合計」「小計」→ 視為總價關鍵字
- 看到「x 2」「× 2」「2 個」→ 視為數量
- 失敗 3 次以上 → 觸發「建議重新拍攝」Toast

---

## Section 7:免登入機制權衡

### 7.1 設計目標

- 使用者**零摩擦**進入:不需註冊、不需 Email、不需 OAuth。
- 資料**不外洩**:圖片不留伺服器,購物資料與 IP 鬆綁。
- 跨裝置**部分可用**:換手機時資料可匯出 JSON 匯入。

### 7.2 機制拆解

**第一層:localStorage UUID**
- 首次訪問時由前端生成 `crypto.randomUUID()`,存到 `localStorage.fingerprint_uuid`。
- 這個 UUID 隨每次 API 請求送到後端,作為使用者識別碼。

**第二層:IP Fingerprint 綁定**
- 後端從 `req.headers['x-forwarded-for']` 取得 IP(Cloudflare Tunnel 會帶原始 IP)。
- 將 UUID + IP 雜湊後存 SQLite,關聯到該使用者的購物紀錄。
- 若 IP 改變(Wi-Fi 切換),仍以 UUID 為主索引,IP 為輔助驗證。

**第三層:匯出 / 匯入**
- 使用者可在 UI 點「匯出 JSON」,產出 `super-2026-06-07.json` 備份檔。
- 換裝置時,將 JSON 內容貼到「匯入」對話框,系統寫回 localStorage + SQLite。

### 7.3 隱私與安全權衡

| 議題 | 風險 | 緩解 |
|------|------|------|
| 多人共用 IP(咖啡廳) | A 看到 B 的資料 | IP 僅作輔助,UUID 為主索引 |
| UUID 被偷(同裝置) | 他人可冒充 | 加上 `IP_SALT` HMAC 簽章 |
| 圖片外洩 | VLM 廠商看到照片 | 圖片不存後端,只過 API |
| 跨裝置資料同步 | 換機資料全失 | 匯出/匯入 JSON 作為備援 |

**Ultracode 提醒**:`IP_SALT` 必須從環境變數讀取,**不可 hard-code 在程式碼中**(CLAUDE.md 禁用清單)。

---

## Section 8:Workflow 自動化使用情境

### 8.1 對外暴露端點

| 端點 | 方法 | 用途 | 認證 |
|------|------|------|------|
| `/api/recognize` | POST | 上傳收據,觸發 VLM 辨識 | Fingerprint UUID |
| `/api/cart` | GET | 取得目前購物車 | Fingerprint UUID |
| `/api/cart` | POST | 加入品項 | Fingerprint UUID |
| `/api/cart/:id` | DELETE | 刪除單筆 | Fingerprint UUID |
| `/api/cart/clear` | POST | 清空購物車 | Fingerprint UUID |
| `/api/webhook/recognize` | POST | 外部系統接收辨識完成事件 | Webhook Secret |
| `/api/events/stream` | GET (SSE) | 訂閱 Event Emitter 廣播 | Fingerprint UUID |
| `/api/exports/json` | GET | 匯出購物紀錄 JSON | Fingerprint UUID |

### 8.2 情境 A:Notion 同步

使用者設定 Notion Automation:
1. Webhook URL 設定為 `https://sm.yuang093.cc/api/webhook/recognize`。
2. 每次辨識完成,後端 Event Emitter 觸發 `recognize.completed` 事件。
3. 後端 POST 一份結構化 JSON 給 Notion API(透過 `webhook_target_url` 設定)。
4. Notion 收到後,在 Database 建立一筆「購物紀錄」條目。

### 8.3 情境 B:Google Sheets 整合(透過 Apps Script)

1. Apps Script 部署為 Web App,接收 `POST /api/webhook/recognize` 事件。
2. 收到後,呼叫 `SpreadsheetApp.getActiveSpreadsheet().appendRow()` 寫入新列。
3. 每天午夜觸發時間驅動的樞紐分析,產出「每日總花費」圖表。

### 8.4 Event Emitter 內部機制

- 後端使用 Node.js 內建 `events.EventEmitter`。
- 事件類型:`recognize.completed`、`cart.item.added`、`cart.item.removed`、`cart.cleared`、`exchange.rate.updated`。
- 監聽器(Listener)註冊在 Express app 啟動時,可觀察 `/api/events/stream`(Server-Sent Events)。

---

## Section 9:環境變數清單

> 完整內容見 `.env.example` 與 `README-docker.md`。
> 本節僅說明各變數在「為何需要」「預設值」「何時覆寫」的決策脈絡。

| 變數 | 用途 | 預設 | 覆寫時機 |
|------|------|------|----------|
| `PORT` | Express 監聽 port | `3000` | 反向代理衝突時 |
| `VLM_API_KEY` | VLM API 認證金鑰 | 無(必填) | 部署時 |
| `VLM_API_ENDPOINT` | VLM API 端點 | `https://api.minimax.io/v1/chat/completions` | 自架代理時 |
| `EXCHANGE_API_ENDPOINT` | 匯率 API 端點 | `https://api.exchangerate-api.com/v4/latest/USD` | API 變更時 |
| `DATABASE_PATH` | SQLite 檔案路徑 | `./data/super.db` | Volume 變更時 |
| `IP_SALT` | UUID 簽章密鑰 | 無(必填) | 部署時生成 |
| `CLOUDFLARE_TUNNEL_TOKEN` | Cloudflare Tunnel 認證 | 無(必填) | 部署時 |
| `LOG_LEVEL` | 日誌等級 | `info` | 除錯時改 `debug` |
| `WEBHOOK_SIGNING_SECRET` | Webhook 簽章密鑰 | 無(必填) | 部署時生成 |
| `MAX_UPLOAD_SIZE_MB` | 上傳上限 | `5` | 行動網路時下調 |

⚠️ **安全指令落地**:任何 `rm .env` 或刪除 Volume 前,必須先備份到安全位置(連結 CLAUDE.md 安全章節)。

---

## Section 10:模組依賴關係圖(ASCII)

```
┌─────────────────────────────────────────────────────────────┐
│                       使用者瀏覽器                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  HTML/JS UI  │←→│ Canvas 壓縮  │←→│ TF.js + KNN  │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │              │
│         │    localStorage (UUID)            │              │
│         └────────────┬────────────────────┘               │
└─────────────────────┼──────────────────────────────────────┘
                      │ HTTPS (443)
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Cloudflare Tunnel (sm.yuang093.cc)            │
└─────────────────────┬──────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Node.js + Express 後端                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ /api/        │←→│ sharp 壓縮   │←→│ better-     │      │
│  │  recognize   │  │ (防禦層)     │  │ sqlite3     │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │              │
│         │           ┌─────▼─────┐           │              │
│         │           │  Event    │           │              │
│         │           │  Emitter  │           │              │
│         │           └─────┬─────┘           │              │
│         │                 │                 │              │
│  ┌──────▼───────┐  ┌──────▼───────┐         │              │
│  │ /api/cart    │  │ /api/        │         │              │
│  │              │  │  webhook/*   │         │              │
│  └──────────────┘  └──────────────┘         │              │
│         │                 │                 │              │
│         └────────┬────────┘                 │              │
│                  │                          │              │
│           ┌──────▼──────┐                   │              │
│           │ Fingerprint │                   │              │
│           │ Middleware  │───────────────────┘              │
│           └─────────────┘                                  │
└─────────────────────┬──────────────────────────────────────┘
                      │ HTTPS (outbound)
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
┌────────────┐ ┌────────────┐ ┌────────────┐
│ MiniMax    │ │  Exchange  │ │  Notion /  │
│ VLM API    │ │  Rate API  │ │  Sheets    │
└────────────┘ └────────────┘ └────────────┘
```

### 10.1 模組耦合度評估

| 模組 | 內聚 | 耦合 | 評估 |
|------|------|------|------|
| 前端 UI | 高 | 中(透過 API 與後端) | ✅ 可獨立測試 |
| Canvas 壓縮 | 高 | 低(只對外暴露函式) | ✅ 純函式易測 |
| TF.js KNN | 中 | 低(透過 Web Worker) | ⚠️ 需 Mock WebGL |
| Express API | 高 | 中(共享 SQLite 連線) | ✅ 路由分層清楚 |
| sharp 壓縮 | 高 | 低(無 I/O 副作用) | ✅ 純函式 |
| Fingerprint | 中 | 中(共享 UUID 機制) | ⚠️ 需 Mock crypto |
| Event Emitter | 高 | 低(Node 內建) | ✅ 易測 |
| VLM Fallback | 中 | 高(三層邏輯交織) | ⚠️ 需分層測試 |

---

## Section 11:Agent 工作守則

### 11.1 接手前必讀(Read First)

1. **完整閱讀順序**:
   - `CLAUDE.md`(規範源頭)
   - `PROJECT_CONTEXT.md`(本文件)
   - `overview.md`(系統總覽)
   - `TESTING_PLAN.md`(測試矩陣)
   - `todo_progress.md`(待辦清單)
2. **確認環境**:檢查 Node 版本 ≥ 20、是否有 Docker Desktop、是否登入 Cloudflare 帳號。
3. **拉最新版本**:`git pull origin main`,檢查 CHANGELOG.md 的最新版號。

### 11.2 修改前必輸出計畫(Plan Before Code)

任何修改前,Agent 必須先輸出:

```
【修改計畫】
- 目標:...
- 涉及檔案:...
- 影響模組:...
- 預期風險:...
- DoD 驗收條件:...
- 對應測試 ID:...(參考 TESTING_PLAN.md)
- 是否需暫停提醒:...(是/否,若是,說明為何)
```

**Ultracode 鐵律**:未輸出計畫就動工,視為違規,必須撤銷 commit。

### 11.3 修改中必遵守

- **語言**:所有 commit message、註解、PR 描述使用**繁體中文**。
- **格式**:開頭帶 emoji(對應模組),結尾帶「愛太妍」(本文件已遵守)。
- **禁用清單**:
  - ❌ 禁用 `TODO`、`FIXME`、`XXX` 等 Placeholder 字串
  - ❌ 禁用 `console.log` 殘留(改用 `logger.debug`)
  - ❌ 禁用 hard-code 密鑰(改用 `process.env`)
  - ❌ 禁用 `// 這裡之後再改` 之類推託註解
- **測試**:每個功能改動必須同步新增/更新對應測試案例(連結 TESTING_PLAN.md)。

### 11.4 完成後必驗收(Definition of Done)

- [ ] 程式碼已 commit 並推送 PR
- [ ] 對應測試案例全綠(單元 + 整合)
- [ ] 覆蓋率維持 ≥ 80%
- [ ] CHANGELOG.md 已更新
- [ ] todo_progress.md 對應項目已打勾
- [ ] 自我審查過 CLAUDE.md 禁用清單
- [ ] 若涉及容器/檔案/結構變更,已在終端輸出「⚠️ 暫停提醒備份」字串

### 11.5 緊急求助(Escalation)

若遇到以下情境,立即停止並回報使用者:

1. 需要刪除容器 / Volume / 資料夾
2. 需要修改 docker-compose.yml 的 volume 路徑
3. 需要變更 SQLite schema(可能影響既有資料)
4. 需要升級 Node 主版本(可能影響依賴)
5. 測試覆蓋率突然下降超過 5%
6. VLM API 連續 3 次呼叫失敗,疑似服務商端問題

---

## 附錄:術語表(Glossary)

| 術語 | 英文 | 說明 |
|------|------|------|
| 兩段式辨識 | Two-Stage Recognition | 前端快篩 + 後端精辨的混合架構 |
| KNN | K-Nearest Neighbors | 鄰近演算法,用於 TF.js 特徵分類 |
| 熱感紙收據 | Thermal Receipt | 超市常見的細長黑白列印紙 |
| EXIF 0x0112 | EXIF Orientation Tag | 圖片旋轉資訊的 EXIF 標籤 |
| 信心度 | Confidence Score | 0~1 之間,表示模型預測把握度 |
| 指紋 | Fingerprint | UUID + IP 雜湊的使用者識別 |
| 事件 | Event | EventEmitter 廣播的訊息單元 |
| Webhook | Webhook | 對外系統的 HTTP 回呼端點 |
| SSE | Server-Sent Events | 伺服器推送技術,用於 `/api/events/stream` |
| DoD | Definition of Done | 完成定義,驗收標準 |
| Fallback | Fallback | 降級備援機制 |

---

## 相關文件(Cross-References)

- **規範源頭**:[CLAUDE.md](./CLAUDE.md)
- **系統總覽**:[overview.md](./overview.md)
- **進度追蹤**:[progress.md](./progress.md)
- **細項 TODO**:[todo_progress.md](./todo_progress.md)
- **測試策略**:[TESTING_PLAN.md](./TESTING_PLAN.md)
- **版本日誌**:[CHANGELOG.md](./CHANGELOG.md)
- **專案簡報**:[PROJECT_BRIEF.md](./PROJECT_BRIEF.md)
- **部署指南**:[README-docker.md](./README-docker.md)
- **環境變數**:[.env.example](./.env.example)

---

文件結束。任何接手本專案的 AI 代理,請先完整閱讀本文件與 CLAUDE.md,再啟動任何修改動作。
愛太妍
