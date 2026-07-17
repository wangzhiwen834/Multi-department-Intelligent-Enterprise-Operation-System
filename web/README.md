# web · 前端(02b)

Vite + React + TypeScript + Tailwind + Univer Sheets Preset。足浴财务模块录入面:登录 -> 店铺列表 -> 工作簿(当月)-> 录入表。

## 目录

```
src/
  main.tsx          React 入口
  styles.css        Tailwind + Univer CSS
  api.ts            后端 API 客户端(带 JWT)
  types.ts          类型
  univer.ts         Univer 初始化 / 模板建表 / 提取录入行
  App.tsx           路由状态(登录/店铺/工作簿)
  Login.tsx         登录页
  ShopList.tsx      店铺列表 + 月份选择
  Workbook.tsx      工作簿:Univer 编辑 + 悲观锁 UI + 保存同步
```

## 跑起来

```bash
cd web
npm install
npm run dev      # :5173,自动代理 /api -> http://localhost:3000
```

先启动后端(`cd ../server && npm run dev`),再启动前端。

## 流程与锁

1. 登录 -> 存 JWT
2. 选店铺 + 月份 -> 创建/打开工作簿
3. 工作簿:默认**查看模式**(只读提示)。点"**编辑**"占锁 -> 可编辑 + 每 15s 心跳;他人占用显示"XXX 正在编辑"+ 接管按钮
4. "**保存并同步**":存快照到后端 + 按 template 提取录入行调 `/sync` -> 数据进 PG + 返回合计/校验错误

## v1 简化(后续迭代)

- 锁:工作簿编辑会话用单把锁(`daily_ops`);后端已支持按工作表级锁,前端可扩展为按活动表
- 布局:录入表统一行式(一行一天/一笔);转置经营报表视图待加
- 查看模式:用提示+禁用保存实现(数据安全由后端锁保证,无锁不能 sync);真正的单元格级只读待加 Univer 保护
- 日期:按文本 `YYYY-MM-DD` 录入提取
