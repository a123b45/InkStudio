#!/usr/bin/env bash
# 墨坊 InkStudio — 在 Ubuntu 22.04+ 安装 Docker Engine + Compose 插件
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [[ "$(id -u)" -ne 0 ]]; then
  echo -e "${RED}请使用 root 运行：sudo ./install-docker.sh${NC}"
  exit 1
fi

if ! grep -qi ubuntu /etc/os-release 2>/dev/null; then
  echo -e "${YELLOW}[warn]${NC} 当前系统不是 Ubuntu，脚本按 Ubuntu 22.04 流程安装，可能不适用"
fi

echo -e "${CYAN}>>> 卸载旧版 docker（如有）...${NC}"
apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true

echo -e "${CYAN}>>> 安装依赖...${NC}"
apt-get update -y
apt-get install -y ca-certificates curl gnupg lsb-release

echo -e "${CYAN}>>> 添加 Docker 官方源...${NC}"
install -m 0755 -d /etc/apt/keyrings
if [[ ! -f /etc/apt/keyrings/docker.gpg ]]; then
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
fi

ARCH="$(dpkg --print-architecture)"
CODENAME="$(. /etc/os-release && echo "${VERSION_CODENAME}")"
echo \
  "deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${CODENAME} stable" \
  > /etc/apt/sources.list.d/docker.list

echo -e "${CYAN}>>> 安装 Docker Engine + Compose...${NC}"
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

systemctl enable --now docker

echo -e "${GREEN}[ok]${NC} Docker 已安装"
docker --version
docker compose version

echo ""
echo -e "${YELLOW}可选：开放防火墙端口（ufw）${NC}"
echo "  ufw allow 8080/tcp"
echo "  ufw allow 5000/tcp"
echo "  ufw allow 8081/tcp"
echo ""
echo -e "接下来执行：${CYAN}cd $(dirname "$0") && ./start.sh${NC}"
