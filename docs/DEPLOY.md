# 生产环境部署指南（字节火山 ECS）

> 目标：将本项目部署到火山引擎 ECS 云服务器，生成一个员工点击即可访问的链接。

---

## 一、前置准备

| 项目 | 要求 | 说明 |
|------|------|------|
| **服务器** | 火山 ECS，2核4G 起步 | 本文以 CentOS 7/8 或 Ubuntu 20.04/22.04 为例 |
| **公网 IP** | 服务器已分配公网 IP | 控制台 → ECS 实例 → 查看公网 IP |
| **域名（可选但推荐）** | 购买并解析到服务器 IP | 如 `meixinops.com`。国内服务器**必须 ICP 备案**才能用 80/443 端口 |
| **安全组** | 开放端口 | 至少开放 **22(SSH)、80(HTTP)、443(HTTPS)、3000(后端，可选)** |

> ⚠️ **备案提醒**：字节火山是国内云，若使用域名 + 80/443 端口，必须先完成 ICP 备案（约 7-20 天）。若暂未备案，可先通过 `http://公网IP:8080` 临时访问。

---

## 二、连接服务器

在本地终端（Windows 用 PowerShell / Git Bash，Mac 用 Terminal）执行：

```bash
ssh root@你的服务器公网IP
# 然后输入服务器密码
```

---

## 三、安装运行环境

以下命令在**服务器上**执行。

### 3.1 基础工具

**CentOS：**
```bash
yum update -y
yum install -y git nginx vim
```

**Ubuntu：**
```bash
apt update && apt upgrade -y
apt install -y git nginx vim curl
```

### 3.2 安装 Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -   # Ubuntu
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -   # CentOS
apt install -y nodejs  # Ubuntu
yum install -y nodejs  # CentOS
node -v   # 应显示 v20.x.x
npm -v    # 应显示 10.x.x
```

### 3.3 安装 PM2（进程守护）

```bash
npm install -g pm2
```

### 3.4 安装 Docker & Docker Compose（用于 PostgreSQL）

```bash
# 一键安装 Docker
curl -fsSL https://get.docker.com | bash

# 启动 Docker
systemctl enable docker
systemctl start docker

# 安装 docker-compose 插件
docker --version        # 确认 Docker 已安装
docker compose version  # 确认 compose 插件可用（Docker 20.10+ 自带）
```

---

## 四、拉取项目代码

```bash
cd /opt
git clone https://github.com/wangzhiwen834/Multi-department-Intelligent-Enterprise-Operation-System.git ops
cd ops
```

> 如果 `git clone` 提示无权限，先在服务器上配置 SSH Key，或改用 HTTPS。

---

## 五、启动数据库（PostgreSQL）

项目已自带 `docker-compose.yml`：

```bash
cd /opt/ops/server
docker compose up -d

# 验证数据库运行
docker ps
# 应看到 postgres:16 容器在运行
```

数据库默认配置：
- 库名：`enterprise_ops`
- 用户名：`postgres`
- 密码：`postgres`
- 端口：`5432`

---

## 六、配置后端环境变量

```bash
cd /opt/ops/server
cp .env.example .env
vim .env
```

按 `i` 进入编辑，修改为生产值：

```env
PORT=3000
DATABASE_URL=postgres://postgres:postgres@localhost:5432/enterprise_ops
JWT_SECRET=这里换成一个随机强密码，比如 openssl rand -base64 32
JWT_EXPIRES_IN=8h
BCRYPT_ROUNDS=10
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/enterprise_ops_test

# 豆包 AI（如需海报生成、AI 助手功能，必须填写）
DOUBAO_API_KEY=你的火山方舟 API Key
DOUBAO_MODEL=doubao-seed-2-1-pro-260628
DOUBAO_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
POSTER_MODEL=doubao-seedream-4-0-250828
```

编辑完按 `Esc`，输入 `:wq` 保存。

---

## 七、构建并启动后端

```bash
cd /opt/ops/server

# 安装依赖
npm ci

# 编译 TypeScript
npm run build

# 执行数据库迁移（创建表结构）
npm run migrate

# 使用 PM2 启动（崩溃自动重启）
pm2 start ecosystem.config.cjs

# 查看运行状态
pm2 status
pm2 logs ops-server
```

后端现在运行在 `http://localhost:3000`。

---

## 八、构建前端

```bash
cd /opt/ops/web

# 安装依赖
npm ci

# 生产构建（生成 dist/ 目录）
npm run build

# 验证 dist 生成
ls -la dist/
```

---

## 九、配置 Nginx

### 9.1 选择你的场景

#### 场景 A：暂无域名 / 未备案（临时方案）

用 `http://公网IP:8080` 访问，无需备案。

#### 场景 B：已有域名且已备案（正式方案）

用 `http://你的域名` 或 `https://你的域名` 访问。

### 9.2 编辑 Nginx 配置

**场景 A（IP + 8080 端口）：**

```bash
vim /etc/nginx/conf.d/ops.conf
```

写入以下内容：

```nginx
server {
    listen 8080;
    server_name _;  # 接受任何 IP

    # 前端静态文件
    location / {
        root /opt/ops/web/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # API 反向代理到后端
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # 健康检查
    location /health {
        proxy_pass http://localhost:3000;
    }
}
```

**场景 B（域名 + 80 端口）：**

```nginx
server {
    listen 80;
    server_name 你的域名.com;

    location / {
        root /opt/ops/web/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
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
```

### 9.3 测试并重载 Nginx

```bash
nginx -t              # 测试配置是否正确
systemctl reload nginx
```

---

## 十、配置安全组（防火墙）

进入**火山引擎控制台** → ECS → 安全组 → 配置规则，添加：

| 协议 | 端口 | 源地址 | 说明 |
|------|------|--------|------|
| TCP | 22 | 0.0.0.0/0 | SSH（已有） |
| TCP | 80 | 0.0.0.0/0 | HTTP（场景 B） |
| TCP | 443 | 0.0.0.0/0 | HTTPS（场景 B） |
| TCP | 8080 | 0.0.0.0/0 | 临时访问（场景 A） |

> 若服务器内还有防火墙（firewalld/ufw），也需放行对应端口。

---

## 十一、验证部署

在浏览器打开：

- **场景 A**：`http://你的服务器公网IP:8080`
- **场景 B**：`http://你的域名.com`

应看到登录页面。测试登录、表格、海报等功能是否正常。

---

## 十二、给员工发链接

将以下链接通过企业微信 / 钉钉 / 邮件发给员工：

```
http://你的服务器公网IP:8080
# 或
http://你的域名.com
```

建议保存到浏览器书签，或做成企业微信/钉钉的「自建应用」入口，点击直接跳转。

---

## 十三、可选：配置 HTTPS（强烈推荐）

使用 **Certbot** 免费申请 SSL 证书：

```bash
# Ubuntu
apt install -y certbot python3-certbot-nginx

# 申请证书（按提示操作）
certbot --nginx -d 你的域名.com

# 自动续期已默认启用
```

申请后，员工链接变为：
```
https://你的域名.com
```

---

## 十四、常用维护命令

```bash
# 查看后端日志
pm2 logs ops-server

# 重启后端
pm2 restart ops-server

# 更新代码后重新部署
cd /opt/ops && git pull
cd /opt/ops/server && npm run build && pm2 restart ops-server
cd /opt/ops/web && npm run build

# 备份数据库
docker exec ops-postgres-1 pg_dump -U postgres enterprise_ops > backup.sql

# 查看 Nginx 日志
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

---

## 十五、故障排查

| 现象 | 排查方法 |
|------|----------|
| 页面空白 404 | 检查 `web/dist` 是否存在；检查 Nginx `root` 路径 |
| API 请求失败 | 检查后端 `pm2 status`；检查 `nginx -t` |
| 数据库连不上 | `docker ps` 确认 postgres 在运行；检查 `.env` 的 `DATABASE_URL` |
| 端口无法访问 | 检查火山安全组；检查服务器防火墙 `firewall-cmd --list-ports` |
| AI/海报不可用 | 检查 `.env` 中 `DOUBAO_API_KEY` 是否填写正确 |

---

## 十六、一键部署脚本（可选）

如果你希望未来能一键更新，可以在服务器上保存以下脚本为 `/opt/deploy.sh`：

```bash
#!/bin/bash
set -e
cd /opt/ops
git pull
cd server
npm ci
npm run build
npm run migrate
pm2 restart ops-server
cd ../web
npm ci
npm run build
echo "部署完成！"
```

然后执行：
```bash
chmod +x /opt/deploy.sh
/opt/deploy.sh
```
