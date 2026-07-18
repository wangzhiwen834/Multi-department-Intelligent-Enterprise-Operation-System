# OpenDesign 外观重皮 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 `Opendesign/` 产出的 HTML+令牌,就地重皮现有 Vue 3 前端,新增侧边栏外壳与员工管理模块,不动 Univer 业务功能与后端服务。

**Architecture:** 方案 3(令牌 + 逐屏移植)。先落 `--od-*` 令牌基底;重写 `App.vue` 为侧边栏外壳 + 模块路由;逐屏把 `Opendesign/<name>.html` 移植进对应 Vue SFC(保留各视图原有 `<script setup>` 逻辑,只换 `<template>`+`<style scoped>`,样式消费令牌);新增 `Employees.vue` 接现有 `/api/users` 后端;`Workbook.vue` 仅重做顶栏外壳,Univer 挂载点与锁/心跳/保存逻辑原样不动。

**Tech Stack:** Vue 3.5 + Vite 6 + Tailwind 3.4 + ECharts 5 + @univerjs/preset-sheets-core 1.0.0-alpha.3;后端 Express+pg(不动)。

## Global Constraints

- **无前端测试框架**:每任务验收门 = `cd web && npm run build`(`vue-tsc --noEmit && vite build` 通过)+ 任务内写明的手动验证。后端 `server/` 不改、不跑其测试。
- **品牌串**:"静水楼台企业智能经营系统"(登录页/外壳标题统一使用,集中写在 `App.vue`/`Login.vue` 内)。
- **令牌**:颜色/字体/间距/圆角/阴影一律用 `--od-*` CSS 变量(取自 `Opendesign/design-system.md` §1);视图不得硬编码颜色(白色文字/渐变除外)。
- **Univer 边界**:`Workbook.vue` 内 `setupUniver` 调用、`containerRef` 绑定、锁/心跳/保存/同步逻辑与 `univer.ts` 禁动;只重做围绕 `containerRef` 的顶栏外壳样式。
- **后端不动**:仅 `web/src/api.ts` 扩展员工管理 4 个方法、`web/src/types.ts` 扩展 `User` 字段;`server/` 一行不改。
- **仅浅色一套主题**:`THEMES` 保留供 ECharts 取色(`light` 对齐 OpenDesign 令牌),`dark`/`warm` 不再使用。
- **每任务结束 commit**:`git add <files> && git commit -m "..."`。
- 工作目录:`web/` 下跑构建;项目根跑 git。

---

## File Structure

| 文件 | 动作 | 职责 |
|---|---|---|
| `web/src/styles/tokens.css` | 创建 | `:root` `--od-*` 令牌块(取自 design-system.md),全站基底 |
| `web/src/main.ts` | 改 | 引入 `tokens.css` |
| `web/src/theme.ts` | 改 | `THEMES.light` 对齐 OpenDesign 令牌(供 ECharts) |
| `web/src/App.vue` | 改(重写) | 侧边栏外壳 + 顶栏(月份/用户/退出)+ 模块路由 + 角色门控 |
| `web/src/api.ts` | 改 | 加 `listUsers/createUser/updateUser/disableUser` |
| `web/src/types.ts` | 改 | `User` 加 `phone/status/created_at` |
| `web/src/views/Employees.vue` | 创建 | 员工管理(董事长/经理两态),接 `/api/users` |
| `web/src/views/Login.vue` | 改 | 移植 `login.html`,保留登录逻辑,品牌静水楼台 |
| `web/src/views/ShopList.vue` | 改 | 移植 `company-ops.html`,改为公司经营 drill(业务->店铺) |
| `web/src/views/Dashboard.vue` | 改 | 移植 `dashboard.html` 卡片布局,保留 ECharts,去主题切换 |
| `web/src/views/Chat.vue` | 改 | 移植 `ai-chat.html`,保留对话逻辑 |
| `web/src/views/Poster.vue` | 改 | 移植 `ai-poster.html`,保留生成/合成/下载逻辑 |
| `web/src/views/Workbook.vue` | 改 | 仅移植 `workbook-shell.html` 顶栏;`containerRef`+锁逻辑不动 |

---

## Task 1: 令牌基底

**Files:**
- Create: `web/src/styles/tokens.css`
- Modify: `web/src/main.ts`
- Modify: `web/src/theme.ts`

**Interfaces:**
- Produces: 全局 `--od-*` CSS 变量(供所有视图 scoped 样式引用);`THEMES.light` 对齐令牌(供 Dashboard ECharts)。

- [ ] **Step 1: 创建 `web/src/styles/tokens.css`**

完整内容(取自 `Opendesign/design-system.md` §1,逐字复制 `:root` 块):

```css
:root{
  --od-bg:#f7f9fc;--od-surface:#ffffff;--od-surface-2:#f1f5f9;--od-border:#e2e8f0;
  --od-text:#0f172a;--od-text-muted:#64748b;--od-primary:#2563eb;--od-primary-hover:#1d4ed8;
  --od-gold:#d4a017;--od-success:#16a34a;--od-warning:#f59e0b;--od-danger:#ef4444;
  --od-palette-1:#0ea5e9;--od-palette-2:#3b82f6;--od-palette-3:#14b8a6;--od-palette-4:#8b5cf6;--od-palette-5:#f59e0b;
  --od-primary-soft:#dbeafe;--od-success-soft:#dcfce7;--od-warning-soft:#fef3c7;--od-danger-soft:#fee2e2;--od-gold-soft:#fef3c7;
  --od-font-sans:"Inter","PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,-apple-system,sans-serif;
  --od-font-mono:"JetBrains Mono","SF Mono","Cascadia Code",Consolas,ui-monospace,monospace;
  --od-text-xs:12px;--od-text-sm:13px;--od-text-base:14px;--od-text-lg:16px;--od-text-xl:18px;--od-text-2xl:24px;
  --od-weight-normal:400;--od-weight-medium:500;--od-weight-semibold:600;--od-weight-bold:700;
  --od-space-1:4px;--od-space-2:8px;--od-space-3:12px;--od-space-4:16px;--od-space-5:20px;--od-space-6:24px;--od-space-7:32px;--od-space-8:40px;
  --od-radius-sm:6px;--od-radius-md:8px;--od-radius-lg:12px;--od-radius-xl:16px;--od-radius-full:9999px;
  --od-shadow-sm:0 1px 2px rgba(15,23,42,.04),0 1px 3px rgba(15,23,42,.06);
  --od-shadow-md:0 4px 12px rgba(15,23,42,.06),0 2px 4px rgba(15,23,42,.04);
  --od-shadow-lg:0 12px 32px rgba(15,23,42,.10),0 4px 12px rgba(15,23,42,.06);
  --od-sidebar-w:232px;--od-sidebar-w-collapsed:64px;--od-topbar-h:56px;
}
```

- [ ] **Step 2: `web/src/main.ts` 引入令牌**

在 `import './style.css';` 之后加一行:

```ts
import { createApp } from 'vue';
import App from './App.vue';
import './style.css';
import './styles/tokens.css';

createApp(App).mount('#root');
```

- [ ] **Step 3: `web/src/theme.ts` 把 `light` 对齐 OpenDesign 令牌**

将 `THEMES.light` 改为(其余 `dark`/`warm` 保留不动,但不再使用):

```ts
  light: {
    key: 'light', label: '商务浅色',
    bg: '#f7f9fc', cardBg: '#ffffff', cardBorder: '#e2e8f0',
    text: '#0f172a', subText: '#64748b', accent: '#2563eb', gold: '#d4a017',
    palette: ['#0ea5e9', '#3b82f6', '#14b8a6', '#8b5cf6', '#f59e0b'],
    success: '#16a34a', warning: '#f59e0b', danger: '#ef4444',
  },
```

- [ ] **Step 4: 构建验证**

Run: `cd web && npm run build`
Expected: vue-tsc 无错、vite build 成功。

- [ ] **Step 5: Commit**

```bash
git add web/src/styles/tokens.css web/src/main.ts web/src/theme.ts
git commit -m "feat(web): 引入 OpenDesign --od-* 令牌基底,light 主题对齐"
```

---

## Task 2: App 侧边栏外壳 + 模块路由

**Files:**
- Modify: `web/src/App.vue`(重写)

**Interfaces:**
- Consumes: `api`(me/login)、`getToken/setToken/clearToken`、视图组件、`User/Shop` 类型。
- Produces: 登录后外壳:侧边栏(数据大屏/公司经营/AI分析/AI每日海报/员工管理[角色门控])+ 顶栏(全局月份/用户/退出)+ 内容区路由;`period` 在此持有,各视图经 `props` 取、`update:period` 回写。

- [ ] **Step 1: 重写 `web/src/App.vue` 的 `<script setup>`**

```ts
import { ref, computed, onMounted } from 'vue';
import { api, getToken, setToken, clearToken } from './api';
import type { Shop, User } from './types';
import Login from './views/Login.vue';
import ShopList from './views/ShopList.vue';
import Workbook from './views/Workbook.vue';
import Dashboard from './views/Dashboard.vue';
import Chat from './views/Chat.vue';
import Poster from './views/Poster.vue';
import Employees from './views/Employees.vue';

type Module = 'dashboard' | 'ops' | 'chat' | 'poster' | 'employees';

const BRAND = '静水楼台企业智能经营系统';
const user = ref<User | null>(null);
const booted = ref(false);
const module = ref<Module>('dashboard');
const shop = ref<Shop | null>(null);
const period = ref(new Date().toISOString().slice(0, 7));

onMounted(() => {
  if (getToken()) {
    api.me().then(u => { user.value = u; booted.value = true; }).catch(() => { clearToken(); booted.value = true; });
  } else { booted.value = true; }
});

const onLogin = (u: User, t: string) => { setToken(t); user.value = u; module.value = 'dashboard'; };
const onLogout = () => { clearToken(); user.value = null; shop.value = null; };
const onPick = (s: Shop) => { shop.value = s; };          // 公司经营 -> 选店 -> 进 Workbook
const onBackToOps = () => { shop.value = null; };          // Workbook 返回 -> 回店铺列表
const setModule = (m: Module) => { if (m !== 'ops') shop.value = null; module.value = m; };

const showEmployees = computed(() => user.value?.role === 'chairman' || user.value?.role === 'manager');
const sidebarItems = computed(() => {
  const items: { key: Module; label: string; icon: string }[] = [
    { key: 'dashboard', label: '数据大屏', icon: '📊' },
    { key: 'ops', label: '公司经营', icon: '🏢' },
    { key: 'chat', label: 'AI 分析', icon: '🤖' },
    { key: 'poster', label: 'AI 每日海报', icon: '🎨' },
  ];
  if (showEmployees.value) items.push({ key: 'employees', label: '员工管理', icon: '👥' });
  return items;
});
const activeLabel = computed(() => sidebarItems.value.find(i => i.key === module.value)?.label ?? '');
```

- [ ] **Step 2: 重写 `web/src/App.vue` 的 `<template>`**

DOM 结构与 class 名取自 `Opendesign/app-shell.html`(侧边栏 + 顶栏 + 内容区),在此结构上加 Vue 绑定:

```html
<template>
  <Login v-if="!user" @login="onLogin" />

  <div v-else class="od-shell" :data-od-active="module">
    <!-- 侧边栏:结构/样式取 app-shell.html,下方为绑定契约 -->
    <aside class="od-sidebar">
      <div class="od-brand">{{ BRAND }}</div>
      <nav class="od-nav">
        <button v-for="it in sidebarItems" :key="it.key"
          class="od-nav-item" :class="{ active: module === it.key || (it.key === 'ops' && shop) }"
          @click="setModule(it.key)">
          <span class="od-ico">{{ it.icon }}</span><span>{{ it.label }}</span>
        </button>
      </nav>
    </aside>

    <div class="od-main">
      <!-- 顶栏:全局月份 + 用户 + 退出 -->
      <header class="od-topbar">
        <h1 class="od-module-title">{{ activeLabel }}</h1>
        <div class="od-top-right">
          <input type="month" :value="period"
            @change="period = ($event.target as HTMLInputElement).value" class="od-month" />
          <span class="od-user">{{ user?.name }} · {{ user?.role === 'chairman' ? '董事长' : user?.role === 'manager' ? '经理' : '员工' }}</span>
          <button class="od-logout" @click="onLogout">退出</button>
        </div>
      </header>

      <!-- 内容区 -->
      <main class="od-content">
        <Dashboard v-if="module === 'dashboard'" v-model:period="period" />
        <ShopList v-else-if="module === 'ops' && !shop" :user="user" @pick="onPick" />
        <Workbook v-else-if="module === 'ops' && shop" :shop="shop" v-model:period="period" @back="onBackToOps" />
        <Chat v-else-if="module === 'chat'" v-model:period="period" />
        <Poster v-else-if="module === 'poster'" />
        <Employees v-else-if="module === 'employees'" :user="user" />
      </main>
    </div>
  </div>

  <div v-if="!booted" class="od-booting">加载中…</div>
</template>
```

> 说明:各视图原有 `@back`/`v-model:period` 契约保留;`Dashboard`/`Chat` 原先的 `@back` 不再需要(侧边栏切换代替),但保留 emit 不影响。`ShopList` 不再需要 dashboard/chat/poster 按钮(已在侧边栏),只发 `@pick`。

- [ ] **Step 3: `web/src/App.vue` 加 `<style scoped>`**

把 `Opendesign/app-shell.html` 的 `<style>` 里侧边栏/顶栏/内容区的样式复制进 `<style scoped>`,全部用 `--od-*` 令牌(不硬编码颜色)。关键类:`.od-shell`(grid: 侧栏 + main)、`.od-sidebar`(`width:var(--od-sidebar-w)`)、`.od-nav-item.active`(`background:var(--od-primary-soft);color:var(--od-primary)` )、`.od-topbar`(`height:var(--od-topbar-h)`)、`.od-month/.od-user/.od-logout`、`.od-content`(flex-1 overflow-auto)。

- [ ] **Step 4: 构建验证**

Run: `cd web && npm run build`
Expected: 通过。

- [ ] **Step 5: 手动验证**

启动后端+前端,用 `boss/boss123` 登录 -> 看到侧边栏 5 项 + 顶栏(月份/用户/退出);点各模块切换;`mgr` 登录也见"员工管理";(员工账号暂无,跳过)。

- [ ] **Step 6: Commit**

```bash
git add web/src/App.vue
git commit -m "feat(web): 侧边栏外壳+顶栏+模块路由(角色门控员工管理)"
```

---

## Task 3: 员工管理后端接入(api + 类型)

**Files:**
- Modify: `web/src/api.ts`
- Modify: `web/src/types.ts`

**Interfaces:**
- Consumes: 后端 `GET/POST/PATCH/DELETE /api/users`(已存在,RBAC 在后端)。
- Produces: `api.listUsers/createUser/updateUser/disableUser`;`User` 含 `phone/status/created_at`。

- [ ] **Step 1: `web/src/types.ts` 扩展 `User`**

```ts
export interface User {
  id: number; username: string; name: string; role: string; department: string | null;
  phone?: string; status?: 'active' | 'disabled'; created_at?: string;
}
```

- [ ] **Step 2: `web/src/api.ts` 加 4 个方法**

在 `api` 对象内(`posterGenerate` 之后)追加:

```ts
  listUsers: () => req<User[]>('/api/users'),
  createUser: (b: { username: string; password: string; name: string; role: 'manager' | 'employee'; department?: string | null; phone?: string }) =>
    req<User>('/api/users', { method: 'POST', body: JSON.stringify(b) }),
  updateUser: (id: number, b: { name?: string; phone?: string; status?: 'active' | 'disabled'; department?: string | null }) =>
    req<User>(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify(b) }),
  disableUser: (id: number) =>
    req<{ ok: boolean }>(`/api/users/${id}`, { method: 'DELETE' }),
```

- [ ] **Step 3: 构建验证**

Run: `cd web && npm run build`
Expected: 通过(`User` 新字段兼容现有用法)。

- [ ] **Step 4: Commit**

```bash
git add web/src/api.ts web/src/types.ts
git commit -m "feat(web): api.ts 加员工管理 4 方法,User 扩字段"
```

---

## Task 4: 员工管理视图 Employees.vue

**Files:**
- Create: `web/src/views/Employees.vue`

**Interfaces:**
- Consumes: `api.listUsers/createUser/updateUser/disableUser`;`props.user`(当前登录用户,判定角色)。
- Produces: 员工管理屏(董事长:全员含经理,可建经理/员工;经理:本部门员工,只建员工)。

- [ ] **Step 1: 创建 `web/src/views/Employees.vue` 的 `<script setup>`**

```ts
import { ref, computed, onMounted } from 'vue';
import { api } from '../api';
import type { User } from '../types';

const props = defineProps<{ user: User | null }>();

const users = ref<User[]>([]);
const loading = ref(false);
const err = ref('');
const showCreate = ref(false);
const form = ref({ username: '', password: '', name: '', role: 'employee' as 'manager' | 'employee', department: '', phone: '' });
const creating = ref(false);

const isChairman = computed(() => props.user?.role === 'chairman');
const createableRoles = computed(() => isChairman.value ? ['manager', 'employee'] : ['employee']);

const refresh = async () => {
  loading.value = true; err.value = '';
  try { users.value = await api.listUsers(); } catch (e: any) { err.value = e.message; } finally { loading.value = false; }
};
onMounted(refresh);

const openCreate = () => {
  form.value = { username: '', password: '', name: '', role: 'employee', department: props.user?.department ?? '', phone: '' };
  showCreate.value = true;
};
const create = async () => {
  creating.value = true; err.value = '';
  try {
    await api.createUser({
      username: form.value.username, password: form.value.password, name: form.value.name,
      role: form.value.role, department: form.value.department || null, phone: form.value.phone,
    });
    showCreate.value = false; await refresh();
  } catch (e: any) { err.value = e.message; } finally { creating.value = false; }
};
const toggleStatus = async (u: User) => {
  try { await api.updateUser(u.id, { status: u.status === 'disabled' ? 'active' : 'disabled' }); await refresh(); }
  catch (e: any) { err.value = e.message; }
};
const remove = async (u: User) => {
  if (!confirm(`确认禁用账号 ${u.username}?`)) return;
  try { await api.disableUser(u.id); await refresh(); } catch (e: any) { err.value = e.message; }
};

const roleLabel = (r: string) => r === 'chairman' ? '董事长' : r === 'manager' ? '经理' : '员工';
```

- [ ] **Step 2: 创建 `<template>`(结构与 class 取自 `Opendesign/employees.html`)**

```html
<template>
  <div class="od-employees">
    <div class="od-toolbar">
      <span class="od-scope">{{ isChairman ? '全员(含经理)' : '本部门员工' }}</span>
      <button class="od-btn-primary" @click="openCreate">+ 新建{{ isChairman ? '经理/员工' : '员工' }}</button>
    </div>
    <div v-if="err" class="od-err">{{ err }}</div>
    <table class="od-table">
      <thead><tr><th>姓名</th><th>账号</th><th>角色</th><th>部门</th><th>手机</th><th>状态</th><th>操作</th></tr></thead>
      <tbody>
        <tr v-for="u in users" :key="u.id">
          <td>{{ u.name }}</td><td class="num">{{ u.username }}</td><td>{{ roleLabel(u.role) }}</td>
          <td>{{ u.department ?? '-' }}</td><td class="num">{{ u.phone ?? '-' }}</td>
          <td><span class="od-badge" :class="u.status === 'disabled' ? 'danger' : 'success'">{{ u.status === 'disabled' ? '禁用' : '启用' }}</span></td>
          <td>
            <button class="od-btn-ghost" @click="toggleStatus(u)">{{ u.status === 'disabled' ? '启用' : '禁用' }}</button>
            <button class="od-btn-ghost" @click="remove(u)">删除</button>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- 新建弹窗:结构取 employees.html 的弹窗 -->
    <div v-if="showCreate" class="od-modal-mask" @click.self="showCreate = false">
      <div class="od-modal">
        <h3>新建{{ isChairman ? '经理/员工' : '员工' }}</h3>
        <label>姓名<input v-model="form.name" class="od-input" /></label>
        <label>账号<input v-model="form.username" class="od-input" /></label>
        <label>密码<input v-model="form.password" type="password" class="od-input" /></label>
        <label>角色
          <select v-model="form.role" class="od-input">
            <option v-for="r in createableRoles" :key="r" :value="r">{{ roleLabel(r) }}</option>
          </select>
        </label>
        <label>部门<input v-model="form.department" class="od-input" /></label>
        <label>手机<input v-model="form.phone" class="od-input" /></label>
        <div v-if="err" class="od-err">{{ err }}</div>
        <div class="od-modal-foot">
          <button class="od-btn-ghost" @click="showCreate = false">取消</button>
          <button class="od-btn-primary" :disabled="creating" @click="create">创建</button>
        </div>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 3: 加 `<style scoped>`**

把 `Opendesign/employees.html` 的 `<style>` 复制进来,用 `--od-*` 令牌;关键类:`.od-table`(表头 `--od-surface-2` 底)、`.od-badge.success/.danger`(软底)、`.od-btn-primary`(`--od-primary`)、`.od-modal`(`--od-shadow-lg` + `--od-radius-xl`)、`.od-input`(focus 环 `--od-primary-soft`)。`.num` 用 `--od-font-mono`。

- [ ] **Step 4: 构建验证**

Run: `cd web && npm run build`
Expected: 通过。

- [ ] **Step 5: 手动验证 RBAC**

`boss` 登录 -> 员工管理:见全员,新建弹窗角色下拉含 经理/员工,能建经理;`mgr` 登录 -> 只见本部门,角色下拉仅 员工,尝试建经理应被后端 403(前端不暴露该选项即可)。

- [ ] **Step 6: Commit**

```bash
git add web/src/views/Employees.vue
git commit -m "feat(web): 员工管理视图(董事长/经理两态,接 /api/users)"
```

---

## Task 5: Login.vue 移植

**Files:**
- Modify: `web/src/views/Login.vue`

**保留逻辑(原 `<script setup>` 不动):** `username/password/err` refs;`submit()` 调 `api.login` 并 `emit('login', r.user, r.token)`;`emit('login', u, t)`。

- [ ] **Step 1: 移植 `<template>`**

以 `Opendesign/login.html` 为准:左半品牌区(渐变 + 标语"多部门智能经营平台 / 让经营数据自己说话" + 预览卡),右半表单。品牌文字用"静水楼台企业智能经营系统"。把静态 `value="boss"` 的输入绑到 `v-model="username"`/`v-model="password"`;登录按钮 `@click="submit"`(或 form `@submit.prevent="submit"`);错误位绑 `v-if="err"`。`扫码登录` tab 保留为视觉(无后端,置 disabled);`账号密码登录` 为功能 tab。默认账号提示保留 `boss/boss123 · mgr/mgr123`。

- [ ] **Step 2: 移植 `<style scoped>`**

复制 `login.html` 的 `<style>`(已用 `--od-*`),去掉 `:root` 块(令牌已在 tokens.css 全局)。

- [ ] **Step 3: 构建验证**

Run: `cd web && npm run build` -> 通过。

- [ ] **Step 4: 手动验证**

打开登录页:分屏品牌+表单外观;输 `boss/boss123` 登录成功进外壳;错密码显错误态。

- [ ] **Step 5: Commit**

```bash
git add web/src/views/Login.vue
git commit -m "feat(web): Login 移植 OpenDesign 分屏设计(品牌静水楼台)"
```

---

## Task 6: ShopList.vue -> 公司经营 drill

**Files:**
- Modify: `web/src/views/ShopList.vue`

**保留逻辑:** `shops` ref;`onMounted` 调 `api.shops()`;`err`。**移除:** dashboard/chat/poster 按钮、月份、用户名、退出(已移入外壳顶栏/侧边栏)。**新增:** 按 `business_code` 分组(暂仅足浴店);emit `pick(shop)`。

- [ ] **Step 1: 改 `<script setup>`**

```ts
import { ref, computed, onMounted } from 'vue';
import { api } from '../api';
import type { Shop, User } from '../types';

defineProps<{ user: User | null }>();
const emit = defineEmits<{ (e: 'pick', s: Shop): void }>();

const shops = ref<Shop[]>([]);
const err = ref('');
onMounted(() => { api.shops().then(r => shops.value = r).catch(e => err.value = e.message); });

// 按 business 分组(暂仅足浴店;未来新增业务自动成组)
const groups = computed(() => {
  const m = new Map<string, { code: string; name: string; shops: Shop[] }>();
  for (const s of shops.value) {
    const g = m.get(s.business_code) ?? { code: s.business_code, name: s.business_name, shops: [] };
    g.shops.push(s); m.set(s.business_code, g);
  }
  return [...m.values()];
});
```

- [ ] **Step 2: 移植 `<template>`(取 `Opendesign/company-ops.html`)**

面包屑"公司经营";业务卡片网格:每个 group 一张卡(`{{ g.name }}`)+ 一张"后续新增业务"虚线占位卡;点业务卡 -> 展开该 group 的 5 店卡片网格(店名 + 业务名 + 进入箭头),点店 `@click="emit('pick', s)"`。可单页两态(业务列表 / 选中业务的店铺列表)用 `ref` 切换,或直接同页上下排列均可,以 company-ops.html 为准。

- [ ] **Step 3: 移植 `<style scoped>`**

复制 company-ops.html 样式,用 `--od-*`;5 店卡片可用 `--od-palette-1..5` 作店标色(`:style` 内联按 index 取)。

- [ ] **Step 4: 构建验证**

Run: `cd web && npm run build` -> 通过。

- [ ] **Step 5: 手动验证**

`boss` 登录 -> 侧边栏"公司经营" -> 见业务卡(足浴店)-> 点进见 5 店 -> 点店进 Univer 工作簿。

- [ ] **Step 6: Commit**

```bash
git add web/src/views/ShopList.vue
git commit -m "feat(web): ShopList 改为公司经营 drill(业务->店铺,OpenDesign 样式)"
```

---

## Task 7: Dashboard.vue 移植

**Files:**
- Modify: `web/src/views/Dashboard.vue`

**保留逻辑(原 `<script setup>` 几乎全保留):** `period` prop、`update:period`/`back` emits;`themeKey='light'`、`theme=THEMES['light']`、`shops/shopId/data/err`;`fetch()`、`watch`;ECharts options(`trendOpt/rankingOpt/structOpt/payOpt/expOpt`)、`onRankingClick`、`kpiCards`、`money`、`Chart` 组件。**移除:** 顶栏主题切换按钮(只浅色)、顶栏月份输入(已在外壳顶栏)、`@back` 按钮(侧边栏切换)。**调整:** `theme` 恒为 `THEMES['light']`(对齐令牌)。

- [ ] **Step 1: 调整 `<script setup>`**

删除 `themeKey` ref 与主题切换相关;`theme` 改为 `const theme = THEMES['light'];`。其余 ECharts/money/kpiCards 逻辑保留。`back` emit 可保留不用。

- [ ] **Step 2: 移植 `<template>`(取 `Opendesign/dashboard.html` 卡片布局)**

用 dashboard.html 的卡片外壳/栅格布局替换现有;KPI 卡绑 `kpiCards`;任务仪表绑 `taskPct/timePct/behind`;图表区**保留真实 `<Chart :option=... />` 组件**(dashboard.html 里是 CSS/SVG 占位,我们用真 ECharts 填入对应卡槽),`rankingOpt` 的 `Chart` 保留 `:on-click="onRankingClick"`。顶栏不再放月份/主题(外壳已提供),本屏顶部可留店铺筛选 `select`(全部5店/单店)绑 `shopId`。

- [ ] **Step 3: 移植 `<style scoped>`**

复制 dashboard.html 样式,用 `--od-*`;5 店排名用 `--od-palette-1..5`;落后用 `--od-danger`。

- [ ] **Step 4: 构建验证**

Run: `cd web && npm run build` -> 通过。

- [ ] **Step 5: 手动验证**

`boss` 登录 -> 数据大屏:KPI/趋势/5店排名(点柱钻取)/业务结构/支付渠道/费用Top 均渲染;切月份/单店数据刷新。

- [ ] **Step 6: Commit**

```bash
git add web/src/views/Dashboard.vue
git commit -m "feat(web): Dashboard 移植 OpenDesign 卡片布局,保留 ECharts,仅浅色"
```

---

## Task 8: Chat.vue 移植

**Files:**
- Modify: `web/src/views/Chat.vue`

**保留逻辑(原 `<script setup>` 全保留):** `period` prop、`back` emit;`messages/input/loading/listRef/model`;`send()`、`scroll()`、`suggestions`、`ask()`;`api.aiChat/aiInfo`。

- [ ] **Step 1: 移植 `<template>`(取 `Opendesign/ai-chat.html`)**

顶部模型标识条绑 `{{ model || '加载中…' }}`;消息流 `v-for="(m,i) in messages"` 绑气泡(user 右/assistant 左,`{{ m.content }}`);`v-if="loading"` 思考中态;建议 `v-for="s in suggestions"` `@click="ask(s)"`;输入框 `v-model="input"` + 发送 `@submit.prevent="send"`。移除原 `@back` 按钮(侧边栏切换)。

- [ ] **Step 2: 移植 `<style scoped>`**

复制 ai-chat.html 样式,用 `--od-*`;用户气泡 `--od-primary`,AI 气泡 `--od-surface` + `--od-border`。

- [ ] **Step 3: 构建验证**

Run: `cd web && npm run build` -> 通过。

- [ ] **Step 4: 手动验证**

`boss` 登录 -> AI 分析:发问"本月总营收多少?"-> AI 调工具回简报;模型标识显示;建议点击可发送。

- [ ] **Step 5: Commit**

```bash
git add web/src/views/Chat.vue
git commit -m "feat(web): Chat 移植 OpenDesign 对话面板"
```

---

## Task 9: Poster.vue 移植

**Files:**
- Modify: `web/src/views/Poster.vue`

**保留逻辑(原 `<script setup>` 全保留):** `back` emit;`shops/shopId/prompt/date/caption/loading/err/bgImage/posterDataUrl/model`;`shopName`、`compose()`(Canvas 合成)、`generate()`、`watch`、`download()`;`api.posterGenerate/aiInfo/shops`。

- [ ] **Step 1: 移植 `<template>`(取 `Opendesign/ai-poster.html`)**

左配置区:店铺 `select v-model="shopId"`、日期 `input v-model="date"`、风格(可选保留视觉)、提示词 `textarea v-model="prompt"`、文案 `input v-model="caption"`、生成按钮 `@click="generate" :disabled="loading"`(文案 `loading?'生成中…':'生成海报'`);右预览区:`v-if="!posterDataUrl"` 占位,`v-else <img :src="posterDataUrl">` + 下载 `@click="download"`。模型标识绑 `{{ model }}`。移除 `@back`。

- [ ] **Step 2: 移植 `<style scoped>`**

复制 ai-poster.html 样式,用 `--od-*`;预览竖版 1080×1920 比例框。

- [ ] **Step 3: 构建验证**

Run: `cd web && npm run build` -> 通过。

- [ ] **Step 4: 手动验证**

`boss` 登录 -> AI 每日海报:选店/日期/提示词/文案 -> 生成 -> 预览(文生图背景+Canvas 文字叠加)-> 下载。

- [ ] **Step 5: Commit**

```bash
git add web/src/views/Poster.vue
git commit -m "feat(web): Poster 移植 OpenDesign 生成页布局"
```

---

## Task 10: Workbook.vue 外壳移植(Univer 边界 · 关键)

**Files:**
- Modify: `web/src/views/Workbook.vue`

**禁动(原 `<script setup>` 全部保留,一行不改):** `containerRef`、`setupUniver/buildFromTemplate/extractForSync`、`SHEET_KEY`、`editing/holder/msg/syncResult/busy`、`startEdit/endEdit/takeover/save/startHeartbeat/stopHeartbeat/releaseIfMine`、`onMounted/onBeforeUnmount`、`shop/period` props、`back/update:period` emits。

**只改 `<template>`+加 `<style scoped>`:** 把原 header 换成 `Opendesign/workbook-shell.html` 的顶栏(返回/店名/月份/锁徽标/编辑/保存并同步)。**不要**移植 sheet tabs 与 grid 占位 -- Univer 在 `containerRef` 内原生渲染自己的表签与表格;`containerRef` 那个 `<div>` 就是表格区,保留原样。

- [ ] **Step 1: 替换 `<template>`**

```html
<template>
  <div class="od-wb">
    <!-- 顶栏:结构取 workbook-shell.html -->
    <div class="od-wb-topbar">
      <div class="od-tb-left">
        <button class="od-icon-btn" @click="emit('back')" title="返回">←</button>
        <div class="od-store"><span class="od-store-sw">{{ shop.name.slice(0,1) }}</span>
          <div><div class="od-nm">{{ shop.name }}</div><div class="od-biz">{{ shop.business_name }}</div></div></div>
      </div>
      <div class="od-tb-right">
        <!-- 锁徽标两态,绑现有 editing/holder -->
        <span v-if="editing" class="od-lock-editable">● 编辑中</span>
        <span v-else-if="holder" class="od-lock-occupied">🔒 {{ holder }} 编辑中</span>
        <span v-else class="od-lock-view">查看</span>
        <button v-if="!editing && !holder" class="od-btn-primary" @click="startEdit">编辑</button>
        <button v-if="editing" class="od-btn-ghost" @click="endEdit">退出编辑</button>
        <button v-if="holder" class="od-btn-takeover" @click="takeover">接管</button>
        <button class="od-btn-ghost" @click="save" :disabled="!editing || busy">保存并同步</button>
      </div>
    </div>
    <div v-if="msg" class="od-wb-msg">{{ msg }}</div>
    <div v-if="syncResult?.errors.length" class="od-wb-err">
      校验错误:<span v-for="(e,i) in syncResult.errors" :key="i">{{ e.sheetKey }}/{{ e.date }} {{ e.key }}:{{ e.msg }}; </span>
    </div>
    <!-- Univer 挂载点:禁动 -->
    <div ref="containerRef" class="od-wb-grid"></div>
  </div>
</template>
```

> 注:`emit('back')` 对接 App 的 `onBackToOps`(回店铺列表)。月份选择已在外壳顶栏全局,本屏不再放月份 input(原 `update:period` emit 保留但本屏不触发;若需本屏切月可保留一个 month input,按需)。

- [ ] **Step 2: 加 `<style scoped>`**

复制 workbook-shell.html 顶栏样式(`.od-wb-topbar/.od-icon-btn/.od-store/.od-lock-*/.od-btn-*`),用 `--od-*`;`.od-wb-grid` 设 `flex:1;min-height:0;`(让 Univer 填满)。**不复制** `.grid-area`/`.sheet-tabs` 的占位样式(Univer 自渲染)。

- [ ] **Step 3: 构建验证**

Run: `cd web && npm run build` -> 通过。

- [ ] **Step 4: Univer 回归验证(关键)**

`boss` 登录 -> 公司经营 -> 选店进工作簿:
1. Univer 表格正常加载(快照或模板);
2. 点"编辑"占锁 -> 锁徽标变"编辑中";
3. 等待 >15s 心跳续锁无异常;
4. 填数据 -> "保存并同步" -> 成功提示 + 校验错误(若有)显示;
5. 退出编辑释放锁;
6. (两标签页)A 占锁编辑 -> B 进入见"XXX 编辑中" + 接管按钮 -> A 失锁提示。

任一异常 = 边界被破坏,回查是否误动 `containerRef`/锁逻辑。

- [ ] **Step 5: Commit**

```bash
git add web/src/views/Workbook.vue
git commit -m "feat(web): Workbook 移植 OpenDesign 顶栏外壳(Univer 挂载点与锁逻辑不动)"
```

---

## Task 11: 全量集成验证

**Files:** 无新改(若发现缺陷回填对应任务)。

- [ ] **Step 1: 全量构建**

Run: `cd web && npm run build`
Expected: vue-tsc 无错、vite build 成功、产出 `dist/`。

- [ ] **Step 2: 端到端手动走查**

启动后端 + 前端,按角色走:
- `boss`(董事长):登录(新登录页)-> 外壳(侧栏5项+顶栏)-> 数据大屏(图表正常)-> 公司经营(业务->5店->Univer 录入/保存同步)-> AI 分析(问答)-> AI 海报(生成下载)-> 员工管理(全员,建经理成功)。
- `mgr`(经理):登录 -> 员工管理(只见本部门,角色下拉仅员工,建员工成功,建经理选项不暴露)。
- 月份:顶栏切月,大屏/工作簿随之刷新。

- [ ] **Step 3: Univer 边界终检**

重复 Task 10 Step 4 的 6 项 Univer 回归,全过。

- [ ] **Step 4: 令牌一致性抽检**

grep 视图 `<style>` 内无硬编码 `#` 色值(除 `#fff`/`#000` 文字与渐变);颜色均走 `var(--od-*)`。

Run(项目根): `grep -rn '#[0-9a-fA-F]\{3,6\}' web/src/views/*.vue | grep -v '#fff' | grep -v '#000'`
Expected: 仅 design-system 已知值或无输出;发现硬编码即回填。

- [ ] **Step 5: 收尾 commit(若有抽检修复)**

```bash
git add -A
git commit -m "style(web): 全量令牌一致性收尾"
```

---

## Self-Review 结论

- **Spec 覆盖**:令牌(§5.1→T1)、App外壳/IA(§3,§8→T2)、员工管理(§7→T3+T4)、逐屏移植(§5.2→T5-T9)、Univer边界(§6→T10)、验证(§10→T11)均覆盖。品牌静水楼台/仅浅色/额外产物不落地(§9)在 T1/T2/T5 体现。
- **无占位符**:逻辑代码(T1-T4)完整;视觉移植(T5-T10)以 `Opendesign/<name>.html` 为代码源 + 保留逻辑契约 + 绑定说明,非占位。
- **类型一致**:`User` 扩字段(T3)与 Employees(T4)/api(T3)用法一致;`api.listUsers` 等命名前后一致;`Module` 类型在 App(T2)一致。
- **风险点**:T10 Univer 边界已单列回归;T2 重写 App 是最大结构改动,独立验证。
