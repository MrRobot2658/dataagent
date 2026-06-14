#!/bin/bash
# 应用 sql/migrate_*.sql 增量迁移到 agenticdatahub-mysql
# 关键：用 --default-character-set=utf8mb4 避免管道导入中文乱码（双重编码）
set -euo pipefail

CONTAINER="${MYSQL_CONTAINER:-agenticdatahub-mysql}"
DB="${MYSQL_DATABASE:-agenticdatahub}"
USER="${MYSQL_USER:-agenticdatahub}"
PASS="${MYSQL_PASSWORD:-agenticdatahub123}"
DIR="$(cd "$(dirname "$0")/.." && pwd)/sql"

echo "== 应用迁移到 $CONTAINER/$DB =="
for f in "$DIR"/migrate_*.sql; do
  [ -e "$f" ] || continue
  echo "-> $(basename "$f")"
  docker exec -i "$CONTAINER" mysql --default-character-set=utf8mb4 \
    -u"$USER" -p"$PASS" "$DB" < "$f"
done
echo "== 迁移完成 =="
