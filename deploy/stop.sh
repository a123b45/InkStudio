#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
docker compose down
echo "[ok] 已停止 InkStudio 全部容器"
