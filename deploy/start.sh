#!/usr/bin/env bash
# 墨坊 InkStudio — Rocky Linux 一键启动
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

banner() {
  echo ""
  echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║       InkStudio 一键启动             ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
  echo ""
}

DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/.." && pwd)"

cd "$DIR"
banner

if [[ ! -f .env ]]; then
  cp .env.example .env
  JWT="$(openssl rand -hex 32)"
  ME_PASS="$(openssl rand -hex 12)"
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JWT}|" .env
  sed -i "s|^MONGO_EXPRESS_PASSWORD=.*|MONGO_EXPRESS_PASSWORD=${ME_PASS}|" .env
  echo -e "${GREEN}[ok]${NC} 已创建 deploy/.env 并生成 JWT_SECRET / MONGO_EXPRESS_PASSWORD"
fi

if grep -q '^MONGO_EXPRESS_PASSWORD=$' .env 2>/dev/null; then
  ME_PASS="$(openssl rand -hex 12)"
  sed -i "s|^MONGO_EXPRESS_PASSWORD=.*|MONGO_EXPRESS_PASSWORD=${ME_PASS}|" .env
  echo -e "${GREEN}[ok]${NC} 已生成 MONGO_EXPRESS_PASSWORD"
fi

DEPLOY_HOST="$(grep '^DEPLOY_HOST=' .env | cut -d= -f2- | tr -d '\r' || true)"
DEPLOY_HOST="${DEPLOY_HOST:-193.112.202.161}"

if ! grep -q '^CORS_ORIGIN=' .env; then
  echo "CORS_ORIGIN=http://${DEPLOY_HOST}:8080,http://${DEPLOY_HOST}:5000,capacitor://localhost,https://localhost,http://localhost" >> .env
  echo -e "${GREEN}[ok]${NC} 已写入 CORS_ORIGIN"
fi

echo "VITE_API_URL=http://${DEPLOY_HOST}:5000" > "$ROOT/client/.env.production"
echo -e "${GREEN}[ok]${NC} client/.env.production → http://${DEPLOY_HOST}:5000"

echo -e "${CYAN}>>> 构建前端...${NC}"
docker run --rm -v "$ROOT/client:/app" -w /app node:20.19.5-alpine \
  sh -c "npm install && npm run build"

echo -e "${CYAN}>>> 拉取镜像并启动...${NC}"
docker compose pull
docker compose up -d --force-recreate

echo ""
echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       墨坊 InkStudio 已启动          ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
echo -e "  ${CYAN}Web:${NC}   http://${DEPLOY_HOST}:8080"
echo -e "  ${CYAN}API:${NC}   http://${DEPLOY_HOST}:5000"
echo -e "  ${CYAN}Mongo:${NC} http://${DEPLOY_HOST}:8081  ${YELLOW}(用户见 deploy/.env 中 MONGO_EXPRESS_*)${NC}"
echo -e "  ${CYAN}健康:${NC}  curl http://${DEPLOY_HOST}:5000/api/health"
echo ""
echo -e "${YELLOW}常用命令：${NC}"
echo "  docker compose logs -f api   # 查看 API 日志"
echo "  docker compose ps            # 查看状态"
echo "  docker compose down          # 停止全部"
