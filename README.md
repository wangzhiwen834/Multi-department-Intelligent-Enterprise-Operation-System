# 多部门智能经营系统 · 足浴财务模块

基于 Univer 的多部门智能经营系统,第一子项目:足浴店财务模块(5 家店)。

## 一键启动(测试用)

**Windows**:双击 `start.bat`
**Git Bash / 终端**:`./start.sh` 或 `npm start`

脚本会自动:装根依赖 → 数据库迁移 + seed(账号)→ 启动后端(:3000)+ 前端(:5173)→ 打开浏览器。

登录账号:
| 账号 | 密码 | 角色 |
|---|---|---|
| `boss` | `boss123` | 董事长 |
| `mgr` | `mgr123` | 经理(财务部)|

打开 http://localhost:5173 → 登录 → 选店铺 → 进工作簿 → 点"编辑"占锁 → 填数据 → "保存并同步"。

## 前置条件

- 本机 PostgreSQL 运行中(本项目用 `postgres` 用户,密码 `123456`,库 `enterprise_ops`)。改连接信息见 `server/.env`。
- 首次需在各目录装依赖:`npm run install:all`(或脚本自动处理根依赖,server/web 依赖已装)。

## 目录

```
server/   后端(Express + pg + JWT + RBAC + 悲观锁 + 同步 + 台账)
web/      前端(Vite + React + Univer Sheets Preset + Tailwind)
univer-dev/   上游 Univer SDK 源码(vendored)
docs/superpowers/   设计文档 + 实现计划
start.bat / start.sh   一键启动
```

## 进度

- ✅ 01 地基(登录/权限/操作日志/PG 全量 schema)
- ✅ 02 录入闭环(Univer 录入 + 悲观锁 + 同步 + 台账,前后端)
- ⏳ 03 数据大屏 / 04 AI 助手 / 05 海报 / 06 部署
