#!/usr/bin/env bash
# 查询墨坊 InkStudio MongoDB 用户列表
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
CONTAINER="${MONGO_CONTAINER:-inkstudio-mongo}"
DB="${MONGO_DB:-slate-mern-app}"

SHOW_PASSWORD=false
if [[ "${1:-}" == "--full" || "${1:-}" == "-f" ]]; then
  SHOW_PASSWORD=true
fi

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "错误: 容器 $CONTAINER 未运行"
  echo "请先执行: cd $DIR && ./start.sh"
  exit 1
fi

if [[ "$SHOW_PASSWORD" == true ]]; then
  FIELDS='{ _id: 1, username: 1, email: 1, password: 1, gender: 1, bio: 1, createdAt: 1 }'
  echo "（含 password 哈希，仅管理员排查时使用）"
else
  FIELDS='{ _id: 1, username: 1, email: 1, gender: 1, bio: 1, createdAt: 1 }'
fi

COUNT="$(docker exec "$CONTAINER" mongosh "$DB" --quiet --eval 'db.users.countDocuments()')"
echo "数据库: $DB  |  集合: users  |  共 ${COUNT} 个用户"
echo "----------------------------------------"

docker exec "$CONTAINER" mongosh "$DB" --quiet --eval "
db.users.find({}, $FIELDS).forEach(u => printjson(u))
"

if [[ "$COUNT" == "0" ]]; then
  echo "（暂无用户，可在 Web 注册或 API 注册）"
fi

echo ""
echo "用法:"
echo "  ./list-users.sh         # 不显示密码"
echo "  ./list-users.sh --full  # 显示 password 哈希"
