# 🧪 測試策略與計畫

> 文件版本：v1.0.0  
> 最後更新：2026-06-07  
> 維護者：Supermarket Tracker 開發團隊  
> 相關文件：[CLAUDE.md](./CLAUDE.md)｜[overview.md](./overview.md)｜[todo_progress.md](./todo_progress.md)｜[PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md)｜[CHANGELOG.md](./CHANGELOG.md)

---

## 目錄

1. [測試理念](#section-1-測試理念)
2. [🚨 測試失敗處理守則](#section-2--測試失敗處理守則)
3. [Round 1 - 單元測試與邊界測試](#section-3-round-1---單元測試與邊界測試)
4. [Round 2 - 整合測試](#section-4-round-2---整合測試)
5. [Round 3 - 系統端對端-e2e-測試](#section-5-round-3---系統端對端-e2e-測試)
6. [測試工具選型](#section-6-測試工具選型)
7. [覆蓋率目標](#section-7-覆蓋率目標)
8. [CI 整合](#section-8-ci-整合)
9. [測試資料管理](#section-9-測試資料管理)

---

## Section 1: 測試理念

### 1.1 為何採用三次循環（Three Rounds）？

本專案採用 **三循環 TDD 測試策略**，並非任意決定，而是基於下列系統性風險評估：

| 循環 | 焦點 | 失敗代價 | 隔離層級 |
|------|------|----------|----------|
| Round 1 | 單元（Unit） | 低，可快速修復 | 函式 / 模組 |
| Round 2 | 整合（Integration） | 中，影響模組協作 | API / 服務邊界 |
| Round 3 | 端對端（E2E） | 高，影響使用者體驗 | 全系統真實場景 |

**設計理念核心：**

1. **由內而外（Inside-Out）**：先驗證最小可測單元（解析器、壓縮器、EXIF 解析）的正確性，再向外擴展至模組協作，最終驗證真實使用者旅程。
2. **失敗成本遞增**：越晚發現的 Bug 修復成本越高。Round 1 在毫秒級回饋，Round 3 需耗費數小時還原現場。
3. **TDD 紅綠重構（Red-Green-Refactor）精神**：每個測試案例先寫預期行為（紅），再實作最小代碼（綠），最後重構優化（重構）。

### 1.2 TDD 三原則

- **原則一：測試先行（Test First）**：禁止先寫程式碼再補測試。
- **原則二：失敗即文件（Failing Test as Spec）**：失敗的測試描述了系統應有但尚未具備的行為。
- **原則三：無重複（No Duplication）**：測試案例不可重疊，透過標籤 `unit` / `integration` / `e2e` 強制分類。

### 1.3 DoD（Definition of Done）驗收標準

依據 [CLAUDE.md](./CLAUDE.md) 之 Ultracode 守則，每個測試循環必須滿足：

- [ ] 所有測試案例可獨立執行（`npm run test:unit` / `npm run test:integration` / `npm run test:e2e`）
- [ ] 覆蓋率達標（行 ≥ 80%、分支 ≥ 70%）
- [ ] 無 `it.skip` / `describe.skip` 殘留（除非明確標註原因與 Issue 編號）
- [ ] CI 自動執行且全綠
- [ ] 測試案例命名遵循 `should_行為_when_條件` 格式

---

## Section 2: 🚨 測試失敗處理守則

### 2.1 鐵律：先輸出【修改計畫】才能改 Code

> ⚠️ **本守則優先級高於一切實作活動**。當任何測試失敗時，AI 代理或工程師**不得**直接修改程式碼，必須先產出【修改計畫】並等待「同意」字串。

### 2.2 【修改計畫】範本

```markdown
## 【修改計畫】TP-YYYYMMDD-NN

### 1. Bug 描述
- 失敗測試案例：`should_parse_json_when_missing_field_returns_default`
- 錯誤訊息：`TypeError: Cannot read property 'items' of undefined`
- 重現路徑：`src/ai/fallback.js:42` → `parseVLMResponse()`

### 2. 根本原因分析
- 表面原因：`response.content` 為 `null` 時直接存取 `.items` 導致崩潰
- 深層原因：缺少 Null Safety 守衛；JSON 解析路徑假設 VLM 必定回傳結構化物件
- 影響範圍：所有 VLM 回應異常情境均會觸發 500 錯誤，購物車無法寫入

### 3. 修改步驟
1. 在 `parseVLMResponse()` 入口加入 `if (!response || !response.content) return defaultResult;`
2. 補上對應單元測試 `should_return_default_when_content_is_null`
3. 確認 Regex 與啟發式 Fallback 仍可運作

### 4. 預期結果
- 新增測試通過
- 原有 4 個 Fallback 測試持續通過
- 覆蓋率：`branches` 從 68% 提升至 72%

### 5. 等待同意
- [ ] 等待「同意」字串後方可動工
```

### 2.3 禁止事項

- ❌ 禁止以 `it.skip` 跳過失敗測試（暫時性除外，須有 Issue 編號）
- ❌ 禁止修改測試案例以「配合」實作（除非確認測試本身有誤）
- ❌ 禁止在未經【修改計畫】流程下直接 `git commit --no-verify`
- ❌ 禁止刪除測試檔案以「讓 CI 變綠」

### 2.4 同意機制

- 由專案 Owner（yuang093）或被授權的 Reviewer 在 PR / Issue 中明確回覆「同意」字串
- 同意後須在 Commit Message 引用 TP 編號：`fix(ai): TP-20260607-01 null guard for parseVLMResponse`

---

## Section 3: Round 1 - 單元測試與邊界測試

### 3.1 AI 容錯解析（AI Fallback Parser）

**目標模組**：`src/ai/fallback.js`  
**測試框架**：Jest  
**覆蓋率要求**：行 100%、分支 95%

#### 案例清單

| 編號 | 測試名稱 | 輸入 | 預期輸出 |
|------|----------|------|----------|
| U-AI-01 | `should_parse_clean_json_when_structure_valid` | `{content: '{"items":[{"name":"Apple","price":1.5}],"currency":"USD"}'}` | `{items:[{name:"Apple",price:1.5}],currency:"USD",source:"json"}` |
| U-AI-02 | `should_fallback_to_regex_when_json_missing_items_field` | `{content: '{"currency":"JPY","total":1500}'}` | 啟發式解析，預設 `items:[]` |
| U-AI-03 | `should_fallback_to_heuristic_when_response_completely_broken` | `{content: 'asdf!@#$%^&*()'}` | 回傳 `defaultResult`，HTTP 200，UI 顯示「辨識失敗，請手動輸入」 |
| U-AI-04 | `should_strip_code_block_when_response_wrapped_in_markdown` | `{content: '```json\n{"items":[]}\n```'}` | 解析成功，source 標記 `"code_block_stripped"` |
| U-AI-05 | `should_handle_chinese_currency_names` | `{content: '{"items":[{"name":"牛奶","price":75}],"currency":"TWD"}'}` | 正確保留中文品名 |
| U-AI-06 | `should_return_default_when_content_is_null` | `{content: null}` | `defaultResult` |
| U-AI-07 | `should_return_default_when_content_is_empty_string` | `{content: ''}` | `defaultResult` |
| U-AI-08 | `should_handle_nested_json_string` | `{content: '{"data":"{\\"items\\":[]}"}'}` | 雙層解析後回傳空 items |
| U-AI-09 | `should_throw_specific_error_when_content_is_undefined` | `{content: undefined}` | 拋出 `VLMEmptyResponseError` |
| U-AI-10 | `should_preserve_negative_price_for_discount_line` | `{content: '{"items":[{"name":"折扣","price":-50}]}'}` | 保留負值（不視為錯誤） |

### 3.2 匯率換算（Exchange Rate）

**目標模組**：`src/services/exchange.js`  
**測試框架**：Jest + Nock（HTTP Mock）

#### 案例清單

| 編號 | 測試名稱 | 情境 | 預期行為 |
|------|----------|------|----------|
| U-EX-01 | `should_fetch_latest_rates_when_api_healthy` | API 回傳 200 + 合法 JSON | 寫入 SQLite 快取，回傳最新匯率 |
| U-EX-02 | `should_use_sqlite_cache_when_api_returns_500` | API 回傳 500 | 讀取最近一筆 SQLite 紀錄，標記 `stale: true` |
| U-EX-03 | `should_return_zero_and_warn_when_rate_is_zero` | API 回傳 `{USD:0}` | 拋出 `InvalidRateError` 並提示「匯率異常」 |
| U-EX-04 | `should_reject_when_converted_amount_is_nan` | 輸入 `amount=NaN, rate=1.5` | 回傳 `null` |
| U-EX-05 | `should_reject_negative_amount` | 輸入 `amount=-100` | 拋出 `NegativeAmountError` |
| U-EX-06 | `should_reject_zero_rate` | 輸入 `rate=0` | 拋出 `InvalidRateError` |
| U-EX-07 | `should_handle_currency_not_in_cache` | 查詢 `XYZ`（不存在的幣別） | 拋出 `UnsupportedCurrencyError` |
| U-EX-08 | `should_round_to_two_decimals` | `100/1.2345` | 回傳 `81.03`（使用 `Math.round(x*100)/100`） |
| U-EX-09 | `should_apply_exponential_backoff_on_429` | 連續 3 次 429 | 第 4 次成功，記錄重試日誌 |
| U-EX-10 | `should_cache_rates_with_ttl_24h` | 24 小時後再次查詢 | 重新呼叫 API |

### 3.3 壓縮演算法（Compression）

**目標模組**：`src/utils/compress.client.js`（前端 Canvas）、`src/utils/compress.server.js`（後端 sharp）

#### 前端案例（Canvas）

| 編號 | 測試名稱 | 情境 | 預期 |
|------|----------|------|------|
| U-CP-01 | `should_reduce_quality_from_0.8_to_0.5_until_under_500kb` | 4MB 原始圖 | 逐步降至 ≤ 500KB，最多 5 輪 |
| U-CP-02 | `should_return_original_when_already_under_500kb` | 200KB 原始圖 | 跳過壓縮，標記 `compressed: false` |
| U-CP-03 | `should_throw_when_image_data_unavailable` | 無效 ImageData | 拋出 `InvalidImageError` |
| U-CP-04 | `should_respect_max_dimension_1200px` | 4000x3000 圖 | 縮放為 1200x900 |
| U-CP-05 | `should_return_base64_string` | 任意輸入 | 回傳 `data:image/jpeg;base64,...` |

#### 後端案例（sharp）

| 編號 | 測試名稱 | 情境 | 預期 |
|------|----------|------|------|
| U-CP-06 | `should_fit_inside_1200px_with_quality_85` | 2400x1800 JPEG | 輸出 ≤ 1200px、JPEG q=85 |
| U-CP-07 | `should_throw_on_corrupt_jpeg` | 損壞的二進位 | 拋出 `SharpError`，HTTP 400 |
| U-CP-08 | `should_preserve_exif_orientation` | 含 0x0112=6 的圖 | 自動套用旋轉後再壓縮 |
| U-CP-09 | `should_handle_png_input` | 1000x1000 PNG | 轉為 JPEG，背景填白 |
| U-CP-10 | `should_reject_file_over_10mb` | 12MB 上傳 | 回傳 413 Payload Too Large |

### 3.4 EXIF 0x0112 解析

**目標模組**：`src/utils/exif.js`  
**測試資料**：`tests/fixtures/exif/`（涵蓋 iPhone、Samsung、Google Pixel、Canon、Nikon）

| 編號 | 測試名稱 | 來源 | 預期方向 |
|------|----------|------|----------|
| U-EXIF-01 | `should_parse_orientation_1_for_iphone_14_pro` | iPhone 14 Pro 直拍 | 1（正常） |
| U-EXIF-02 | `should_parse_orientation_6_for_iphone_se_2020` | iPhone SE 2 直拍 | 6（需順時針 90°） |
| U-EXIF-03 | `should_parse_orientation_3_for_samsung_s23` | Samsung S23 倒置 | 3（需 180°） |
| U-EXIF-04 | `should_parse_orientation_8_for_pixel_7` | Pixel 7 橫拍 | 8（需逆時針 90°） |
| U-EXIF-05 | `should_default_to_1_when_tag_missing` | 截圖（無 EXIF） | 1 |
| U-EXIF-06 | `should_handle_unsupported_orientation_value` | 手動修改 EXIF 為 9 | 預設 1，記錄 warn |
| U-EXIF-07 | `should_parse_canon_eos_r5_orientation` | Canon EOS R5 | 正確解析 |
| U-EXIF-08 | `should_parse_nikon_z9_orientation` | Nikon Z9 | 正確解析 |
| U-EXIF-09 | `should_throw_on_truncated_exif` | 截斷的 EXIF 區段 | 拋出 `EXIFParseError` |
| U-EXIF-10 | `should_be_pure_function_no_side_effects` | 相同輸入兩次 | 回傳完全相同結果（值相等） |

---

### 3.5 IP Fingerprint 雜湊（Fingerprint Hashing）

**目標模組**：`src/utils/fingerprint.js`  
**測試資料**：mock IP 位址（IPv4 / IPv6 / 混合）、mock `IP_SALT` 環境變數  
**覆蓋面向**：雜湊函式正確性、輸入正規化、錯誤處理、純函式性質

| 編號 | 測試名稱 | 輸入 | 預期結果 |
|------|----------|------|----------|
| U-FP-01 | `should_return_same_fingerprint_for_same_ip` | 同 IP 呼叫兩次 | 兩個 fingerprint 完全相等 |
| U-FP-02 | `should_return_different_fingerprints_for_different_ips` | IP_A vs IP_B | 兩個 fingerprint 不相等 |
| U-FP-03 | `should_throw_when_ip_salt_env_is_missing` | 未設 `IP_SALT` | 拋出 `MissingSaltError`，訊息含「IP_SALT」字串 |
| U-FP-04 | `should_handle_ipv6_address_correctly` | `2001:db8::1` | 正確產生 64 字元 hex |
| U-FP-05 | `should_normalize_ipv4_mapped_ipv6` | `::ffff:192.0.2.1` | 與 `192.0.2.1` 產生相同 fingerprint |
| U-FP-06 | `should_include_user_agent_in_hash_when_provided` | IP + UA vs IP only | 兩者 fingerprint 不相等 |
| U-FP-07 | `should_throw_on_malformed_ip_string` | `not_an_ip` | 拋出 `InvalidIPError` |
| U-FP-08 | `should_strip_port_from_x_forwarded_for` | `1.2.3.4:5678` | 與 `1.2.3.4` 產生相同 fingerprint |
| U-FP-09 | `should_produce_64_char_hex_via_sha256` | 任意有效 IP | 長度 64、僅含 `[0-9a-f]` |
| U-FP-10 | `should_be_pure_function_no_side_effects` | 重複呼叫 1000 次 | 結果穩定、無 IO 操作 |

> 對應 todo：[todo_progress.md T-U-05](./todo_progress.md)「Fingerprint 雜湊單元測試」。

---

## Section 4: Round 2 - 整合測試

### 4.1 前後端辨識流水線

**目標模組**：`POST /api/recognize`（Express + Supertest）  
**測試框架**：Supertest + Jest + Nock（Mock VLM API）

#### 案例清單

| 編號 | 測試名稱 | 流程 | 預期 |
|------|----------|------|------|
| I-EP-01 | `should_full_pipeline_when_valid_image_uploaded` | base64 → 伺服器解碼 → sharp 壓縮 → VLM Mock → 解析 → SQLite 寫入 | HTTP 200，回傳 items 陣列，DB 有 1 筆紀錄 |
| I-EP-02 | `should_skip_sharp_when_already_compressed_by_frontend` | 前端已標記 `preCompressed: true` | 後端直接呼叫 VLM，記錄 `compressedStage: "frontend"` |
| I-EP-03 | `should_record_both_stages_when_full_compression` | 前端 0.8、後端 0.85 | 記錄 `compressedStage: "both"` |
| I-EP-04 | `should_persist_to_sqlite_with_fingerprint_binding` | 帶 `X-Fingerprint` header | DB 內 `fingerprint` 欄位正確寫入 |
| I-EP-05 | `should_reject_request_without_fingerprint` | 缺少 header | HTTP 400 `FINGERPRINT_REQUIRED` |
| I-EP-06 | `should_return_429_when_rate_limit_exceeded` | 同一 IP 60 秒內 30 次 | 第 31 次回傳 429 |
| I-EP-07 | `should_retry_vlm_on_500_with_backoff` | Mock 前 2 次 500 | 第 3 次成功，記錄重試次數 |
| I-EP-08 | `should_fail_gracefully_when_vlm_unavailable` | Mock 連續 5 次失敗 | 回傳 `defaultResult`，HTTP 200 |

### 4.2 Workflow Webhook 觸發驗證

**目標模組**：`src/workflow/webhook.js` + Event Emitter

| 編號 | 測試名稱 | 情境 | 預期 |
|------|----------|------|------|
| I-WH-01 | `should_emit_recognize_event_after_successful_recognition` | 辨識完成 | EventEmitter 觸發 `recognize:success` |
| I-WH-02 | `should_register_webhook_listener_via_restful_api` | POST `/api/webhooks` | DB 註冊成功，回傳 webhook id |
| I-WH-03 | `should_invoke_webhook_with_signed_payload` | 觸發購物車新增 | POST 至目標 URL，Header 含 `X-Signature: sha256=...` |
| I-WH-04 | `should_retry_webhook_on_5xx_response` | 目標伺服器 503 | 3 次重試後標記 `failed` |
| I-WH-05 | `should_not_block_main_response_when_webhook_fails` | Webhook 拋錯 | 主流程仍回傳 200，錯誤寫入 `webhook_dead_letter` |
| I-WH-06 | `should_broadcast_to_multiple_subscribers` | 註冊 3 個 webhook | 全部觸發，順序不保證 |
| I-WH-07 | `should_validate_webhook_url_against_ssrf_blacklist` | URL = `http://169.254.169.254/` | 拒絕註冊，回傳 `SSRF_BLOCKED` |
| I-WH-08 | `should_purge_expired_webhooks_after_30_days` | 注入 31 天前資料 | 排程清除，記錄筆數 |

### 4.3 購物車同步與 IP Fingerprint 綁定

**目標模組**：`src/routes/cart.js`

| 編號 | 測試名稱 | 情境 | 預期 |
|------|----------|------|------|
| I-CT-01 | `should_create_cart_for_new_fingerprint` | 新 Fingerprint | 自動建立空購物車 |
| I-CT-02 | `should_merge_items_when_same_fingerprint` | 同 Fingerprint 多次新增 | items 累加，正確計算總價 |
| I-CT-03 | `should_not_leak_cart_across_fingerprints` | Fingerprint A vs B | A 看見自己的 items，B 看見自己的 |
| I-CT-04 | `should_delete_single_item` | DELETE `/api/cart/items/:id` | 該 item 消失，總價更新 |
| I-CT-05 | `should_clear_all_items` | DELETE `/api/cart` | items 為空，購物車保留 |
| I-CT-06 | `should_compute_twd_total_with_latest_rate` | USD 100, rate=31.5 | TWD = 3150 |
| I-CT-07 | `should_emit_cart_updated_event` | 任一 mutation | EventEmitter 廣播 `cart:updated` |
| I-CT-08 | `should_handle_concurrent_adds_via_sqlite_lock` | 同時 5 個 POST | 全部成功，無丟失 |

---

### 4.4 Event Emitter 廣播驗證（Event Bus Broadcasting）

**目標模組**：`src/services/eventBus.js`（EventEmitter 實例）+ 各業務模組事件發射器  
**測試資料**：mock 商品新增、mock 預算警戒線、mock Webhook subscriber  
**覆蓋面向**：事件觸發、訂閱、payload 結構、錯誤傳遞

| 編號 | 測試名稱 | 觸發條件 | 預期結果 |
|------|----------|----------|----------|
| I-EE-01 | `should_emit_item_added_on_successful_create` | POST `/api/items` 成功 | 訂閱者收到 `item:added` 事件，payload 含 `id` / `name` / `price` / `currency` |
| I-EE-02 | `should_emit_cart_over_budget_when_total_exceeds_threshold` | 購物車總額 > 預算 × 1.0 | 訂閱者收到 `cart:over_budget` 事件，payload 含 `total` / `currency` / `budget` |
| I-EE-03 | `should_deliver_event_to_all_subscribers_without_loss` | 單一事件 × 10 個訂閱者 | 全部 10 個訂閱者皆收到，順序依註冊順序 |
| I-EE-04 | `should_validate_event_payload_against_schema` | 任意事件觸發 | payload 通過 `eventSchemas/*.schema.json` AJV 驗證，否則拋出 `SchemaValidationError` |
| I-EE-05 | `should_not_block_emitter_when_subscriber_throws` | 訂閱者 A 拋例外 | 訂閱者 B 仍收到事件，例外被記錄至 `error.log` |
| I-EE-06 | `should_unsubscribe_correctly_via_off_method` | 訂閱後 `off(event, handler)` | 後續事件不再送達該 handler |

> 對應 todo：[todo_progress.md T-I-03](./todo_progress.md)「Event Emitter 整合測試」。

---

## Section 5: Round 3 - 系統端對端 (E2E) 測試

### 5.1 斷網情境

**工具**：Playwright + `context.setOffline(true)`

| 編號 | 測試名稱 | 流程 | 預期 |
|------|----------|------|------|
| E-NET-01 | `should_show_offline_banner_when_network_dropped` | 拍照過程中斷網 | UI 顯示「網路離線」橫幅 |
| E-NET-02 | `should_queue_recognition_when_offline` | 斷網下點擊辨識 | 請求排入 IndexedDB，回覆「稍後重試」 |
| E-NET-03 | `should_auto_retry_queue_when_online_restored` | 恢復連線 | 自動發送排隊請求，UI 顯示進度 |
| E-NET-04 | `should_use_cached_rates_when_offline` | 斷網查匯率 | 使用 SQLite 最後一筆，標記「資料可能過時」 |

### 5.2 匯率 API 故障

| 編號 | 測試名稱 | 情境 | 預期 |
|------|----------|------|------|
| E-EX-01 | `should_show_fallback_rates_with_warning` | 匯率 API 500 | 使用快取匯率，UI 顯示「⚠️ 匯率過時」 |
| E-EX-02 | `should_continue_to_function_with_zero_rates` | API 回傳全 0 | 阻止結帳，提示「請手動輸入匯率」 |
| E-EX-03 | `should_log_incident_when_api_down_over_5min` | 模擬 5 分鐘故障 | 寫入 `incidents` 表，標記 `severity: high` |
| E-EX-04 | `should_recover_gracefully_when_api_returns` | 故障後恢復 | 自動切回線上匯率，無需使用者動作 |

### 5.3 圖片格式錯誤

| 編號 | 測試名稱 | 輸入 | 預期 |
|------|----------|------|------|
| E-IMG-01 | `should_handle_png_upload` | 1920x1080 PNG | 自動轉 JPEG，辨識成功 |
| E-IMG-02 | `should_handle_webp_upload` | 800x600 WebP | 自動轉 JPEG，辨識成功 |
| E-IMG-03 | `should_reject_gif_upload` | 動圖 GIF | 提示「不支援 GIF，請轉成 JPEG/PNG」 |
| E-IMG-04 | `should_reject_corrupt_file` | 隨機二進位 | HTTP 400，UI 顯示「檔案損毀」 |
| E-IMG-05 | `should_handle_heic_from_iphone` | iPhone HEIC | 自動轉檔，保留 EXIF 方向 |
| E-IMG-06 | `should_reject_zero_byte_file` | 0 bytes | HTTP 400 |
| E-IMG-07 | `should_handle_screenshot_png` | 手機截圖 | 無 EXIF，預設方向 1 |

### 5.4 大量併發

**工具**：k6 / autocannon

| 編號 | 測試名稱 | 情境 | 預期 |
|------|----------|------|------|
| E-CC-01 | `should_handle_100_concurrent_uploads` | 100 個 base64 圖片同時上傳 | P95 < 3s，零丟失 |
| E-CC-02 | `should_throttle_to_30_rpm_per_ip` | 60 rpm 觸發 | 第 31 個回傳 429 |
| E-CC-03 | `should_preserve_sqlite_integrity_under_load` | 100 寫入同時 | 無 `SQLITE_BUSY` 錯誤，WAL 模式生效 |
| E-CC-04 | `should_degrade_gracefully_under_extreme_load` | 500 併發 | 503 + Retry-After header |
| E-CC-05 | `should_not_exhaust_memory_during_burst` | 觀察 heap | 記憶體穩定 < 512MB |

### 5.5 SIGTERM 中斷處理

| 編號 | 測試名稱 | 流程 | 預期 |
|------|----------|------|------|
| E-SIG-01 | `should_complete_in_flight_requests_before_exit` | 發送 SIGTERM 時尚有 3 個請求 | 完成後再退出，最多 30s |
| E-SIG-02 | `should_flush_webhook_queue_on_shutdown` | Queue 有 5 個 webhook | 全部發送或寫入 dead letter |
| E-SIG-03 | `should_close_sqlite_safely` | SIGTERM | WAL checkpoint 執行，無資料損毀 |
| E-SIG-04 | `should_remove_unfinished_temporary_files` | 過程中有 .tmp 檔 | 啟動時或退出時清理 |
| E-SIG-05 | `should_log_shutdown_timeline` | 全流程 | 記錄 start → drain → close → exit 各階段時間 |

---

### 5.6 Cloudflare Tunnel 可達性（Tunnel Reachability）

**目標**：驗證對外 HTTPS 服務 `https://sm.yuang093.cc` 端到端可達性  
**測試環境**：CI 環境（GitHub Actions）使用 `cloudflared` 臨時 Tunnel 模擬  
**覆蓋面向**：Tunnel 連線、Token 失效、服務降級

| 編號 | 測試名稱 | 觸發條件 | 預期結果 |
|------|----------|----------|----------|
| E-TUN-01 | `should_reach_public_https_endpoint` | 啟動 cloudflared + app，curl `https://sm.yuang093.cc/healthz` | HTTP 200，response time < 2s |
| E-TUN-02 | `should_reconnect_within_30s_after_tunnel_restart` | `docker compose restart cloudflared` | 30 秒內重新建立 Tunnel，`/healthz` 再次 200 |
| E-TUN-03 | `should_degrade_gracefully_when_tunnel_token_invalid` | 設定錯誤的 `CLOUDFLARE_TUNNEL_TOKEN` | 容器仍啟動但 `cloudflared` 進入 retry loop，本地 `http://localhost:3000/healthz` 仍可達 |

> 對應 todo：[todo_progress.md T-E-04](./todo_progress.md)「Cloudflare Tunnel E2E 可達性測試」。  
> 注意：E-TUN-01 需實際對外網域，CI 環境請使用 `cloudflared tunnel --url http://localhost:3000` 產生臨時 URL 替代。

---

## Section 6: 測試工具選型

| 層級 | 工具 | 用途 | 備註 |
|------|------|------|------|
| 單元 | **Jest 29+** | 函式 / 模組測試 | 內建 mock、snapshot、coverage |
| 單元（前端） | **Vitest** | 瀏覽器端單元測試 | Vite 原生支援，與 TF.js 整合佳 |
| 整合 | **Supertest** | HTTP API 測試 | Express 鏈接測試 |
| Mock HTTP | **Nock** | 攔截外部 HTTP | VLM、匯率 API |
| E2E | **Playwright** | 真實瀏覽器流程 | 跨瀏覽器、視覺回歸 |
| 壓力 | **k6** / **autocannon** | 併發 / 負載 | 100+ 併發模擬 |
| Mock 視覺 | **TF.js Mock Layer** | 模擬 KNN 結果 | 注入 `confidence: 0.95` |
| Coverage | **Istanbul / c8** | 覆蓋率報告 | HTML + LCOV |
| Lint | **ESLint + typescript-eslint** | 程式碼品質 | CI 強制 |

### 6.1 為何不用 Mocha / Chai？

- Jest 提供完整生態（斷言、mock、coverage 一體化），降低配置成本
- Vitest 對 Vite / ESM 原生支援，TF.js import 不需 babel 額外設定

### 6.2 為何 Playwright 而非 Cypress？

- Playwright 支援多瀏覽器（Chromium、Firefox、WebKit），更接近真實環境
- 原生支援 `context.setOffline()`、`context.setExtraHTTPHeaders()`，符合 E2E 斷網測試需求

---

## Section 7: 覆蓋率目標

### 7.1 量化門檻

| 指標 | 目標 | 強制層級 |
|------|------|----------|
| 行覆蓋率（Lines） | **≥ 80%** | 強制（CI 卡門檻） |
| 分支覆蓋率（Branches） | **≥ 70%** | 強制 |
| 函式覆蓋率（Functions） | **≥ 85%** | 建議 |
| 敘述覆蓋率（Statements） | **≥ 80%** | 強制 |

### 7.2 例外與排除

允許透過 `/* c8 ignore next */` 或 `/* istanbul ignore next */` 排除：

- 第三方 SDK 內部呼叫
- 已知無法測試的環境判斷（如 `process.platform === 'win32'`）
- 必須有對應註解說明原因

### 7.3 覆蓋率儀表板

- 透過 `nyc report --reporter=text-lcov` 產生 LCOV
- 上傳至 Codecov 或 SonarCloud
- README.md 嵌入覆蓋率徽章

### 7.4 覆蓋率下降處理

- PR 導致覆蓋率下降 > 2%：CI 紅燈，必須補測試或重構
- 連續 3 個 PR 覆蓋率未提升：標記技術債，於 Sprint Review 討論

---

## Section 8: CI 整合

### 8.1 建議使用 GitHub Actions

**檔案位置**：`.github/workflows/test.yml`

```yaml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:unit -- --coverage
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  integration:
    runs-on: ubuntu-latest
    services:
      sqlite:
        image: nouchka/sqlite3:latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:integration
    env:
      VLM_API_KEY: ${{ secrets.VLM_API_KEY }}

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

### 8.2 CI 觸發時機

- PR 建立 / 更新：執行 Round 1 + Round 2
- Push 至 `main`：執行全部三循環
- Nightly 排程（每日 02:00）：執行 Round 3 完整版（含壓力測試）
- 標籤 `release/v*`：執行全部 + 部署至 staging

### 8.3 測試報告

- PR Comment 自動貼上覆蓋率 diff
- Slack 通知：CI 紅燈時標記 Owner
- 失敗時自動上傳：
  - Playwright 截圖 / 錄影
  - 伺服器 log
  - SQLite 快照（脫敏後）

### 8.4 矩陣策略

- Node 版本：`18.x` / `20.x` / `22.x`
- OS：`ubuntu-latest` / `windows-latest` / `macos-latest`
- 覆蓋率取三者平均

---

## Section 9: 測試資料管理

### 9.1 Fixtures 結構

```
tests/
├── fixtures/
│   ├── exif/
│   │   ├── iphone-14-pro-orientation-1.jpg
│   │   ├── iphone-se-orientation-6.jpg
│   │   ├── samsung-s23-orientation-3.jpg
│   │   ├── pixel-7-orientation-8.jpg
│   │   ├── canon-eos-r5.heic
│   │   ├── nikon-z9.jpg
│   │   ├── screenshot-no-exif.png
│   │   └── corrupt-exif.jpg
│   ├── vlm-responses/
│   │   ├── clean.json
│   │   ├── missing-items.json
│   │   ├── markdown-wrapped.txt
│   │   ├── broken.txt
│   │   ├── null-content.json
│   │   └── chinese-items.json
│   ├── exchange/
│   │   ├── healthy-response.json
│   │   ├── zero-rates.json
│   │   ├── 500-error.json
│   │   └── unsupported-currency.json
│   └── images/
│       ├── 4mb-original.jpg
│       ├── 200kb-already-small.jpg
│       ├── corrupt.bin
│       ├── zero-byte.jpg
│       └── screenshot.png
├── mocks/
│   ├── minimax-vlm.js
│   ├── exchange-api.js
│   └── sharp.js
└── helpers/
    ├── db-setup.js
    ├── fingerprint-factory.js
    └── event-capture.js
```

### 9.2 Mock 策略

#### 9.2.1 VLM API Mock

- 使用 Nock 攔截 `https://api.minimax.io/v1/chat/completions`（與 `.env.example` 之 `VLM_API_ENDPOINT` 單一事實來源一致）
- 提供 `mockHealthy()` / `mockFailure(n)` / `mockSlow(ms)` 三種預設
- 測試可覆寫 response 內容

#### 9.2.2 匯率 API Mock

- 同上，攔截 `https://api.exchangerate-api.com/v4/latest/USD`
- 支援注入「部分失敗」場景（部分幣別缺值）

#### 9.2.3 sharp Mock

- 在 CI 環境不實際安裝原生模組時，Mock `sharp()` 鏈
- 回傳固定 buffer，驗證呼叫鏈順序

#### 9.2.4 TF.js MobileNet Mock

- 前端測試時 Mock `@tensorflow-models-mobilenet` 與 `knn-classifier`
- 注入 `predict()` 結果，控制信心度 0.0~1.0 邊界

### 9.3 敏感資料處理

- 絕不提交真實收據照片（含個資）
- 測試圖片全部為：
  - 開源圖庫（Unsplash、Pexels）合成
  - 程式生成的合成圖（Canvas / sharp 程式化）
  - 已取得同意的測試帳號收據（去識別化）
- `.gitignore` 排除任何 `tests/fixtures/private/`

### 9.4 測試資料生命週期

| 階段 | 動作 |
|------|------|
| 建立 | 由 Fixture Factory 程式化生成 |
| 儲存 | 進入 `tests/fixtures/`，提交至 Git |
| 使用 | 透過 `path.join(__dirname, '../fixtures/...')` 載入 |
| 清理 | 測試結束後刪除任何 `.tmp` 或衍生檔 |
| 更新 | 重大變更時同步更新 CHANGELOG.md |

### 9.5 測試隔離

- 每個測試檔案使用獨立 SQLite 檔案（`:memory:` 或 temp file）
- Jest `globalSetup` / `globalTeardown` 統一管理
- 不可跨測試共享全域狀態
- EventEmitter 在 `beforeEach` 重置

---

## 附錄 A: 測試案例編號規則

- `U-` 前綴：Unit（單元）
- `I-` 前綴：Integration（整合）
- `E-` 前綴：End-to-End（端對端）
- 第二段：模組代碼（`AI` / `EX` / `CP` / `EXIF` / `EP` / `WH` / `CT` / `NET` / `IMG` / `CC` / `SIG`）
- 編號：兩位數流水號

## 附錄 B: 與其他文件的關聯

- [CLAUDE.md](./CLAUDE.md)：本文件的規範源頭，DoD 與 Ultracode 守則
- [overview.md](./overview.md)：模組圖與資料流，作為測試分層的依據
- [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md)：術語表（EXIF、KNN、MiniMax）對齊測試命名
- [todo_progress.md](./todo_progress.md)：每個測試案例 ID 對應一個工作項
- [CHANGELOG.md](./CHANGELOG.md)：測試策略變更記錄於此

## 附錄 C: 變更紀錄

| 版本 | 日期 | 變更內容 | 作者 |
|------|------|----------|------|
| 1.0.0 | 2026-06-07 | 初版建立，三循環測試策略完整定義 | Supermarket Tracker 團隊 |

---

愛太妍
