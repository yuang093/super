# 🐳 Docker 部署指南

> Supermarket Tracker 的完整 Docker / Docker Compose / Cloudflare Tunnel 部署手冊  
> 適用版本：v0.1.0+ ｜ 維護者：yuang093 ｜ 最後更新：2026-06-07

---

## 目錄

1. [為何採用 Docker](#1-為何採用-docker)
2. [先決條件](#2-先決條件)
3. [環境變數設定](#3-環境變數設定)
4. [本地開發流程](#4-本地開發流程)
5. [生產環境部署](#5-生產環境部署)
6. [🚨 部署前必讀：資料備份檢查清單](#6-部署前必讀資料備份檢查清單)
7. [Cloudflare Tunnel 設定](#7-cloudflare-tunnel-設定)
8. [常用指令速查](#8-常用指令速查)
9. [資料持久化策略](#9-資料持久化策略)
10. [升級與回滾流程](#10-升級與回滾流程)
11. [故障排除 FAQ](#11-故障排除-faq)
12. [與 README.md 的分工說明](#12-與-readmemd-的分工說明)

---

## 1. 為何採用 Docker

Supermarket Tracker 採用 Docker 容器化部署，核心價值如下：

- **環境一致性**：Node.js 20+、sharp 原生模組、better-sqlite3 編譯版本在開發機、測試機、生產機完全一致，杜絕「在我電腦上可以跑」的窘境。
- **可移植性**：一次建置映像檔，可同時部署到本機 Docker Desktop、Ubuntu VPS、AWS Lightsail、GCP Cloud Run。
- **Grayscale（金絲雀）部署**：透過 docker-compose 的多服務定義，支援 `app-canary` 與 `app-stable` 並存，依流量比例切換。
- **快速回滾**：映像檔以 Git SHA 標記（`super:0.1.0-a1b2c3d`），搭配 `docker compose up -d` 即可在 30 秒內回到前一版本。
- **零入侵部署**：無需在主機安裝 Node、npm、build-essential，整潔乾淨。

> 引用：[overview.md](./overview.md) 技術棧矩陣、[CLAUDE.md](./CLAUDE.md) §1 Ultracode 模式定義。

---

## 2. 先決條件

請先確認以下環境已就緒：

| 項目 | 最低版本 | 建議版本 | 驗證指令 |
|------|---------|---------|---------|
| Docker Engine | 20.10+ | 24.0+ | `docker --version` |
| Docker Compose | v2.0+ | v2.20+ | `docker compose version` |
| 磁碟空間 | 5 GB | 10 GB | `df -h /var/lib/docker` |
| 記憶體 | 1 GB | 2 GB | `free -h` |
| 作業系統 | Ubuntu 22.04 / macOS 12+ / Windows 11 + WSL2 | Ubuntu 24.04 LTS | `uname -a` |

### Linux 安裝範例（Ubuntu 24.04）

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo usermod -aG docker $USER
newgrp docker
docker run hello-world
```

---

## 3. 環境變數設定

> ⚠️ **單一事實來源**：所有環境變數的權威命名清單位於 [.env.example](./.env.example)。本文件僅列出**部署相關**的子集與注意事項。

### 3.1 複製範本檔

```bash
cp .env.example .env
```

### 3.2 部署必填變數

| 變數名稱 | 用途 | 取得方式 |
|---------|------|---------|
| `VLM_API_KEY` | MiniMax VLM 認證 | <https://platform.minimax.io> 註冊取得 |
| `CLOUDFLARE_TUNNEL_TOKEN` | Cloudflare Tunnel 認證 | Cloudflare Zero Trust 控制台建立 |
| `IP_SALT` | IP Fingerprint 雜湊鹽 | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `WEBHOOK_SIGNING_SECRET` | Webhook HMAC 簽章密鑰 | 同上指令產生 32 byte hex |
| `TUNNEL_HOSTNAME` | 對外網域 | 已預設為 `sm.yuang093.cc` |

> 完整變數清單與說明請參閱 [.env.example](./.env.example)。

### 3.3 安全提醒

- `.env` 已在 `.gitignore` 內，但仍須於 `git status` 確認未被追蹤
- 任何環境變數命名變更，必須同步更新所有引用文件（CLAUDE.md、PROJECT_CONTEXT.md、docker-compose.yml）
- 詳閱 [CLAUDE.md §2 安全指令](./CLAUDE.md#2--絕對安全指令三鐵律)

---

## 4. 本地開發流程

### 4.1 一鍵啟動

```bash
docker compose up --build
```

此指令會：

1. 讀取 `docker-compose.yml` 的 `app` 與 `cloudflared` 服務定義
2. 依 `Dockerfile` 建置 `super:dev` 映像檔（含 sharp 原生模組）
3. 啟動容器並掛載本地原始碼 Volume（Hot Reload）
4. 輸出 `app listening on http://localhost:3000`

### 4.2 背景執行

```bash
docker compose up -d --build
docker compose logs -f app
```

### 4.3 進入容器除錯

```bash
docker compose exec app sh
# 容器內可執行：
#   node -v
#   ls /data
#   sqlite3 /data/super.db ".tables"
```

---

## 5. 生產環境部署到 VPS

### 5.1 連線至 VPS

```bash
ssh deploy@your-vps-ip
```

### 5.2 拉取最新程式碼

```bash
sudo mkdir -p /opt/super && sudo chown -R $USER:$USER /opt/super
cd /opt/super
git clone https://github.com/yuang093/super.git .
git checkout v0.1.0
```

### 5.3 設定環境變數

```bash
cp .env.example .env
nano .env
chmod 600 .env
```

### 5.4 啟動服務

```bash
docker compose pull
docker compose up -d
docker compose ps
```

### 5.5 驗證部署

```bash
curl -I http://localhost:3000/healthz
# 預期：HTTP/1.1 200 OK
```

對外網域 `https://sm.yuang093.cc` 由 Cloudflare Tunnel 自動代理，無需另行設定 Nginx。

---

## 6. 🚨 部署前必讀：資料備份檢查清單

> ⚠️ **安全指令三鐵律**（[CLAUDE.md §2](./CLAUDE.md#2--絕對安全指令三鐵律)）：刪除容器、移除 Volume、變更資料夾結構前**必須**完成以下備份，並於終端輸出確認字串 `BACKUP-VERIFIED`。

### 6.1 備份執行清單

執行部署或維運指令前，請逐項打勾：

- [ ] **SQLite 資料庫**：`docker compose exec app sh -c 'sqlite3 /data/super.db ".backup /data/super.db.bak"'`
- [ ] **使用者上傳圖片**：`tar -czf uploads-$(date +%F).tar.gz /data/uploads`
- [ ] **日誌檔**：`tar -czf logs-$(date +%F).tar.gz /data/logs`
- [ ] **環境變數**：`cp .env .env.bak-$(date +%F)`
- [ ] **確認映像檔版本**：`docker images | grep super`
- [ ] **確認 Volume 存在**：`docker volume ls | grep super`

### 6.2 確認字串輸出

完成後於終端機輸入：

```bash
echo "BACKUP-VERIFIED $(date -Iseconds)"
```

> 任何 `docker compose down -v`、`docker rm -v`、`rm -rf /opt/super` 指令執行前，**必須**先看到上方的 `BACKUP-VERIFIED` 輸出，否則拒絕執行。

---

## 7. Cloudflare Tunnel 設定

### 7.1 建立 Tunnel

於 Cloudflare Zero Trust 控制台：

1. 進入 **Networks → Tunnels → Create a tunnel**
2. 命名為 `super-prod`，類型選 **Cloudflared**
3. 複製產生的 Token，貼至 `.env` 的 `CLOUDFLARE_TUNNEL_TOKEN`
4. 新增 Public Hostname：
   - Subdomain: `sm`
   - Domain: `yuang093.cc`
   - Service Type: `HTTP`
   - URL: `app:3000`

### 7.2 啟動 Tunnel

```bash
docker compose up -d cloudflared
docker compose logs -f cloudflared
# 看到「Connection established」表示連線成功
```

### 7.3 驗證對外服務

```bash
curl -I https://sm.yuang093.cc/healthz
# 預期：HTTP/2 200，server: cloudflare
```

### 7.4 Tunnel 重新認證

當 Token 過期時，於 Cloudflare 控制台旋轉 Token，更新 `.env` 後：

```bash
docker compose restart cloudflared
```

---

## 8. 常用指令速查

| 用途 | 指令 |
|------|------|
| 啟動（前景） | `docker compose up --build` |
| 啟動（背景） | `docker compose up -d --build` |
| 停止（保留 Volume） | `docker compose stop` |
| 停止並移除容器 | `docker compose down` |
| 停止並刪除 Volume | `docker compose down -v` ⚠️ 需先備份 |
| 查看服務狀態 | `docker compose ps` |
| 即時日誌（全部） | `docker compose logs -f` |
| 單一服務日誌 | `docker compose logs -f app` |
| 進入容器 | `docker compose exec app sh` |
| 重啟單一服務 | `docker compose restart app` |
| 重建映像檔 | `docker compose build --no-cache app` |
| 清理孤兒映像 | `docker image prune -f` |
| 清理孤兒 Volume | `docker volume prune` ⚠️ 需先備份 |
| 查詢資源用量 | `docker stats` |
| 匯出資料庫 | `docker compose exec app sqlite3 /data/super.db ".dump" > super-$(date +%F).sql` |

---

## 9. 資料持久化策略

### 9.1 Volume 清單

於 `docker-compose.yml` 定義以下命名 Volume：

| Volume 名稱 | 掛載點 | 用途 | 備份頻率 |
|------------|-------|------|---------|
| `super_sqlite` | `/data/super.db` | SQLite 主資料庫 | 每日 |
| `super_uploads` | `/data/uploads` | 使用者上傳的收據圖片 | 每週 |
| `super_logs` | `/data/logs` | 應用日誌（含 access.log、error.log） | 每月 |

### 9.2 驗證 Volume 綁定

```bash
docker volume inspect super_sqlite
# 輸出應包含 "Mountpoint": "/var/lib/docker/volumes/super_sqlite/_data"
```

### 9.3 手動備份腳本範例

```bash
#!/usr/bin/env bash
# scripts/backup.sh
set -euo pipefail
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR=/opt/super/backups
mkdir -p "$BACKUP_DIR"

# 備份 SQLite
docker compose exec -T app sqlite3 /data/super.db ".backup /data/super.db.bak"
docker cp $(docker compose ps -q app):/data/super.db.bak "$BACKUP_DIR/super-$STAMP.db"

# 備份上傳圖片
docker compose exec -T app tar -czf /tmp/uploads.tar.gz -C /data uploads
docker cp $(docker compose ps -q app):/tmp/uploads.tar.gz "$BACKUP_DIR/uploads-$STAMP.tar.gz"

echo "BACKUP-VERIFIED $(date -Iseconds) → $BACKUP_DIR"
```

建議加入 crontab：

```bash
0 3 * * * /opt/super/scripts/backup.sh >> /var/log/super-backup.log 2>&1
```

---

## 10. 升級與回滾流程

### 10.1 標準升級流程

```bash
cd /opt/super
git fetch --tags
git checkout v0.2.0
docker compose pull
docker compose up -d --build
docker compose ps
curl -I https://sm.yuang093.cc/healthz
```

### 10.2 緊急回滾

若新版本出現 P0 異常：

```bash
cd /opt/super
git checkout v0.1.0
docker compose up -d --build
docker compose logs -f --tail=200 app
```

回滾後請於 [CHANGELOG.md](./CHANGELOG.md) 補登 `### Reverted` 段落，並於 [todo_progress.md](./todo_progress.md) 註記失敗原因。

### 10.3 資料庫 Migration

Supermarket Tracker 使用 `better-sqlite3`，搭配 `db/migrations/` 下的 SQL 檔案：

```bash
docker compose exec app node scripts/migrate.js
```

Migration 具備冪等性，可重複執行。回滾 Migration 須手動撰寫反向 SQL 並於 PR 審查。

---

## 11. 故障排除 FAQ

### Q1：容器啟動後立刻退出（exit code 1）

**檢查順序**：

```bash
docker compose logs app
# 常見錯誤：VLM_API_KEY 未設定 / SQLite 路徑無寫入權限
```

**解法**：確認 `.env` 已正確填入，並執行 `ls -la /data` 確認權限。

### Q2：sharp 原生模組載入失敗

**症狀**：`Error: Could not load the libvips library` 或 `GLIBC not found`。

**解法**：

```bash
docker compose build --no-cache app
# 確認 Dockerfile 使用 node:20-bookworm-slim 作為基底（內含必要 glibc）
```

### Q3：Cloudflare Tunnel 顯示 502 Bad Gateway

**解法**：

```bash
docker compose ps
docker compose logs cloudflared
# 若 app 未啟動，先 docker compose up -d app
```

### Q4：磁碟空間不足

```bash
docker system df
docker system prune -a --volumes   # ⚠️ 需先備份
```

### Q5：SQLite 鎖死（database is locked）

```bash
docker compose exec app sqlite3 /data/super.db "PRAGMA busy_timeout=5000;"
# 若仍鎖死，重啟 app 服務即可釋放
```

### Q6：忘記 Volume 備份就想刪除容器

**拒絕執行**。請回到 [§6 部署前必讀](#6-部署前必讀資料備份檢查清單) 完成所有備份項目，並輸出 `BACKUP-VERIFIED` 字串後再繼續。

### Q7：Tunnel Token 洩漏

立即於 Cloudflare 控制台 Rotate Token，更新 `.env` 後重啟：

```bash
docker compose restart cloudflared
```

並審查 Git 歷史是否曾 commit 過 Token（使用 `git log -p | grep CLOUDFLARE_TUNNEL_TOKEN`）。

---

## 12. 與 README.md 的分工說明

| 文件 | 涵蓋範圍 | 讀者 |
|------|---------|------|
| [README.md](./README.md) | 專案入口、5 分鐘快速開始、技術棧徽章、貢獻指南 | 新進開發者、GitHub 訪客 |
| **README-docker.md（本檔）** | Docker 細節、Compose 服務、Cloudflare Tunnel、Volume 策略、故障排除 | DevOps、後端工程師 |
| [CLAUDE.md](./CLAUDE.md) | AI 協作守則、Ultracode 模式、安全指令 | AI 代理、Tech Lead |
| [overview.md](./overview.md) | 系統架構總覽、技術棧矩陣、資料流時序 | 全端工程師 |
| [TESTING_PLAN.md](./TESTING_PLAN.md) | TDD 三循環測試策略、覆蓋率門檻 | QA、測試工程師 |

> 若你是第一次部署，請先閱讀 [README.md](./README.md) §「快速開始」取得全貌，再回到本檔深入 Docker 細節。

---

## 相關文件

- [README.md](./README.md) — 專案入口
- [CLAUDE.md](./CLAUDE.md) — AI 協作守則與安全指令
- [overview.md](./overview.md) — 系統架構總覽
- [CHANGELOG.md](./CHANGELOG.md) — 版本變更日誌
- [todo_progress.md](./todo_progress.md) — 細項 TODO
- [TESTING_PLAN.md](./TESTING_PLAN.md) — 三階段測試策略
- [PROJECT_BRIEF.md](./PROJECT_BRIEF.md) — 專案簡報
- [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) — 專案深度脈絡
- [progress.md](./progress.md) — 進度追蹤
- [.env.example](./.env.example) — 環境變數範本（單一事實來源）
- [docker-compose.yml](./docker-compose.yml) — 容器編排設定

---

愛太妍
