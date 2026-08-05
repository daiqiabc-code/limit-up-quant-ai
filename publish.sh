#!/usr/bin/env bash
# ============================================================
# Limit-Up Quant AI —— 公网版一键更新
#
# 每个交易日收盘后（建议 16:00 之后）运行本脚本：
#   1. 确保后端在 8008 运行（不在则启动）
#   2. 拉取当日真实数据并生成静态快照
#   3. 重新构建前端 dist
#   4. 提示重新部署（部署需在 WorkBuddy 中执行）
#
# 用法： bash publish.sh
# ============================================================
set -e

ROOT="D:/WorkBuddyProjects/limit-up-quant-ai"
PY="$ROOT/backend/venv/Scripts/python.exe"
NPX="C:/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2/npx.cmd"

echo "=============================================="
echo " Limit-Up Quant AI —— 公网版更新"
echo "=============================================="

# ---- 1. 检查后端 ----
echo ""
echo "[1/4] 检查后端 (8008)..."
if curl -s --max-time 5 http://localhost:8008/api/health > /dev/null 2>&1; then
  echo "  后端已在运行"
else
  echo "  后端未运行，正在启动..."
  cd "$ROOT/backend"
  "$PY" -m uvicorn app.main:app --host 0.0.0.0 --port 8008 > /dev/null 2>&1 &
  for i in $(seq 1 30); do
    curl -s --max-time 2 http://localhost:8008/api/health > /dev/null 2>&1 && break
  done
  echo "  后端已启动"
fi

# ---- 2. 生成快照 ----
echo ""
echo "[2/4] 抓取实时数据并生成快照（约 3 分钟）..."
cd "$ROOT/backend"
"$PY" -m scripts.make_snapshot --limit-detail 80

# ---- 3. 构建前端 ----
echo ""
echo "[3/4] 构建前端..."
cd "$ROOT/frontend"
rm -rf dist/assets 2>/dev/null || true
"$NPX" vite build

# ---- 4. 完成 ----
echo ""
echo "[4/4] 构建完成"
echo "=============================================="
echo " 产物目录： $ROOT/frontend/dist"
echo ""
echo " 下一步：在 WorkBuddy 中说「重新部署涨停系统」，"
echo " 即可将最新数据推送到公网站点。"
echo "=============================================="
