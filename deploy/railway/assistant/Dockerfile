# Railway 部署用:自包含 assistant 镜像。
# 本地 compose 把 services/mcp 和 docs/page-routes.md 以挂载方式注入;
# Railway 无挂载,故构建前由部署脚本把它们拷到本目录一并打进镜像。
# main.py / mcp/ / page-routes.md 为拷贝产物(已 gitignore),仅本 Dockerfile 入库。
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py .
COPY mcp ./mcp
COPY page-routes.md .
# Railway 注入 $PORT;本地默认 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
