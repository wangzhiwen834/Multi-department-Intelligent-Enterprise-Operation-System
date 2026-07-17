# server · 后端(01 地基)

足浴财务模块后端地基:Express + PostgreSQL + JWT 鉴权 + 三级权限 + 操作日志。

## 目录

```
src/
  config.ts            环境变量
  db/                  schema.sql / 连接池 / 迁移
  auth/                bcrypt + JWT + 登录路由 + 鉴权中间件
  rbac/                角色权限 + 用户管理路由
  audit/               操作日志 + 横切中间件
  index.ts             Express 入口
test/                  vitest 测试
```

## 跑起来

```bash
cd server
cp .env.example .env          # 填好 DATABASE_URL / JWT_SECRET
docker compose up -d          # 起本地 PG
npm install
npm run migrate               # 建表
npm test                      # 跑测试
npm run dev                   # 开发服务器 :3000
```

## 角色

- `chairman`(董事长):增删改查所有经理+员工;可创建经理
- `manager`(经理):增/管本部门或自己创建的员工;不能管经理、不能创建经理
- `employee`(员工):仅登录使用,无用户管理权

本期不区分内容可见性(所有人看同样数据)。

## 接口

- `POST /api/auth/login` -> `{ token, user }`
- `GET  /api/auth/me`    (需 token)
- `GET  /api/users`      (董事长/经理)
- `POST /api/users`      (董事长/经理)
- `PATCH /api/users/:id` (董事长/经理,按权限范围)
- `DELETE /api/users/:id`(软删=禁用)

> 地基仅含鉴权/权限/日志。Univer 录入+悲观锁+同步、大屏、AI、海报在后续子计划(02-06)实现。
