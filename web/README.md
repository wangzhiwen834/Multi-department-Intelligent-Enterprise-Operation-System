# web · 前端(02b + 03,Vue 3)

Vue 3 + Vite + TypeScript + Tailwind + Univer Sheets Preset + ECharts。

## 目录

```
src/
  main.ts            入口(createApp)
  style.css          Tailwind + Univer CSS
  api.ts             后端 API 客户端(JWT)
  types.ts           类型
  theme.ts           大屏主题(深空/商务/暖橙)
  univer.ts          Univer 初始化 / 模板建表 / 提取录入行
  App.vue            路由状态(登录/店铺/工作簿/大屏)
  env.d.ts           .vue 类型声明
  views/
    Login.vue        登录
    ShopList.vue     店铺列表 + 月份 + 大屏入口
    Workbook.vue     工作簿:Univer 编辑 + 悲观锁 + 保存同步
    Dashboard.vue    数据大屏(ECharts + 主题切换 + 钻取)
  components/
    Chart.vue        ECharts 封装
```

## 跑起来

```bash
cd web && npm install && npm run dev   # :5173,代理 /api -> :3000
```
或用根目录 `start.bat` / `npm start` 一键启动前后端。

登录:`boss` / `boss123`(董事长)、`mgr` / `mgr123`(经理)。

## 说明

- Univer 通过容器挂载(框架无关),在 `onMounted` 里 `setupUniver(containerRef)`。
- 锁:工作簿编辑会话用单把锁(`daily_ops`);查看/编辑/心跳/接管。
- 大屏:录入数据并"保存并同步"后自动反映;3 套主题可切;点 5 店对比柱钻取单店。
