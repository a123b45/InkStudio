#!/usr/bin/env bash
# 墨坊 InkStudio — Rocky Linux 一键启动
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/.." && pwd)"

cd "$DIR"

if [[ ! -f .env ]]; then
  cp .env.example .env
  JWT="$(openssl rand -hex 32)"
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JWT}|" .env
  echo "[ok] 已创建 deploy/.env 并生成 JWT_SECRET"
fi

DEPLOY_HOST="$(grep '^DEPLOY_HOST=' .env | cut -d= -f2- | tr -d '\r' || true)"
DEPLOY_HOST="${DEPLOY_HOST:-193.112.202.161}"

if ! grep -q '^CORS_ORIGIN=' .env; then
  echo "CORS_ORIGIN=http://${DEPLOY_HOST}:8080,http://${DEPLOY_HOST}:5000,capacitor://localhost,https://localhost,http://localhost" >> .env
  echo "[ok] 已写入 CORS_ORIGIN"
fi

echo "VITE_API_URL=http://${DEPLOY_HOST}:5000" > "$ROOT/client/.env.production"
echo "[ok] client/.env.production → http://${DEPLOY_HOST}:5000"

echo ">>> 构建前端..."
docker run --rm -v "$ROOT/client:/app" -w /app node:20.19.5-alpine \
  sh -c "npm install && npm run build"

echo ">>> 拉取镜像并启动..."
docker compose pull
docker compose up -d --force-recreate

echo ""
echo "=========================================="
echo "  墨坊 InkStudio 已启动"
echo "  Web:  http://${DEPLOY_HOST}:8080"
echo "  API:  http://${DEPLOY_HOST}:5000"
echo "  健康: curl http://${DEPLOY_HOST}:5000/api/health"
echo "=========================================="
echo ""
echo "常用命令："
echo "  docker compose logs -f api   # 查看 API 日志"
echo "  docker compose ps            # 查看状态"
echo "  docker compose down          # 停止全部"
