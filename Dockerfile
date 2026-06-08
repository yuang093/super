# 🤖 Dockerfile — Supermarket Tracker
# 多階段建置：builder（含 devDeps + 原生模組編譯）→ production（精簡映像）
# 規格：對齊 [CLAUDE.md §6 技術棧](../../CLAUDE.md) 與 [README-docker.md](../../README-docker.md)

# =============================================================================
# Stage 1: builder
# 安裝完整依賴（含原生模組編譯：sharp、better-sqlite3）
# =============================================================================
FROM node:20-bookworm-slim AS builder

# 安裝 sharp / better-sqlite3 編譯所需的系統依賴
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 僅複製 package.json 以充分利用 Docker layer cache
COPY package*.json ./
# npm ci 預設會安裝所有依賴（含 devDependencies，這些會在 builder 階段用於原生模組編譯）
RUN npm ci

# 複製源碼
COPY . .

# =============================================================================
# Stage 2: production
# 只複製 runtime 必要檔案，建立非 root 使用者，縮小映像檔
# =============================================================================
FROM node:20-bookworm-slim AS production

# 安裝 runtime 系統依賴
#   - wget：供 HEALTHCHECK 與 B-04 之後的健康監控使用
#   - ca-certificates：HTTPS 對外連線所需（VLM、匯率 API、Tunnel）
#   - libvips42：sharp 圖片處理的原生後端
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    ca-certificates \
    libvips42 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 建立非 root 使用者（符合 [CLAUDE.md §1.1](../../CLAUDE.md) 模組邊界）
# UID 1001 對應 docker-compose volume 的可寫入權限
RUN groupadd -r -g 1001 super \
    && useradd -r -u 1001 -g super -m -d /home/super -s /sbin/nologin super \
    && mkdir -p /data /uploads /home/super \
    && chown -R super:super /data /uploads /home/super

# 從 builder 階段複製 production node_modules 與源碼
COPY --from=builder --chown=super:super /app/node_modules ./node_modules
COPY --from=builder --chown=super:super /app/src ./src
COPY --from=builder --chown=super:super /app/public ./public
COPY --from=builder --chown=super:super /app/package.json ./package.json

# 切換至非 root 使用者
USER super

# 環境變數預設值（可由 docker-compose 或 -e 覆寫）
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_PATH=/data/super.db \
    UPLOAD_DIR=/uploads

# 對外暴露 3000
EXPOSE 3000

# 健康檢查（呼叫 /healthz，與 docker-compose 一致）
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget --quiet --spider http://127.0.0.1:3000/healthz || exit 1

# 啟動指令（exec form，PID 1 為 node 進程，可正確接收 SIGTERM 觸發 Graceful Shutdown）
CMD ["node", "src/server.js"]
