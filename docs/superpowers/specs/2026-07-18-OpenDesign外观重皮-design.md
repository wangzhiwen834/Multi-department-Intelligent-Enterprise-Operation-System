# OpenDesign 外观重皮 · 设计文档

- **日期**:2026-07-18
- **项目**:多部门智能经营系统(基于 Univer)
- **子设计**:用 OpenDesign 产出外观,就地重皮现有 Vue 3 前端 + 新增侧边栏外壳与员工管理模块
- **父设计**:`docs/superpowers/specs/2026-07-17-足浴财务模块-design.md`
- **状态**:待用户审阅

---

## 1. 概述

### 1.1 目标
现有前端(v1 已完成 5 模块)外观简陋、缺侧边栏导航、缺员工管理界面。本设计用 **OpenDesign**(nexu-io/open-design,外部设计转代码工具,产物为自包含 HTML)产出全新外观,在**保留现有 Vue 3 应用与后端服务、不动 Univer 业务功能**的前提下,重做前端界面并补齐缺失功能。

### 1.2 硬约束
- **保 Vue 3**:不换框架;OpenDesign 产出的 HTML 作为"外观真相源"移植进现有 Vue SFC。
- **保 `api.ts` 与后端**:服务层与 `server/` REST API 不动,新外观视图继续调用现有接口。
- **不动 Univer**:工作簿的表格挂载点、`univer.ts`、锁/心跳/保存/同步逻辑原样;只重做围绕表格的外壳样式。
- **低学习成本**(继承父设计):员工操作仍贴近表格/导航直觉。

### 1.3 方案与方向
- **方案 3(混合)**:令牌 + 逐屏移植。OpenDesign 产出 (a) 设计系统令牌、(b) 逐屏 HTML;令牌落进扩展后的 `theme.ts`,逐屏 HTML 移植进 Vue SFC,样式消费令牌。
- **视觉方向**:商务浅色精修(纯白卡片 + 柔和阴影 + 细冷边框 + sky/blue 主色 + 5 店各一色)。

---

## 2. OpenDesign 产物核实

交接目录(用户指定):`Opendesign/`(项目根)。

实际产物(已核实):
```
Opendesign/
  design-system.md          ← 令牌规范(--od-* CSS 变量 + 说明表 + 配色逻辑)
  login.html                ← 登录页(分屏品牌+表单)
  app-shell.html            ← 侧边栏外壳骨架
  dashboard.html            ← 数据大屏
  company-ops.html          ← 公司经营(drill:业务->店铺,带面包屑)
  ai-chat.html              ← AI 分析对话页
  ai-poster.html            ← AI 每日海报生成页
  employees.html            ← 员工管理(董事长/经理两态)
  workbook-shell.html       ← Univer 工作簿外壳(表格区为占位)
  index.html / landing.html ← OpenDesign 额外产物,非应用前端(见 §9 待确认)
  *.artifact.json           ← 每份 HTML 的 manifest(kind=html, renderer=html, exports=[html,pdf,zip])
  .file-versions/ .od-skills/ ← OpenDesign 版本与技能元数据,移植时忽略
```

契约符合度:
- ✅ 8 份屏 HTML + 令牌规范齐全;每份 HTML 自包含(`<style>` 内联 `:root` --od-* 令牌,浏览器可直接预览)。
- ✅ 样式全部走 `--od-*` 令牌,无硬编码颜色(白色文字/渐变除外)。
- ✅ 每份带 `data-od-id` 语义钩子属性,便于移植时映射 Vue 结构与行为绑定点。
- ✅ `workbook-shell.html` 表格主体为占位横幅("Univer 表格区 · 禁动 · 不在本稿设计"),Univer 边界被尊重;两态锁徽标(被占用+接管 / 可编辑)齐全。
- ⚠️ OpenDesign 将系统品牌命名为"**静水楼台**企业智能经营系统"(见 design-system.md 标题、login.html)。本项目沿用名是"多部门智能经营系统"。品牌名待用户确认(§9)。

---

## 3. 信息架构(登录后侧边栏外壳)

取代现有 `ShopList` 枢纽式切换,改为**侧边栏 + 顶栏 + 内容区**主框架。

侧边栏模块项:
1. **数据大屏**(Dashboard)
2. **公司经营** -> drill:业务模块(暂仅"足浴店")-> 5 店卡片 -> 点店进 Univer 工作簿
3. **AI 分析**(Chat)
4. **AI 每日海报**(Poster)
5. **员工管理**(角色可见性见 §7)

顶栏:全局月份选择器 + 用户名 + 退出(月份供大屏/工作簿共用)。

导航模型:侧边栏切模块;"公司经营"为单页带面包屑 drill(业务卡 -> 店铺卡 -> 进 Univer)。

---

## 4. 交接契约

- **路径**:`Opendesign/`(用户指定,扁平结构,无 `screens/` 子目录)。
- **真相源**:每份 HTML = 对应屏的外观真相;`design-system.md` = 令牌真相。
- **版本与迭代**:每次在 OpenDesign 重新导出某屏/令牌,覆盖对应文件;移植方按文件改动判断增量移植(令牌改=全站换肤;某屏 HTML 改=重移植该屏)。manifest(`*.artifact.json`)记 `updatedAt` 可作版本参考。
- **移植忽略**:`.file-versions/`、`.od-skills/`、`index.html`、`landing.html`(除非 §9 另定)。

---

## 5. 移植策略

### 5.1 令牌层(先做,全站基底)
- 扩展 `web/src/theme.ts`:在现有 `Theme`(颜色)之上,新增完整令牌--字体/字号/字重/间距/圆角/阴影/语义软底/5 店色/布局辅助(侧栏宽、顶栏高),并以 CSS 变量挂到 `:root`(`--od-*`)。
- 令牌值直接取自 `Opendesign/design-system.md` §1 的 `:root` 块。
- **与现有 THEMES 共存**:现有 `THEMES` TS 对象保留,供需要 JS 侧取色的场景(如 ECharts 图表配色注入)使用;CSS 表面(视图样式)统一走 `--od-*` 变量,二者由同一份令牌源派生以避免漂移。
- **还旧账**:把各视图硬编码的 Tailwind 颜色(如 `Login.vue` 的 `from-sky-500`、`text-slate-900`)改成消费 `--od-*` 令牌。
- 多主题:本期 OpenDesign 只精修浅色一套;原 `dark`(深空科技)/`warm`(暖橙)作为令牌变体保留(令牌化后换肤廉价),后续派生或再做(§9 待确认是否三套都做)。

### 5.2 逐屏移植(HTML -> Vue SFC)
- 每屏:读 `Opendesign/<name>.html`,把 HTML 结构翻成对应 Vue `<template>`;**样式以 scoped CSS 直接镜像 OpenDesign 的样式表(其已用 `--od-*` 令牌),保证还原度;Tailwind 工具类仅用于布局便捷,不得用于颜色/字体/间距的硬编码**。
- 利用 `data-od-id` 钩子定位语义区与行为绑定点(按钮、输入、锁徽标等),保留 id/事件名以便接回原有逻辑。
- **服务接回**:该视图原有 `api.ts` 调用与响应式状态接回新模板(逻辑不动,只换皮)。
- **还原度**:布局/结构像素级贴 HTML;颜色/字体/间距一律映射到令牌(不照抄 HTML 内具体色值)。

---

## 6. Univer 边界(关键)

- `workbook-shell.html` 只含外壳(顶栏:返回/店名/月份/锁徽标/编辑/保存并同步;表签:经营报表/收入对账/费用明细/资金台账;表格区=占位)。
- 移植时:保留原 Univer 挂载点与 `univer.ts` 初始化逻辑**原样**,只把外壳 DOM 的 class/样式换成新外观。
- **禁动清单**:`univer.ts`、锁/心跳/保存/同步的任何逻辑与 API 调用;锁徽标/按钮的**行为绑定点**(id、事件)保持不变,仅外观换新。
- 进入路径变化:现在经"公司经营 -> 选店"进入工作簿(原为 ShopList 直选),但工作簿内部行为不变。

---

## 7. 新增模块:员工管理

后端已就绪(`server/src/rbac/user.routes.ts`),前端从未接入。本期补齐前端屏。

- **API 接入**:`web/src/api.ts` 新增 `listUsers / createUser / updateUser / disableUser`(对应 `GET/POST/PATCH/DELETE /api/users`)。
- **类型扩展**:`web/src/types.ts` 的 `User` 补 `phone / status / created_at`。
- **新视图** `web/src/views/Employees.vue`:用户表(姓名/账号/角色/部门/手机/状态/操作)+ 新建弹窗(姓名/账号/密码/角色/部门/手机)+ 编辑/禁用。
- **角色可见性与限制**(与后端 RBAC 一致):
  - 董事长:管全部用户含经理;可建经理/员工。
  - 经理:管本部门员工;只能建员工。
  - 员工:侧边栏不显示"员工管理"。
- 外观移植自 `Opendesign/employees.html`(含董事长/经理两态标注)。

## 8. 新增:App 外壳与 ShopList 重构

- `web/src/App.vue`:登录后渲染"侧边栏 + 顶栏 + 内容区"路由,侧边栏切模块;现有 ShopList 枢纽式按钮退场。
- `ShopList.vue` 重构为"公司经营"下的店铺选择子页:按 `business_code` 分组(暂仅足浴店),5 店卡片;点店经父级进入 Workbook。
- 外壳外观移植自 `Opendesign/app-shell.html`;公司经营 drill 移植自 `Opendesign/company-ops.html`。

---

## 9. 待确认(开放项)

1. **品牌名**:OpenDesign 用"静水楼台企业智能经营系统";本项目原用"多部门智能经营系统"。是否采用"静水楼台"?(影响登录页/外壳标题文字。)
2. **多主题**:只精修浅色一套(深空/暖橙留作令牌变体),还是三套都做?
3. **额外产物**:`Opendesign/index.html`(设计索引)、`landing.html`(营销落地页)是否需要落地为应用的一部分?默认忽略。

---

## 10. 验证

每屏移植后:
1. `web` 构建通过(`vue-tsc` + `vite build`)。
2. 该屏 `api.ts` 调用回归正常。
3. **Workbook 屏额外**:Univer 加载/占锁/心跳/保存同步全链路不变;锁徽标两态正确。
4. **员工管理屏**:RBAC 验证(经理不能建经理、不能管别部门;员工看不到入口)。
5. 令牌化后:浅色主题全站一致,无硬编码颜色残留。

---

## 11. 风险

1. **Univer 边界**(关键):移植 Workbook 外壳时误动挂载点或锁逻辑 -> 严守 §6 禁动清单,单独验证。
2. **CSS 现代特性**:OpenDesign 用 `color-mix`/`backdrop-filter`/grid;Vue 移植需保证目标浏览器支持或给降级。
3. **品牌名/多主题**:§9 未定前避免在多处硬编码品牌串。

---

## 附录 A · OpenDesign 提示词包(已用于生成 §2 产物,留存备迭代)

> 用法:① 先跑 P0 得令牌规范 -> `Opendesign/design-system.md`;② 每屏在 OpenDesign 选 prototype 模板,粘贴 P1–P8,生成 HTML 存 `Opendesign/<name>.html`;③ 每份 HTML 自包含(`<style>` 内联 `:root` 令牌 + 本屏样式);④ workbook-shell 表格区为占位,不画表格。

### P0 · 设计系统令牌
为「多部门智能经营系统-足浴财务模块」定义前端设计系统令牌。视觉方向:商务浅色精修。输出 CSS `:root` `--od-*` 变量(颜色表面/主色/语义/5店色/语义软底、字体字号字重、间距、圆角、阴影)+ 说明表 + 配色逻辑。不输出具体页面。

### P1 · 登录页(login.html)
分屏:左品牌视觉(渐变+标语+预览卡),右表单(品牌标+标题+账号/密码+登录+错误态+默认账号 boss/boss123·mgr/mgr123)。用 `--od-*` 令牌,含 hover/focus/错误态。

### P2 · 侧边栏外壳(app-shell.html)
左栏(品牌标+模块项:数据大屏/公司经营/AI分析/AI每日海报/员工管理;激活态高亮;员工管理标注"仅董事长/经理可见")+ 顶栏(全局月份+用户名+退出)+ 内容区。含折叠态。

### P3 · 数据大屏(dashboard.html)
KPI 卡(营收/客流/客单价/充值)+ 任务仪表(落后标 danger)+ 营收趋势 + 5店排名(palette)+ 业务结构 + 支付渠道 + 费用Top。图表用 CSS/SVG 占位。商务浅色。

### P4 · 公司经营(company-ops.html)
drill+面包屑。状态A 业务卡(仅足浴店+新增占位);状态B 5店卡片网格。点店进 Univer(不画表格)。

### P5 · AI 分析(ai-chat.html)
模型标识条 + 消息流(用户/AI 气泡,AI 含简报卡)+ 输入框。含空态/加载态/示例问答。

### P6 · AI 每日海报(ai-poster.html)
左配置(店/日期/风格/提示词/生成)+ 右预览(竖版1080×1920+下载/重生成)。含生成中/完成态。

### P7 · 员工管理(employees.html)
用户表+新建弹窗+编辑/禁用。两态:董事长(可建经理+员工,管全部)/经理(只建员工,本部门)。含禁用确认弹窗。

### P8 · Workbook 外壳(workbook-shell.html)
仅外壳:顶栏(返回/店名/月份/锁徽标/编辑/保存并同步)+ 表签(经营报表/收入对账/费用明细/资金台账)+ 表格区占位(标注禁动)。锁徽标两态:被占用(接管)/可编辑。绝不画真实表格。
