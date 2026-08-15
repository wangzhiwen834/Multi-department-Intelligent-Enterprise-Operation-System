# 多部门智能经营系统（Multi-department Intelligent Enterprise Operation System）

> 基于 [Univer](https://github.com/dream-num/univer) 开源办公 SDK 构建的多部门智能经营系统。以「在线电子表格」替代分散的本地 Excel，实现多门店、多业态的**录入 — 存储 — 分析 — 呈现 — 发布**一体化经营闭环。

第一个落地的子项目是**足浴店财务模块**（5 家门店），并已扩展到 **4 种业态**：足浴、酒店、月子中心、调理馆。系统面向真实的门店员工与经营者，核心设计目标是**尽量降低员工的学习成本**——让一线店长/财务几乎沿用现有 Excel 的操作习惯。

---

## 目录

- [项目概览](#项目概览)
- [核心特性](#核心特性)
- [系统架构](#系统架构)
- [技术栈](#技术栈)
- [核心设计理念](#核心设计理念)
- [功能模块](#功能模块)
- [业态覆盖](#业态覆盖)
- [角色与权限](#角色与权限)
- [目录结构](#目录结构)
- [快速开始（本地开发）](#快速开始本地开发)
- [环境变量配置](#环境变量配置)
- [媒体发布微服务](#媒体发布微服务)
- [生产部署](#生产部署)
- [测试](#测试)
- [项目文档](#项目文档)
- [进度 / 路线图](#进度--路线图)

---

## 项目概览

- **一句话定位**：把门店「Excel 台账」搬上线的在线经营系统，接上 AI 分析与跨平台内容发布。
- **解决的问题**：本地 Excel 文件分散、公式易坏（`#REF!`/`#DIV/0!`）、多店/多月数据割裂、无法自动汇总分析、经营日报/海报/短视频发布靠人工。
- **与 Excel 的关系**：**不是**对 Excel 的 1:1 复刻，而是「数据地基 + 在线表录入 + 大屏/ AI 读库」的分离式架构（见 [核心设计理念](#核心设计理念)）。

---

## 核心特性

| 分类 | 能力 |
|------|------|
| 在线表格录入 | 基于 Univer 的在线电子表格，多工作表、每店每月一本工作簿，操作习惯贴近 Excel |
| 协同安全 | 工作表级悲观锁（查看不锁、编辑显式占锁、心跳续期、断线自动释放、保存前归属校验） |
| 数据存储 | 数据以 JSONB 快照 + 结构化指标表双轨落库（PostgreSQL），录入与展示分离 |
| AI 语义抽取 | 用大模型把表格快照**确定性抽取**为结构化经营指标（唯一入库路径），替代脆弱的按位置同步 |
| 数据大屏 | 日期粒度（日/周/月/年）+ 钻取 + 8 KPI 卡片 + 8 图表 + 深浅色主题 |
| AI 经营助手 | 豆包（Doubao）对话式问答，自动调用工具查询数据库，输出中文经营简报 |
| 海报生成 | 豆包文生图背景 + Fabric 画布编辑（文字/裁剪/层级/Logo/联系信息），一键导出 |
| 媒体发布 | 9 大平台内容发布（图文/视频），扫码登录、单发/批量、定时、任务管理 |
| 权限与审计 | 三级角色（董事长/经理/员工）+ JWT 鉴权 + 操作日志（操作粒度） |
| 可扩展性 | 业务 → 门店 → 模块三级可配置扩展，新增业态/指标**仅改配置不改代码** |

---

## 系统架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                          浏览器 (员工/经营者)                          │
│   Vue 3 前端  ·  Univer 表格  ·  ECharts 大屏  ·  Fabric 海报画布     │
└───────────────┬─────────────────────────────────────────────────────┘
                │  HTTPS (Nginx 反向代理 /api -> :3000)
┌───────────────▼─────────────────────────────────────────────────────┐
│                    后端服务 (Node.js + TypeScript)                     │
│  Express · JWT 鉴权 · 三级 RBAC · 操作日志 · 悲观锁 · AI 网关          │
│                                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐ │
│  │ 工作簿    │ │ AI 抽取   │ │ 数据大屏  │ │ AI 助手  │ │ 海报/媒体  │ │
│  │ 快照+锁   │ │ 管线+调度 │ │ 聚合+钻取 │ │ 工具调用  │ │ 路由代理   │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └───────────┘ │
└───────┬──────────────────────────┬──────────────────┬───────────────┘
        │                          │                  │
   ┌────▼────┐              ┌──────▼───────┐   ┌──────▼──────────────┐
   │PostgreSQL│             │ 豆包(火山方舟) │   │ 媒体发布微服务        │
   │  (RDS)  │             │  Ark API      │   │ Python Flask +      │
   │  16      │             │  chat/文生图   │   │ Playwright(:5409)  │
   └─────────┘              └──────────────┘   └─────────────────────┘
                                                      │ 无头浏览器
                                          ┌───────────┴───────────┐
                                          │ 小红书/视频号/抖音/快手/  │
                                          │ TikTok/Ins/FB/B站/百家号 │
                                          └───────────────────────┘
```

**三个服务进程**：

| 服务 | 技术 | 默认端口 | 说明 |
|------|------|---------|------|
| `server/` | Node.js + TypeScript + Express | `3000` | 主后端：鉴权/权限/工作簿/大屏/AI/海报，并桥接媒体微服务 |
| `web/` | Vue 3 + Vite + Univer + ECharts | `5173`（dev）/ Nginx 静态 | 前端 SPA |
| `media-publisher/` | Python Flask + Playwright | `5409` | 媒体发布微服务（无头浏览器自动化登录与发布） |

---

## 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 前端 | Vue 3.5 + Vite 6 + TypeScript | SPA 单页应用 |
| 表格 | Univer `@univerjs/*` 1.0.0-alpha.3（vendored 到 `univer-dev/`） | 在线电子表格 |
| 样式 | Tailwind CSS 3.4 | 深浅色主题（CSS 变量 tokens） |
| 图表 | ECharts 5.5 | 数据大屏 |
| 画布 | Fabric.js 6.9 | 海报编辑器 |
| 后端 | Node.js 20+ / Express 4 / TypeScript | 主服务 |
| 数据库 | PostgreSQL 16 | 结构化经营数据 + JSONB 快照 |
| 认证 | JWT + bcryptjs | 登录与密码 |
| AI | 豆包（火山方舟 Ark，OpenAI 兼容） | 对话/抽取/文生图 |
| 定时 | node-cron | AI 抽取定时调度 |
| 媒体发布 | Python Flask + Playwright | 无头浏览器自动化 |
| 部署 | PM2 + Nginx + Docker（PostgreSQL） | 火山引擎 ECS |

---

## 核心设计理念

### 1. 方案 B：录入与展示分离（架构脊柱）

**不是**把 Excel 原样照搬到线上，而是：

- **干净的数据地基**：经营数据在 PostgreSQL 中以结构化方式存储（`daily_metric` 指标表 + `expense` 明细表等）。
- **Univer 作为录入入口**：员工仍然在「像 Excel 一样」的在线表格里填数据。
- **大屏 / AI 从数据库读取**：不直接解析表格，读的是干净的结构化数据。

这样既保留了员工熟悉的表格体验，又避免了「解析一张散乱的 Excel」的脆弱性。

### 2. 录入归一（Enter Once）

同一笔数据只录入一次，杜绝跨表重复录入与 `#REF!` 式易坏公式：

- **手工录入表**：`经营报表`（转置的日经营指标）、`收入对账`（支付渠道对账）、`费用明细`（逐笔）。
- **自动生成**：仅 `经营报表` 中的简单合计行、以及只读的 `资金台账/账户管理`（流水余额）由后端自动计算。

### 3. AI 语义抽取作为唯一入库路径（新颖性主脊柱）

- 保存时用大模型把表格快照**确定性抽取**为结构化指标（`temperature: 0` + JSON 模式 + `coerceMetric` 清洗 `¥`/`%`/千分位等）。
- 三条触发路径：保存即抽取（持锁编辑者）、经理手动抽取、定时任务（每日 02:17 当前期）。
- 相比旧的「按表名/位置同步」，AI 抽取对表头重命名、行列变动、公式错误（`#REF!`/`#DIV/0!`）更稳健。

### 4. 工作表级悲观锁（不阻塞他人）

- **查看态默认不锁**，任何人可随时查看。
- 显式点「编辑」才获取锁；15s 心跳续期；60s 断线宽限自动释放；接管排队；保存前归属校验防覆盖。
- 面向约 10–30 人的财务数据录入场景，放弃 Univer Server 的 OT 实时协同，换取简单与低耦合。

### 5. 最小化员工学习成本（硬约束）

- 录入表头、术语、列顺序、配色尽量贴近员工现有 Excel。
- 交互仍是「单元格输入、Enter/Tab 移动」，不引入表单式录入。
- AI 助手用自然中文对话，海报一键生成，店铺切换就是简单列表。

### 6. 可配置扩展（硬约束）

新增一个指标/一张表/一种新业态应当**只改配置不改代码**：

- 三级模型：`业务(business) → 门店(shop) → 模块(module)`。
- 模板描述符（JSONB）+ JSONB 指标存储 + 模板驱动的同步/大屏渲染。

---

## 功能模块

### 模块 01 · 地基（认证 / 权限 / 日志 / Schema）

- JWT 登录、bcrypt 密码。
- 三级角色 RBAC（详见 [角色与权限](#角色与权限)）。
- 操作日志中间件：记录重要操作 + 操作人，**操作粒度**（数据录入/编辑记到操作级，非逐单元格）。
- PostgreSQL 全量 schema（13 张表），见 `server/src/db/schema.sql`。

### 模块 02 · 录入闭环（工作簿 + 悲观锁）

- 三级导航：`店铺列表 → 经理 → 工作簿`。
- 年份文件夹树 + 月份明细面板；支持任意年/月新建、从上一期复制表头、软删除（保留大屏数据）、锁徽章。
- 性能优化：gzip + `POST /workbooks/bootstrap`（4 次往返 → 1 次）+ 工作表懒加载（保存前 hydrate 全部表，避免未访问表被覆盖）。

### 模块 03 · 数据大屏（Dashboard）

- 后端 `GET /api/dashboard/overview` 支持 `granularity`(day/week/month/year) + `date` 参数（兼容 `period=YYYY-MM`）。
- 趋势可钻取到更细粒度（月→每日 / 周→7天 / 年→12月 / 日→前14天），缺数据 0 填充。
- 前端：粒度切换 + 前后翻页 + 回到今天、8 KPI 卡片、8 图表（按《经营报表》维度）。
- 按业态分派到独立处理器（`dashboard/footbath|hotel|tiaoli|yuezi.ts`）。

### 模块 04 · AI 经营助手

- 豆包对话（`doubao-seed-2-1-pro-260628`），function-calling 自动查询数据库（`get_kpis` / `compare_shops` 等工具）。
- 输出中文经营简报；纯自然语言交互。

### 模块 05 · 海报生成

- 豆包文生图（`doubao-seedream-4-0-250828`）生成背景 → 服务端返回 base64（避免前端 Canvas 跨域污染）。
- Fabric 画布：文字 / 裁剪 / 层级 / 导出。
- 企业 Logo：上传/删除（可多个，服务端持久化），一键叠加。
- 店铺联系信息：按店铺预设地址 + 电话，一键叠加。

### 模块 06 · 部署

- 火山引擎 ECS + Nginx + PM2 + Docker PostgreSQL，一键脚本 `deploy.sh`，详见 [生产部署](#生产部署) 与 `docs/DEPLOY.md`。

### 模块 07 · 媒体发布（MediaPublishPlatform）

- **9 大平台**：小红书(1)、腾讯视频号(2)、抖音(3)、快手(4)、TikTok(5)、Instagram(6)、Facebook(7)、B 站(8)、百家号(9)。
- **账号登录**：无头浏览器打开登录页 → 截屏二维码 → 前端扫码/交互（点击/输入/刷新/缩放）→ 检测登录成功并保存 Cookie。
- **内容发布**：图文/视频单发与批量、标题/正文/标签、定时发布（按平台能力）。
- **任务管理**：发布任务记录、状态跟踪、取消/重试/删除、平台/素材统计。
- **服务边界**：Python 微服务负责浏览器自动化，Node 后端通过 HTTP（API Key 鉴权）桥接，前端只与 Node 通信。

---

## 业态覆盖

系统按「模板描述符」驱动，同一套引擎支撑多种业态。当前已实现 4 种：

| 业态 | 模板文件 | 大屏处理器 | 状态 |
|------|---------|-----------|------|
| 足浴（大河坎店等 5 店） | `template/footbath.template.ts` | `dashboard/footbath.ts` | ✅ 真实数据入库验证（16 天） |
| 酒店（汉庭） | `template/hotel.template.ts` | `dashboard/hotel.ts` | ✅ 框架验证（部分入库） |
| 月子中心（禧悦国际） | `template/yuezi.template.ts` | `dashboard/yuezi.ts` | ✅ 已实现 |
| 调理馆（禧悦） | `template/tiaoli.template.ts` | `dashboard/tiaoli.ts` | ✅ 已实现 |

---

## 角色与权限

| 角色 | 权限 |
|------|------|
| **董事长（chairman）** | 增删改查所有经理 + 员工；可创建经理；查看全部操作日志 |
| **经理（manager）** | 增/管本部门（或自己创建）的员工；不能管经理、不能创建经理；查看本部门日志 |
| **员工（employee）** | 仅登录使用，无用户管理权 |

> 员工账号须由经理/董事长创建后登录，无自助注册。当前版本**不按角色区分内容可见性**（所有人看到相同数据）。

**默认测试账号**（`server/scripts/seed.ts` 生成）：

| 账号 | 密码 | 角色 |
|------|------|------|
| `boss` | `boss123` | 董事长 |
| `mgr` | `mgr123` | 经理（财务部） |

---

## 目录结构

```
.
├── server/                 # 后端 (Node.js + TypeScript + Express)
│   ├── src/
│   │   ├── auth/           # 登录 / JWT / 密码
│   │   ├── rbac/           # 角色权限 / 用户管理
│   │   ├── audit/          # 操作日志
│   │   ├── workbook/       # 工作簿快照 + 懒加载 + bootstrap
│   │   ├── lock/           # 工作表级悲观锁
│   │   ├── extraction/     # AI 语义抽取管线 + 定时调度
│   │   ├── dashboard/      # 大屏聚合（按业态分派）
│   │   ├── ai/             # 豆包网关 + 工具调用
│   │   ├── poster/         # 海报生成 + Logo 管理
│   │   ├── media/          # 媒体微服务桥接路由
│   │   ├── settings/       # AI 模型管理 + 功能分配
│   │   ├── template/       # 各业态模板描述符
│   │   ├── shop/ business/ report/  # 门店 / 业务 / 报表
│   │   ├── db/             # schema.sql / 连接池 / 迁移
│   │   └── config.ts       # 环境变量
│   ├── scripts/            # seed / 迁移 / 探测 / Excel 导入等脚本
│   └── test/               # vitest 测试（20+ 文件）
│
├── web/                    # 前端 (Vue 3 + Vite)
│   └── src/
│       ├── views/          # 页面：Login/ShopList/Workbook/Dashboard/
│       │                   #       Chat/Poster/Media/Settings/AuditLog 等
│       ├── components/     # Chart 等
│       ├── composables/    # theme-store 等
│       ├── styles/         # tokens.css（深浅色主题变量）
│       ├── api.ts          # 后端 API 客户端
│       └── sheet-io.ts     # Excel 导入导出转换
│
├── media-publisher/        # 媒体发布微服务 (Python Flask + Playwright)
│   ├── app.py              # 主服务（平台/账号/文件/任务/发布）
│   ├── conf.py             # 配置
│   ├── myUtils/            # 登录（统一扫码登录）/ Cookie 校验
│   ├── newFileUpload/      # 平台配置 + 多平台文件上传
│   └── utils/              # 基类 / 日志 / 网络 / stealth 脚本
│
├── univer-dev/             # 上游 Univer SDK 源码（vendored）
├── docs/                   # 部署文档 + 设计文档 + 论文材料
├── deploy.sh               # 服务器一键部署脚本（含媒体微服务）
├── start.bat / start.sh    # 本地一键启动
└── package.json            # 根脚本（concurrently 启动三服务）
```

---

## 快速开始（本地开发）

### 前置条件

- **Node.js 20+** 与 npm
- **PostgreSQL 16** 运行中（默认 `postgres` 用户，密码 `123456`，库 `enterprise_ops` + `enterprise_ops_test`）
- （可选）**Python 3.10+** 用于媒体发布微服务

### 方式一：一键启动（Windows 双击 `start.bat`，或终端）

```bash
npm install               # 根依赖（concurrently）
npm run install:all       # 安装 server/ + web/ 依赖
npm run setup             # 数据库迁移 + seed（生成测试账号）
npm start                 # 同时启动 后端(:3000) + 前端(:5173) + 媒体(:5409)
```

打开 http://localhost:5173 → 登录 → 选店铺 → 进工作簿 → 点「编辑」占锁 → 填数据 → 保存。

### 方式二：分步启动

```bash
# 1. 后端
cd server
cp .env.example .env          # 填写 DATABASE_URL / JWT_SECRET
npm install
npm run migrate               # 建表
npm run seed                  # 种子数据（测试账号）
npm run dev                   # :3000

# 2. 前端（另开终端）
cd web
npm install
npm run dev                   # :5173（已代理 /api -> :3000）

# 3. 媒体发布微服务（可选，另开终端）
cd media-publisher
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium
python app.py                 # :5409
```

---

## 环境变量配置

### `server/.env`

```env
PORT=3000
DATABASE_URL=postgres://postgres:postgres@localhost:5432/enterprise_ops
JWT_SECRET=change-me-in-production
JWT_EXPIRES_IN=8h
BCRYPT_ROUNDS=10
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/enterprise_ops_test

# 豆包 AI（火山方舟 Ark，OpenAI 兼容）。不填则 AI 助手提示未配置
DOUBAO_API_KEY=
DOUBAO_MODEL=doubao-seed-2-1-pro-260628
DOUBAO_BASE_URL=https://ark.cn-beijing.volces.com/api/v3

# 文生图模型（海报背景）
POSTER_MODEL=doubao-seedream-4-0-250828

# AI 抽取管线
EXTRACT_MODEL=
EXTRACT_CRON=17 2 * * *
EXTRACT_TIMEOUT_MS=60000

# 媒体发布微服务
MEDIA_SERVICE_URL=http://localhost:5409
MEDIA_API_KEY=change-me-in-production
```

### `media-publisher/.env`

```env
MEDIA_PORT=5409
MEDIA_HOST=0.0.0.0
MEDIA_API_KEY=your-api-key-here

# Chrome 浏览器路径
LOCAL_CHROME_PATH=C:/Program Files/Google/Chrome/Application/chrome.exe
LOCAL_CHROME_HEADLESS=False
```

> ⚠️ 所有 `.env` 均已加入 `.gitignore`，不会提交到仓库。生产环境务必修改 `JWT_SECRET` 与 `MEDIA_API_KEY`（`deploy.sh` 会自动随机生成）。

---

## 媒体发布微服务

**功能**：把经营系统生成的海报/视频等内容，一键发布到多个社交媒体平台。

**支持的平台**（9 个）：

| 平台 | type |
|------|------|
| 小红书 xiaohongshu | 1 |
| 腾讯视频号 tencent | 2 |
| 抖音 douyin | 3 |
| 快手 kuaishou | 4 |
| TikTok | 5 |
| Instagram | 6 |
| Facebook | 7 |
| B 站 bilibili | 8 |
| 百家号 baijiahao | 9 |

**核心流程**：

1. **账号登录**：无头浏览器打开平台登录页 → 截屏二维码（SSE 推给前端）→ 用户扫码/交互（点击、输入、刷新、缩放）→ 检测登录成功 → 保存 Cookie。
2. **内容发布**：上传文件（图文/视频）→ 填写标题/正文/标签 → 单发或批量发布（多账号 × 多平台 × 多文件）→ 可选定时。
3. **任务管理**：发布任务记录与状态跟踪，支持取消/重试/删除，平台与素材统计。

> 该模块依赖浏览器自动化，选择器随平台改版可能失效；平台配置集中在 `media-publisher/newFileUpload/platform_configs.py`，便于维护。

---

## 生产部署

一键部署脚本 `deploy.sh`（服务器上 `git pull` 后运行）：

```bash
git clone https://github.com/wangzhiwen834/Multi-department-Intelligent-Enterprise-Operation-System.git /opt/ops
cd /opt/ops
bash deploy.sh
```

脚本会依次：检查环境（Node/Python/PM2）→ 启动 PostgreSQL（Docker）→ 构建后端（含迁移）→ 构建前端 → 配置媒体微服务（venv + Playwright Chromium）→ PM2 启动两个服务 → 配置 Nginx 反向代理。

- **访问地址**：`http://服务器IP:8080`（未备案）或 `http://你的域名`（已备案）。
- 详细手动部署步骤、安全组、HTTPS、故障排查见 **[docs/DEPLOY.md](docs/DEPLOY.md)**。

> 低内存服务器（2G）已在生产环境配置 4G swap 以支撑前端 `vite build`（单 chunk ~9MB）。

---

## 测试

```bash
cd server
npm test          # vitest 全量测试（需本地 PG，测试使用独立库 enterprise_ops_test）

cd web
npm run build     # vue-tsc 类型检查 + 生产构建
```

后端测试覆盖：认证/权限、工作簿（bootstrap/复制/删除/列表）、悲观锁、数据大屏（含多业态与数值守卫）、AI 抽取（管线/调度/路由）、AI 工具、系统设置等，见 `server/test/`。

---

## 项目文档

| 文档 | 位置 |
|------|------|
| 生产部署指南 | `docs/DEPLOY.md` |
| 设计文档 | `docs/superpowers/specs/` |
| 实现计划 | `docs/superpowers/plans/` |
| 论文（系统设计与应用） | `docs/论文-*.md` / `docs/论文-*.docx` |

---

## 进度 / 路线图

- ✅ **01 地基**：登录 / 权限 / 操作日志 / PG 全量 schema
- ✅ **02 录入闭环**：Univer 录入 + 悲观锁 + AI 抽取 + 台账
- ✅ **03 数据大屏**：日期粒度聚合 + 钻取 + 多业态
- ✅ **04 AI 助手**：豆包对话，基于当期数据问答
- ✅ **05 海报**：豆包文生图背景 + Fabric 画布编辑 + Logo/联系信息
- ✅ **06 部署**：火山 ECS + Nginx + PM2 + Docker PG
- ✅ **07 媒体发布**：9 平台扫码登录 + 批量发布 + 定时 + 任务管理
- ✅ **业态扩展**：足浴 / 酒店 / 月子中心 / 调理馆

---

## 许可与致谢

- 基于开源项目 [Univer](https://github.com/dream-num/univer)（上游 SDK 源码 vendored 于 `univer-dev/`）。
- AI 能力由 [火山方舟 Ark（豆包）](https://www.volcengine.com/product/ark) 提供。
- 本项目为私有业务系统，代码未附带开源许可证（如需要请自行补充）。
