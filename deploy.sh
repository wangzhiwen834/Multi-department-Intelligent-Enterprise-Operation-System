#!/bin/bash
# ===================================================
# 智能经营系统 + 媒体发布 - 服务器一键部署脚本
# 用法: 在服务器上 git pull 后运行 bash deploy.sh
# ===================================================
set -e
cd "$(dirname "$0")"

echo "============================================"
echo "  智能经营系统 - 服务器部署 (含媒体发布)"
echo "============================================"
echo ""

# ---- 确保基础环境 ----
echo "[0/6] 检查基础环境..."
command -v node >/dev/null 2>&1 || { echo "请先安装 Node.js 20+"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "请先安装 npm"; exit 1; }
command -v pm2 >/dev/null 2>&1 || { echo "请先安装 PM2: npm i -g pm2"; exit 1; }
command -v python3 >/dev/null 2>&1 || command -v python >/dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "正在安装 Python 3..."
    apt update && apt install -y python3 python3-pip python3-venv || yum install -y python3 python3-pip
fi
PYTHON=$(command -v python3 || command -v python)
echo "  Node: $(node -v) | npm: $(npm -v) | Python: $($PYTHON --version)"

# ---- 数据库 ----
echo ""
echo "[1/6] 启动 PostgreSQL..."
cd server
if ! docker ps 2>/dev/null | grep -q postgres; then
    docker compose up -d 2>/dev/null || echo "  (Docker PG 可能已在运行中,跳过)"
fi
sleep 2

# ---- 后端 ----
echo ""
echo "[2/6] 构建后端..."
if [ ! -f .env ]; then
    cp .env.example .env
    JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || date +%s | sha256sum | head -c 32)
    # 生成 MEDIA_API_KEY
    MEDIA_KEY=$(openssl rand -base64 24 2>/dev/null || date +%s | sha256sum | head -c 24)
    # 替换默认值
    sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
    sed -i "s/^MEDIA_API_KEY=.*/MEDIA_API_KEY=$MEDIA_KEY/" .env
    echo "  .env 已自动生成 (JWT_SECRET + MEDIA_API_KEY 已随机化)"
else
    echo "  .env 已存在,跳过生成"
fi
npm ci
npm run build
npm run migrate
echo "  后端构建完成"

# ---- 前端 ----
echo ""
echo "[3/6] 构建前端..."
cd ../web
npm ci
npm run build
echo "  前端构建完成"

# ---- Python 媒体发布微服务 ----
echo ""
echo "[4/6] 配置媒体发布微服务..."
cd ../media-publisher
if [ ! -d "venv" ]; then
    $PYTHON -m venv venv
    echo "  虚拟环境已创建"
fi
source venv/bin/activate
pip install -r requirements.txt -q
# 安装 Playwright 浏览器（仅首次）
if ! playwright install chromium 2>/dev/null | grep -q "already"; then
    playwright install chromium 2>/dev/null || echo "  (Playwright Chromium 安装跳过或已完成)"
fi
# 生成 .env
if [ ! -f .env ]; then
    cp .env.example .env
    # 从 server .env 同步 MEDIA_API_KEY
    SERVER_MEDIA_KEY=$(grep MEDIA_API_KEY ../server/.env | cut -d= -f2)
    if [ -n "$SERVER_MEDIA_KEY" ]; then
        sed -i "s/^MEDIA_API_KEY=.*/MEDIA_API_KEY=$SERVER_MEDIA_KEY/" .env
    fi
    # Linux 服务器默认 Chrome 路径
    sed -i "s|^LOCAL_CHROME_PATH=.*|LOCAL_CHROME_PATH=/usr/bin/google-chrome-stable|" .env || true
    echo "  media-publisher/.env 已生成"
fi
deactivate
cd ..
echo "  媒体发布微服务配置完成"

# ---- PM2 启动 ----
echo ""
echo "[5/6] 启动/重启服务..."
# 后端
pm2 delete ops-server 2>/dev/null || true
pm2 start server/ecosystem.config.cjs
# 媒体发布微服务
pm2 delete ops-media 2>/dev/null || true
pm2 start "cd media-publisher && venv/bin/python app.py" --name ops-media
pm2 save

# ---- Nginx ----
echo ""
echo "[6/6] 检查 Nginx..."
if ! command -v nginx >/dev/null 2>&1; then
    apt install -y nginx 2>/dev/null || yum install -y nginx 2>/dev/null
fi
if [ ! -f /etc/nginx/conf.d/ops.conf ]; then
    cat > /etc/nginx/conf.d/ops.conf << 'NGX'
server {
    listen 8080;
    server_name _;

    location / {
        root /opt/ops/web/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    location ^~ /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /health {
        proxy_pass http://localhost:3000;
    }
}
NGX
    echo "  Nginx 配置文件已创建"
fi
if nginx -t 2>/dev/null; then
    systemctl reload nginx 2>/dev/null || nginx -s reload 2>/dev/null || echo "  (Nginx reload 跳过,请手动 reload)"
fi

# ---- 完成 ----
echo ""
echo "============================================"
echo "  部署完成!"
echo "============================================"
echo ""
echo "  服务状态:"
pm2 status 2>/dev/null | grep -E "ops-|Name"
echo ""
echo "  访问地址: http://$(curl -s ifconfig.me 2>/dev/null || echo '服务器IP'):8080"
echo ""
echo "  常用命令:"
echo "    pm2 status          # 查看服务状态"
echo "    pm2 logs ops-server # 查看后端日志"
echo "    pm2 logs ops-media  # 查看媒体发布日志"
echo "    bash deploy.sh      # 重新部署"
echo ""
echo "  首次使用:"
echo "    1. 访问上述地址,用 boss/boss123 登录"
echo "    2. 修改密码: 员工管理 → 编辑董事长账号"
echo "    3. AI 功能: 编辑 server/.env 填写 DOUBAO_API_KEY"
echo ""
