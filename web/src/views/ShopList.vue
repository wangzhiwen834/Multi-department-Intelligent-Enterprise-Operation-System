<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { api } from '../api';
import type { Shop, User } from '../types';

const props = defineProps<{ user: User | null }>();
const emit = defineEmits<{ (e: 'pick', s: Shop): void }>();

const shops = ref<Shop[]>([]);
const err = ref('');
const load = () => api.shops().then(r => shops.value = r).catch(e => err.value = e.message);
onMounted(load);

// 按 business 分组(暂仅足浴;未来新增业务自动成组)
const groups = computed(() => {
  const m = new Map<string, { code: string; name: string; shops: Shop[] }>();
  for (const s of shops.value) {
    const g = m.get(s.business_code) ?? { code: s.business_code, name: s.business_name, shops: [] };
    g.shops.push(s); m.set(s.business_code, g);
  }
  return [...m.values()];
});

// 两级钻取:选中业务 code(null = 业务模块列表态)
const selected = ref<string | null>(null);
const selectedGroup = computed(() => groups.value.find(g => g.code === selected.value) ?? null);
const selectGroup = (code: string) => { selected.value = code; };
const backToModules = () => { selected.value = null; };

// 5 店店标色,按 index 循环取 --od-palette-1..5
const palette = [
  'var(--od-palette-1)', 'var(--od-palette-2)', 'var(--od-palette-3)',
  'var(--od-palette-4)', 'var(--od-palette-5)',
];
const swatch = (i: number) => palette[i % palette.length];
const firstChar = (name: string) => name.charAt(0);

// 业务模块卡 logo:按业务 code 取静态资源,无则回退到通用 SVG。
// footbath=足浴品牌 logo(静水楼台LOGO),其余业务暂无 logo 走占位图标。
const bizLogo = (code: string): string | undefined =>
  code === 'footbath' ? '/footbath-logo.png' : undefined;

// 门店增删改:仅董事长
const canManage = computed(() => props.user?.role === 'chairman');

// 新增门店
const creating = ref(false);
const newName = ref('');
const saveErr = ref('');
const startCreate = () => { creating.value = true; newName.value = ''; saveErr.value = ''; };
const cancelCreate = () => { creating.value = false; newName.value = ''; };
const submitCreate = async () => {
  const name = newName.value.trim();
  if (!name) return;
  saveErr.value = '';
  try { await api.createShop(name); await load(); cancelCreate(); }
  catch (e: any) { saveErr.value = e.message; }
};

// 重命名(行内编辑)
const renamingId = ref<number | null>(null);
const renameValue = ref('');
const startRename = (s: Shop) => { renamingId.value = s.id; renameValue.value = s.name; saveErr.value = ''; };
const cancelRename = () => { renamingId.value = null; renameValue.value = ''; };
const submitRename = async (s: Shop) => {
  const name = renameValue.value.trim();
  if (!name || name === s.name) { cancelRename(); return; }
  saveErr.value = '';
  try { await api.renameShop(s.id, name); await load(); cancelRename(); }
  catch (e: any) { saveErr.value = e.message; }
};

// 删除(软删)
const deleting = ref(false);
const removeShop = async (s: Shop) => {
  if (!confirm(`确定删除门店「${s.name}」?\n历史工作簿/大屏累计数据保留,仅从门店列表移除。`)) return;
  deleting.value = true; saveErr.value = '';
  try { await api.deleteShop(s.id); await load(); }
  catch (e: any) { saveErr.value = e.message; }
  finally { deleting.value = false; }
};
</script>

<template>
  <div class="ops-page">
    <div v-if="err" class="ops-err">{{ err }}</div>
    <div v-if="saveErr" class="ops-err">{{ saveErr }}</div>

    <!-- 状态 A:业务模块列表 -->
    <template v-if="!selectedGroup">
      <nav class="crumb" aria-label="breadcrumb">
        <b>公司经营</b>
      </nav>
      <div class="content-h">业务模块</div>
      <div class="content-desc">选择业务模块查看下属门店。点击门店卡进入 Univer 经营报表。</div>

      <div class="grid grid-2">
        <div v-for="g in groups" :key="g.code" class="biz-card"
          style="background:linear-gradient(135deg,color-mix(in oklab,var(--od-primary-soft),white 45%),var(--od-surface-2))"
          @click="selectGroup(g.code)">
          <div class="top">
            <div class="biz-ico" style="background:var(--od-primary-soft);color:var(--od-primary)">
              <img v-if="bizLogo(g.code)" :src="bizLogo(g.code)" :alt="g.name" class="biz-logo-img" />
              <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 3C12 3 5.5 10.5 5.5 15.2a6.5 6.5 0 0 0 13 0C18.5 10.5 12 3 12 3Z" fill="currentColor"/></svg>
            </div>
            <div class="go-arrow"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg></div>
          </div>
          <div>
            <h3>{{ g.name }}</h3>
            <div class="biz-name">{{ g.name }} · 综合经营</div>
          </div>
          <div class="biz-stats">
            <div class="biz-stat"><div class="v">{{ g.shops.length }}</div><div class="l">门店数</div></div>
          </div>
        </div>

        <div class="placeholder-card">
          <div class="ph-ico"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></div>
          <h4>后续新增业务</h4>
          <p>如:餐饮 / 零售 / 美容 - 即将上线</p>
        </div>
      </div>
    </template>

    <!-- 状态 B:选中业务的店铺列表 -->
    <template v-else>
      <nav class="crumb" aria-label="breadcrumb">
        <a href="#" @click.prevent="backToModules">公司经营</a><span class="sep">/</span><b>{{ selectedGroup.name }}</b>
      </nav>
      <div class="content-h">{{ selectedGroup.name }} · {{ selectedGroup.shops.length }} 家门店</div>
      <div class="content-desc">点击门店进入该店 Univer 经营报表(经营报表 / 收入对账 / 费用明细 / 资金台账)。</div>

      <div class="grid grid-5">
        <div v-for="(s, i) in selectedGroup.shops" :key="s.id" class="store-card">
          <div class="store-sw" :style="{ background: swatch(i) }" @click="emit('pick', s)">{{ firstChar(s.name) }}</div>
          <div class="store-info" @click="renamingId === s.id ? null : emit('pick', s)">
            <!-- 重命名:行内输入框替换标题 -->
            <h4 v-if="renamingId !== s.id">{{ s.name }}</h4>
            <div v-else class="rename-row" @click.stop>
              <input class="rename-input" v-model="renameValue"
                @keyup.enter="submitRename(s)" @keyup.esc="cancelRename"
                :aria-label="`重命名 ${s.name}`" />
              <button class="mini-btn ok" @click="submitRename(s)" title="保存">✓</button>
              <button class="mini-btn" @click="cancelRename" title="取消">✕</button>
            </div>
            <div class="biz">{{ s.business_name }}</div>
          </div>
          <!-- 管理操作(董事长可见):重命名 / 删除 -->
          <div v-if="canManage" class="store-actions" @click.stop>
            <button class="icon-btn" :disabled="renamingId === s.id" @click="startRename(s)" title="重命名">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            </button>
            <button class="icon-btn danger" :disabled="deleting" @click="removeShop(s)" title="删除">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </button>
          </div>
          <div v-else class="store-go" @click="emit('pick', s)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg></div>
        </div>

        <!-- 新增门店卡(董事长可见) -->
        <div v-if="canManage" class="store-card add-card">
          <template v-if="!creating">
            <button class="add-btn" @click="startCreate">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
              <span>新增门店</span>
            </button>
          </template>
          <div v-else class="add-form" @click.stop>
            <input class="rename-input" v-model="newName" placeholder="门店名称"
              @keyup.enter="submitCreate" @keyup.esc="cancelCreate" aria-label="门店名称" />
            <div class="add-form-actions">
              <button class="mini-btn ok" @click="submitCreate" title="保存">✓</button>
              <button class="mini-btn" @click="cancelCreate" title="取消">✕</button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* 令牌 --od-* 为全局,定义于 styles/tokens.css。此处仅放本页局部样式。 */

.ops-page {
  font-family: var(--od-font-sans);
  color: var(--od-text);
  font-size: var(--od-text-base);
  line-height: 1.5;
}
.ops-err {
  color: var(--od-danger);
  background: var(--od-danger-soft);
  padding: var(--od-space-3) var(--od-space-4);
  border-radius: var(--od-radius-md);
  margin-bottom: var(--od-space-5);
  font-size: var(--od-text-sm);
}

/* 面包屑 */
.crumb { display: flex; align-items: center; gap: 8px; font-size: var(--od-text-sm); margin-bottom: var(--od-space-5); color: var(--od-text-muted); }
.crumb a { color: var(--od-text-muted); text-decoration: none; }
.crumb a:hover { color: var(--od-primary); }
.crumb b { color: var(--od-text); font-weight: var(--od-weight-semibold); }
.crumb .sep { color: color-mix(in oklab, var(--od-border), black 8%); }
.content-h { font-size: var(--od-text-xl); font-weight: var(--od-weight-semibold); margin-bottom: var(--od-space-2); }
.content-desc { font-size: var(--od-text-sm); color: var(--od-text-muted); margin-bottom: var(--od-space-6); }

/* 卡片网格 */
.grid { display: grid; gap: var(--od-space-4); }
.grid-2 { grid-template-columns: repeat(2, 1fr); }
.grid-5 { grid-template-columns: repeat(3, 1fr); }
@media (max-width: 900px) { .grid-2, .grid-5 { grid-template-columns: 1fr 1fr; } }
@media (max-width: 600px) { .grid-2, .grid-5 { grid-template-columns: 1fr; } }

/* 业务卡 */
.biz-card { border: 1px solid var(--od-border); border-radius: var(--od-radius-lg); padding: var(--od-space-6); box-shadow: var(--od-shadow-sm); cursor: pointer; transition: all .18s ease; display: flex; flex-direction: column; gap: var(--od-space-4); position: relative; overflow: hidden; }
.biz-card:hover { box-shadow: var(--od-shadow-md); transform: translateY(-2px); border-color: var(--od-primary); }
.biz-card .top { display: flex; align-items: flex-start; justify-content: space-between; }
.biz-ico { width: 76px; height: 76px; border-radius: var(--od-radius-md); display: grid; place-items: center; font-size: 38px; overflow: hidden; }
.biz-logo-img { width: 100%; height: 100%; object-fit: contain; }
.go-arrow { width: 36px; height: 36px; border-radius: var(--od-radius-full); background: var(--od-surface-2); display: grid; place-items: center; color: var(--od-text-muted); transition: all .18s; }
.biz-card:hover .go-arrow { background: var(--od-primary); color: #fff; }
.biz-card h3 { font-size: var(--od-text-2xl); font-weight: var(--od-weight-bold); }
.biz-card .biz-name { font-size: var(--od-text-base); color: var(--od-text-muted); }
.biz-stats { display: flex; gap: var(--od-space-6); padding-top: var(--od-space-4); border-top: 1px solid var(--od-border); }
.biz-stat .v { font-size: var(--od-text-xl); font-weight: var(--od-weight-bold); font-family: var(--od-font-mono); }
.biz-stat .l { font-size: var(--od-text-sm); color: var(--od-text-muted); }

/* 虚线占位卡 */
.placeholder-card { border: 2px dashed var(--od-border); border-radius: var(--od-radius-lg); padding: var(--od-space-6); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: var(--od-text-muted); min-height: 200px; background: transparent; cursor: default; }
.placeholder-card:hover { border-color: color-mix(in oklab, var(--od-border), black 8%); background: var(--od-surface-2); }
.placeholder-card .ph-ico { width: 44px; height: 44px; border-radius: var(--od-radius-md); background: var(--od-surface-2); display: grid; place-items: center; }
.placeholder-card h4 { font-size: var(--od-text-base); color: var(--od-text); font-weight: var(--od-weight-medium); }
.placeholder-card p { font-size: var(--od-text-xs); }

/* 店铺卡 */
.store-card { background: var(--od-surface); border: 1px solid var(--od-border); border-radius: var(--od-radius-lg); padding: var(--od-space-5); box-shadow: var(--od-shadow-sm); transition: all .18s ease; display: flex; align-items: center; gap: var(--od-space-4); }
.store-card:hover { box-shadow: var(--od-shadow-md); border-color: var(--od-primary); }
.store-sw { width: 44px; height: 44px; border-radius: var(--od-radius-md); display: grid; place-items: center; flex-shrink: 0; color: #fff; font-size: 18px; font-weight: var(--od-weight-semibold); cursor: pointer; }
.store-info { flex: 1; min-width: 0; cursor: pointer; }
.store-info h4 { font-size: var(--od-text-lg); font-weight: var(--od-weight-semibold); display: flex; align-items: center; gap: 8px; }
.store-info .biz { font-size: var(--od-text-sm); color: var(--od-text-muted); margin-top: 2px; }
.store-go { width: 34px; height: 34px; border-radius: var(--od-radius-full); background: var(--od-surface-2); display: grid; place-items: center; color: var(--od-text-muted); transition: all .18s; flex-shrink: 0; cursor: pointer; }
.store-card:hover .store-go { background: var(--od-primary); color: #fff; }

/* 行内重命名 / 新增 输入 */
.rename-row { display: flex; align-items: center; gap: 6px; }
.rename-input {
  flex: 1; min-width: 0; height: 32px; padding: 0 8px;
  border: 1px solid var(--od-primary); border-radius: var(--od-radius-sm);
  background: var(--od-surface); color: var(--od-text);
  font-family: inherit; font-size: var(--od-text-base);
}
.rename-input:focus { outline: none; box-shadow: 0 0 0 2px var(--od-primary-soft); }
.mini-btn {
  width: 28px; height: 28px; border: 1px solid var(--od-border); border-radius: var(--od-radius-sm);
  background: var(--od-surface); color: var(--od-text); cursor: pointer; display: grid; place-items: center;
  font-size: 14px; line-height: 1; transition: all .15s ease; flex-shrink: 0;
}
.mini-btn.ok { color: var(--od-primary); border-color: var(--od-primary); }
.mini-btn:hover { background: var(--od-surface-2); }

/* 管理操作按钮组 */
.store-actions { display: flex; gap: 4px; flex-shrink: 0; }
.icon-btn {
  width: 30px; height: 30px; border: 1px solid var(--od-border); border-radius: var(--od-radius-sm);
  background: var(--od-surface); color: var(--od-text-muted); cursor: pointer; display: grid; place-items: center;
  transition: all .15s ease;
}
.icon-btn:hover { color: var(--od-primary); border-color: var(--od-primary); background: var(--od-primary-soft); }
.icon-btn.danger:hover { color: var(--od-danger); border-color: var(--od-danger); background: var(--od-danger-soft); }
.icon-btn:disabled { opacity: .4; cursor: not-allowed; }

/* 新增门店卡 */
.store-card.add-card { border-style: dashed; background: transparent; box-shadow: none; }
.add-btn {
  flex: 1; border: none; background: none; cursor: pointer; color: var(--od-text-muted);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
  font-family: inherit; font-size: var(--od-text-sm); font-weight: var(--od-weight-medium); padding: var(--od-space-4);
  min-height: 80px; transition: color .15s ease;
}
.add-btn:hover { color: var(--od-primary); }
.add-form { flex: 1; display: flex; flex-direction: column; gap: 8px; }
.add-form-actions { display: flex; gap: 6px; }
</style>
