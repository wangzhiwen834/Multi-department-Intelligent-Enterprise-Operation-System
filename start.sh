#!/usr/bin/env bash
# 一键启动(Git Bash / WSL)。Ctrl+C 停止前后端。
cd "$(dirname "$0")"
echo "============================================"
echo "  足浴经营系统 - 一键启动"
echo "============================================"
echo "[1/3] 安装根依赖(concurrently)..."
npm install
echo "[2/3] 数据库迁移 + seed(账号 boss/boss123, mgr/mgr123)..."
npm run setup
echo "[3/3] 启动后端(:3000)+ 前端(:5173),Ctrl+C 停止"
echo "浏览器将自动打开 http://localhost:5173"
(sleep 7 && (cmd //c start http://localhost:5173 2>/dev/null || true)) &
npm start
