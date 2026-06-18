#!/bin/bash
# 刷新 assistant 的 Railway 构建上下文:把分散在仓库各处的源拷到本目录,
# 以便打进单一镜像(本地 compose 用挂载,Railway 无挂载)。
# 改了 services/assistant/main.py 或 services/mcp 后,跑本脚本再 `railway up`。
#
# 注意:railway up 会遵循 .gitignore 排除文件,故本目录的拷贝产物必须保持「入库」状态
#       (不要 gitignore),否则上传上下文为空、镜像 COPY 失败。
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
cp "$ROOT/services/assistant/main.py"         "$HERE/main.py"
cp "$ROOT/services/assistant/requirements.txt" "$HERE/requirements.txt"
rm -rf "$HERE/mcp" && cp -r "$ROOT/services/mcp" "$HERE/mcp"
cp "$ROOT/docs/page-routes.md"                "$HERE/page-routes.md"
echo "构建上下文已刷新。接着:cd $HERE && railway up --service assistant"
