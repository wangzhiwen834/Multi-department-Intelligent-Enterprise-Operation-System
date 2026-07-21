<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { api, getToken, setToken, clearToken } from './api';
import type { Shop, User } from './types';
import Login from './views/Login.vue';
import ShopList from './views/ShopList.vue';
import Workbook from './views/Workbook.vue';
import WorkbookManager from './views/WorkbookManager.vue';
import Dashboard from './views/Dashboard.vue';
import Chat from './views/Chat.vue';
import Poster from './views/Poster.vue';
import Employees from './views/Employees.vue';
import AuditLog from './views/AuditLog.vue';
import Manual from './views/Manual.vue';
import Settings from './views/Settings.vue';

type Module = 'dashboard' | 'ops' | 'chat' | 'poster' | 'employees' | 'audit' | 'manual' | 'settings';

const BRAND = '静水楼台企业智能经营系统';
const user = ref<User | null>(null);
const booted = ref(false);
const module = ref<Module>('dashboard');
const shop = ref<Shop | null>(null);
const openedPeriod = ref<string | null>(null);
const period = ref(new Date().toISOString().slice(0, 7));
const sidebarCollapsed = ref(false);
const toggleSidebar = () => { sidebarCollapsed.value = !sidebarCollapsed.value; };

onMounted(() => {
  if (getToken()) {
    api.me().then(u => { user.value = u; booted.value = true; }).catch(() => { clearToken(); booted.value = true; });
  } else { booted.value = true; }
});

const onLogin = (u: User, t: string) => { setToken(t); user.value = u; module.value = 'dashboard'; };
const onLogout = () => { clearToken(); user.value = null; shop.value = null; };
const onPick = (s: Shop) => { shop.value = s; openedPeriod.value = null; };   // 选店 -> 进管理器
const onOpenPeriod = (p: string) => { period.value = p; openedPeriod.value = p; };  // 管理器 -> 进工作簿
const onWorkbookBack = () => { openedPeriod.value = null; };                   // 工作簿返回 -> 回管理器
const onManagerBack = () => { shop.value = null; openedPeriod.value = null; }; // 管理器返回 -> 回店铺列表
const setModule = (m: Module) => { if (m !== 'ops') { shop.value = null; openedPeriod.value = null; } module.value = m; };

const showEmployees = computed(() => user.value?.role === 'chairman' || user.value?.role === 'manager');
const showAudit = computed(() => user.value?.role === 'chairman' || user.value?.role === 'manager');
// 侧栏图标:Lucide 风格线条 SVG,stroke=currentColor 跟随 nav-item 配色
const navIcon: Record<Module, string> = {
  dashboard: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>',
  ops: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01M10 21v-4h4v4"/></svg>',
  chat: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  poster: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>',
  employees: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  audit: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 12h6M9 16h6"/></svg>',
  manual: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  settings: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
};
// 侧栏收起 / 展开 图标(chevron)
const collapseIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
const expandIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>';
const sidebarItems = computed(() => {
  const items: { key: Module; label: string }[] = [
    { key: 'dashboard', label: '数据大屏' },
    { key: 'ops', label: '公司经营' },
    { key: 'chat', label: 'AI 分析' },
    { key: 'poster', label: 'AI 每日海报' },
  ];
  if (showEmployees.value) items.push({ key: 'employees', label: '员工管理' });
  if (showAudit.value) items.push({ key: 'audit', label: '操作日志' });
  if (user.value?.role === 'chairman') items.push({ key: 'settings', label: '系统设置' });
  items.push({ key: 'manual', label: '使用手册' });
  return items;
});
const activeLabel = computed(() => sidebarItems.value.find(i => i.key === module.value)?.label ?? '');
</script>

<template>
  <Login v-if="!user" @login="onLogin" />

  <div v-else class="od-shell" :class="{ collapsed: sidebarCollapsed }" :data-od-active="module">
    <!-- 侧边栏:结构/样式取 app-shell.html,下方为绑定契约 -->
    <aside class="od-sidebar">
      <div class="od-brand">{{ BRAND }}</div>
      <nav class="od-nav">
        <button v-for="it in sidebarItems" :key="it.key"
          class="od-nav-item" :class="{ active: module === it.key || (it.key === 'ops' && shop) }"
          @click="setModule(it.key)">
          <span class="od-ico" v-html="navIcon[it.key]"></span><span>{{ it.label }}</span>
        </button>
      </nav>
    </aside>

    <div class="od-main">
      <!-- 顶栏:全局月份 + 用户 + 退出 -->
      <header class="od-topbar">
        <h1 class="od-module-title">{{ activeLabel }}</h1>
        <div class="od-top-right">
          <input type="month" :value="period"
            v-if="!(module === 'ops' && shop) && module !== 'dashboard'"
            @change="period = ($event.target as HTMLInputElement).value" class="od-month" />
          <span class="od-user">{{ user?.name }} · {{ user?.role === 'chairman' ? '董事长' : user?.role === 'manager' ? '经理' : '员工' }}</span>
          <button class="od-logout" @click="onLogout">退出</button>
        </div>
      </header>

      <!-- 侧栏收起/展开把手:贴在侧栏右沿(主区左边沿),随侧栏宽度滑动,点击切换 -->
      <button class="od-side-handle" @click="toggleSidebar" :title="sidebarCollapsed ? '展开侧栏' : '收起侧栏'">
        <span class="od-ico" v-html="sidebarCollapsed ? expandIcon : collapseIcon"></span>
      </button>

      <!-- 内容区 -->
      <main class="od-content">
        <Dashboard v-if="module === 'dashboard'" />
        <ShopList v-else-if="module === 'ops' && !shop" :user="user" :period="period" @pick="onPick" />
        <WorkbookManager v-else-if="module === 'ops' && shop && !openedPeriod" :shop="shop" @open="onOpenPeriod" @back="onManagerBack" />
        <Workbook v-else-if="module === 'ops' && shop && openedPeriod" :shop="shop" :period="openedPeriod" @back="onWorkbookBack" />
        <Chat v-else-if="module === 'chat'" :period="period" />
        <Poster v-else-if="module === 'poster'" />
        <Employees v-else-if="module === 'employees'" :user="user" />
        <AuditLog v-else-if="module === 'audit'" />
        <Manual v-else-if="module === 'manual'" />
        <Settings v-else-if="module === 'settings'" />
      </main>
    </div>
  </div>

  <div v-if="!booted" class="od-booting">加载中…</div>
</template>

<style scoped>
/* 外壳:侧栏 + 主区(grid),占满视口。令牌(--od-*)为全局,定义于 styles/tokens.css。 */
.od-shell {
  height: 100vh;
  display: grid;
  grid-template-columns: auto 1fr;
  background: var(--od-surface);
  overflow: hidden;
}

/* 侧边栏 */
.od-sidebar {
  width: var(--od-sidebar-w);
  background: var(--od-surface);
  border-right: 1px solid var(--od-border);
  display: flex;
  flex-direction: column;
  transition: width .2s ease;
  min-width: 0;
  overflow: hidden;
}
.od-shell.collapsed .od-sidebar {
  width: 0;
  border-right-width: 0;
}
.od-brand {
  height: var(--od-topbar-h);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 18px;
  border-bottom: 1px solid var(--od-border);
  font-size: var(--od-text-base);
  font-weight: var(--od-weight-semibold);
  white-space: nowrap;
  overflow: hidden;
  color: var(--od-text);
}
.od-nav {
  flex: 1;
  padding: var(--od-space-3) 10px;
  overflow-y: auto;
}
.od-nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  height: 40px;
  padding: 0 10px;
  border: none;
  background: none;
  border-radius: var(--od-radius-md);
  color: var(--od-text);
  font-family: inherit;
  font-size: var(--od-text-base);
  font-weight: var(--od-weight-medium);
  margin-bottom: 2px;
  cursor: pointer;
  position: relative;
  text-align: left;
  transition: all .15s ease;
  white-space: nowrap;
}
.od-nav-item:hover { background: var(--od-surface-2); }
.od-nav-item.active {
  background: var(--od-primary-soft);
  color: var(--od-primary);
  font-weight: var(--od-weight-semibold);
}
.od-nav-item.active::before {
  content: "";
  position: absolute;
  left: -10px;
  top: 8px;
  bottom: 8px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--od-primary);
}
.od-ico {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
/* 侧栏收起/展开把手:贴在侧栏右沿(主区左边沿),随侧栏宽度滑动 */
.od-side-handle {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 22px;
  height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--od-border);
  border-left: none;
  border-radius: 0 var(--od-radius-md) var(--od-radius-md) 0;
  background: var(--od-surface);
  color: var(--od-text-muted);
  cursor: pointer;
  z-index: 20;
  transition: color .15s ease, background .15s ease, border-color .15s ease;
}
.od-side-handle:hover {
  color: var(--od-primary);
  border-color: var(--od-primary);
  background: var(--od-primary-soft);
}

/* 主区 */
.od-main {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}
.od-topbar {
  height: var(--od-topbar-h);
  border-bottom: 1px solid var(--od-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--od-space-6);
  background: var(--od-surface);
  flex-shrink: 0;
}
.od-module-title {
  margin: 0;
  font-size: var(--od-text-lg);
  font-weight: var(--od-weight-semibold);
  color: var(--od-text);
}
.od-top-right {
  display: flex;
  align-items: center;
  gap: var(--od-space-3);
}
.od-month {
  display: inline-flex;
  align-items: center;
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--od-border);
  border-radius: var(--od-radius-md);
  background: var(--od-surface);
  font-family: inherit;
  font-size: var(--od-text-sm);
  font-weight: var(--od-weight-medium);
  color: var(--od-text);
  cursor: pointer;
  transition: border-color .15s ease;
}
.od-month:hover { border-color: var(--od-primary); }
.od-user {
  font-size: var(--od-text-sm);
  font-weight: var(--od-weight-medium);
  color: var(--od-text);
  white-space: nowrap;
}
.od-logout {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--od-border);
  border-radius: var(--od-radius-md);
  background: var(--od-surface);
  font-family: inherit;
  font-size: var(--od-text-sm);
  color: var(--od-text);
  cursor: pointer;
  transition: all .15s ease;
}
.od-logout:hover {
  color: var(--od-danger);
  border-color: var(--od-danger);
  background: var(--od-danger-soft);
}

/* 内容区:flex-1 占满剩余高度,old views(h-full)据此填满 */
.od-content {
  flex: 1;
  min-height: 0;
  padding: var(--od-space-6);
  background: var(--od-bg);
  overflow: auto;
}

/* 启动遮罩 */
.od-booting {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--od-bg);
  color: var(--od-text-muted);
  font-size: var(--od-text-lg);
  z-index: 9999;
}
</style>
