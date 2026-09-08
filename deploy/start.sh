#!/usr/bin/env bash
# 墨坊 InkStudio — Ubuntu Server 一键启动（Docker）
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

banner() {
  echo ""
  echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║    InkStudio Ubuntu 一键启动         ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
  echo ""
}

detect_host_ip() {
  local ip=""
  ip="$(curl -4 -fsS --connect-timeout 3 https://ifconfig.me 2>/dev/null || true)"
  if [[ -z "$ip" ]]; then
    ip="$(curl -4 -fsS --connect-timeout 3 https://api.ipify.org 2>/dev/null || true)"
  fi
  if [[ -z "$ip" ]]; then
    ip="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
  fi
  echo "$ip"
}

DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/.." && pwd)"

cd "$DIR"
banner

# ---- Docker 检测 ----
if ! command -v docker >/dev/null 2>&1; then
  echo -e "${RED}[error]${NC} 未检测到 docker"
  echo -e "Ubuntu 请先安装 Docker："
  echo -e "  ${CYAN}sudo ./install-docker.sh${NC}"
  echo -e "安装完成后再运行：${CYAN}./start.sh${NC}"
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo -e "${RED}[error]${NC} 未检测到 docker compose 插件"
  echo -e "请执行：${CYAN}sudo ./install-docker.sh${NC}"
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo -e "${RED}[error]${NC} 当前用户无法访问 Docker daemon"
  echo -e "请用 root 运行，或：${CYAN}sudo usermod -aG docker \$USER${NC} 后重新登录"
  exit 1
fi

echo -e "${GREEN}[ok]${NC} Docker $(docker --version | awk '{print $3}' | tr -d ',')"

# ---- .env ----
if [[ ! -f .env ]]; then
  cp .env.example .env
  JWT="$(openssl rand -hex 32)"
  ME_PASS="$(openssl rand -hex 12)"
  DETECTED_IP="$(detect_host_ip)"
  if [[ -n "$DETECTED_IP" ]]; then
    sed -i "s|^DEPLOY_HOST=.*|DEPLOY_HOST=${DETECTED_IP}|" .env
  fi
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JWT}|" .env
  sed -i "s|^MONGO_EXPRESS_PASSWORD=.*|MONGO_EXPRESS_PASSWORD=${ME_PASS}|" .env
  echo -e "${GREEN}[ok]${NC} 已创建 deploy/.env 并生成 JWT_SECRET / MONGO_EXPRESS_PASSWORD"
  if [[ -n "${DETECTED_IP:-}" ]]; then
    echo -e "${GREEN}[ok]${NC} 自动写入 DEPLOY_HOST=${DETECTED_IP}"
  fi
fi

if grep -q '^MONGO_EXPRESS_PASSWORD=$' .env 2>/dev/null; then
  ME_PASS="$(openssl rand -hex 12)"
  sed -i "s|^MONGO_EXPRESS_PASSWORD=.*|MONGO_EXPRESS_PASSWORD=${ME_PASS}|" .env
  echo -e "${GREEN}[ok]${NC} 已生成 MONGO_EXPRESS_PASSWORD"
fi

DEPLOY_HOST="$(grep '^DEPLOY_HOST=' .env | cut -d= -f2- | tr -d '\r' || true)"
if [[ -z "$DEPLOY_HOST" || "$DEPLOY_HOST" == "改成你的公网IP" ]]; then
  DETECTED_IP="$(detect_host_ip)"
  DEPLOY_HOST="${DETECTED_IP:-127.0.0.1}"
  if grep -q '^DEPLOY_HOST=' .env; then
    sed -i "s|^DEPLOY_HOST=.*|DEPLOY_HOST=${DEPLOY_HOST}|" .env
  else
    echo "DEPLOY_HOST=${DEPLOY_HOST}" >> .env
  fi
  echo -e "${YELLOW}[warn]${NC} DEPLOY_HOST 未配置，已自动设为 ${DEPLOY_HOST}"
fi

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
echo -e "  ${CYAN}健康:${NC}  curl http://127.0.0.1:5000/api/health"
echo ""
echo -e "${YELLOW}防火墙（腾讯云安全组 / ufw）请放行：8080、5000、8081${NC}"
echo -e "${YELLOW}常用命令：${NC}"
echo "  docker compose logs -f api"
echo "  docker compose ps"
echo "  docker compose down"
