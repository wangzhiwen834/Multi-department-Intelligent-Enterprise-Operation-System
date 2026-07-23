<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { api } from '../api';
import type { Business, Shop, User } from '../types';

const props = defineProps<{ user: User | null; businesses: Business[]; businessCode: string | null }>();
const emit = defineEmits<{
  (e: 'select-business', code: string | null): void;
  (e: 'businesses-changed'): void;
  (e: 'pick', s: Shop): void;
}>();

const shops = ref<Shop[]>([]);
const err = ref('');
const loadShops = () => api.shops().then(r => shops.value = r).catch(e => err.value = e.message);
onMounted(loadShops);

// 选中业务(由父组件 App.vue 侧边栏子菜单驱动;null=卡片总览)
const selectedGroup = computed(() =>
  props.businessCode ? props.businesses.find(b => b.code === props.businessCode) ?? null : null,
);

const selectBiz = (code: string | null) => emit('select-business', code);

// 董事长可管理业务
const canManage = computed(() => props.user?.role === 'chairman');

// ---- 业务 CRUD ----
const creating = ref(false);
const newName = ref('');
const saveErr = ref('');
const startCreate = () => { creating.value = true; newName.value = ''; saveErr.value = ''; };
const cancelCreate = () => { creating.value = false; newName.value = ''; };
const submitCreate = async () => {
  const name = newName.value.trim();
  if (!name) return;
  saveErr.value = '';
  try { await api.createBusiness(name); emit('businesses-changed'); cancelCreate(); }
  catch (e: any) { saveErr.value = e.message; }
};

const renamingId = ref<number | null>(null);
const renameValue = ref('');
const startRename = (b: Business) => { renamingId.value = b.id; renameValue.value = b.name; saveErr.value = ''; };
const cancelRename = () => { renamingId.value = null; renameValue.value = ''; };
const submitRename = async (b: Business) => {
  const name = renameValue.value.trim();
  if (!name || name === b.name) { cancelRename(); return; }
  saveErr.value = '';
  try { await api.renameBusiness(b.id, name); emit('businesses-changed'); cancelRename(); }
  catch (e: any) { saveErr.value = e.message; }
};

const deleting = ref(false);
const removeBusiness = async (b: Business) => {
  const typed = prompt(`确定删除业务「${b.name}」?\n这将一并删除其下所有门店/工作簿/历史指标,不可逆!\n请输入业务全名确认:`);
  if (typed !== b.name) { if (typed !== null) saveErr.value = '输入的业务名不匹配,已取消'; return; }
  deleting.value = true; saveErr.value = '';
  try { await api.deleteBusiness(b.id); emit('businesses-changed'); }
  catch (e: any) { saveErr.value = e.message; }
  finally { deleting.value = false; }
};

// ---- logo 上传 ----
const onLogoFile = async (b: Business, e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  saveErr.value = '';
  const reader = new FileReader();
  reader.onload = async () => {
    try { await api.uploadBusinessLogo(b.id, String(reader.result), file.name); emit('businesses-changed'); }
    catch (er: any) { saveErr.value = er.message; }
    finally { (e.target as HTMLInputElement).value = ''; }
  };
  reader.readAsDataURL(file);
};
const removeLogo = async (b: Business) => {
  if (!confirm(`删除业务「${b.name}」的 logo?`)) return;
  saveErr.value = '';
  try { await api.deleteBusinessLogo(b.id); emit('businesses-changed'); }
  catch (e: any) { saveErr.value = e.message; }
};

// ---- 状态 B 门店列表 ----
const groupShops = computed(() => selectedGroup.value
  ? shops.value.filter(s => s.business_code === selectedGroup.value!.code) : []);

// 门店店标色
const palette = ['var(--od-palette-1)','var(--od-palette-2)','var(--od-palette-3)','var(--od-palette-4)','var(--od-palette-5)'];
const swatch = (i: number) => palette[i % palette.length];
const firstChar = (name: string) => name.charAt(0);

// 状态 B 下门店增删改(沿用上一轮已做)—— 门店操作后刷新 shops
const refreshShops = () => loadShops();

// 门店新增(状态 B)
const newShopName = ref('');
const addingShop = ref(false);
const startAddShop = () => { addingShop.value = true; newShopName.value = ''; };
const cancelAddShop = () => { addingShop.value = false; newShopName.value = ''; };
const submitAddShop = async () => {
  const name = newShopName.value.trim();
  if (!name || !selectedGroup.value) return;
  saveErr.value = '';
  try { await api.createShop(name); await loadShops(); cancelAddShop(); }
  catch (e: any) { saveErr.value = e.message; }
};
// 门店重命名/删除复用既有逻辑(见下模板内联)
const renamingShopId = ref<number | null>(null);
const renameShopValue = ref('');
const startRenameShop = (s: Shop) => { renamingShopId.value = s.id; renameShopValue.value = s.name; saveErr.value = ''; };
const cancelRenameShop = () => { renamingShopId.value = null; renameShopValue.value = ''; };
const submitRenameShop = async (s: Shop) => {
  const name = renameShopValue.value.trim();
  if (!name || name === s.name) { cancelRenameShop(); return; }
  saveErr.value = '';
  try { await api.renameShop(s.id, name); await loadShops(); cancelRenameShop(); }
  catch (e: any) { saveErr.value = e.message; }
};
const removeShop = async (s: Shop) => {
  if (!confirm(`确定删除门店「${s.name}」?\n历史工作簿/大屏累计数据保留,仅从列表移除。`)) return;
  saveErr.value = '';
  try { await api.deleteShop(s.id); await loadShops(); }
  catch (e: any) { saveErr.value = e.message; }
};

// 侧边栏切换业务时,若在状态 B 则保持;父组件改 businessCode 即可
watch(() => props.businessCode, () => { /* 由父组件驱动;无需本地 selected */ });
</script>

<template>
  <div class="ops-page">
    <div v-if="err" class="ops-err">{{ err }}</div>
    <div v-if="saveErr" class="ops-err">{{ saveErr }}</div>

    <!-- 状态 A:业务模块卡片总览 -->
    <template v-if="!selectedGroup">
      <nav class="crumb"><b>公司经营</b></nav>
      <div class="content-h">业务模块</div>
      <div class="content-desc">选择业务模块查看下属门店。点击门店卡进入 Univer 经营报表。</div>

      <div class="grid grid-2">
        <div v-for="g in businesses" :key="g.id" class="biz-card"
          style="background:linear-gradient(135deg,color-mix(in oklab,var(--od-primary-soft),white 45%),var(--od-surface-2))"
          @click="selectBiz(g.code)">
          <div class="top">
            <div class="biz-ico" style="background:var(--od-primary-soft);color:var(--od-primary)">
              <img v-if="g.logo_path" :src="g.logo_path" :alt="g.name" class="biz-logo-img" />
              <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 3C12 3 5.5 10.5 5.5 15.2a6.5 6.5 0 0 0 13 0C18.5 10.5 12 3 12 3Z" fill="currentColor"/></svg>
            </div>
            <div class="go-arrow"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg></div>
          </div>
          <div>
            <h3 v-if="renamingId !== g.id">{{ g.name }}</h3>
            <div v-else class="rename-row" @click.stop>
              <input class="rename-input" v-model="renameValue" @keyup.enter="submitRename(g)" @keyup.esc="cancelRename" />
              <button class="mini-btn ok" @click="submitRename(g)">✓</button>
              <button class="mini-btn" @click="cancelRename">✕</button>
            </div>
            <div class="biz-name">{{ g.name }} · 综合经营</div>
          </div>
          <div class="biz-stats">
            <div class="biz-stat"><div class="v">{{ g.shop_count }}</div><div class="l">门店数</div></div>
          </div>
          <!-- 业务管理操作(董事长):重命名 / logo 上传 / 删 logo / 删除业务 -->
          <div v-if="canManage" class="biz-actions" @click.stop>
            <button class="icon-btn" :disabled="renamingId === g.id" @click="startRename(g)" title="重命名"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
            <label class="icon-btn" title="上传 logo"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg><input type="file" accept="image/png,image/jpeg,image/webp" hidden @change="onLogoFile(g, $event)" /></label>
            <button v-if="g.logo_path" class="icon-btn" @click="removeLogo(g)" title="删 logo"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
            <button class="icon-btn danger" :disabled="deleting" @click="removeBusiness(g)" title="删除业务"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
          </div>
        </div>

        <!-- 新增业务卡(董事长) -->
        <div v-if="canManage" class="biz-card add-card">
          <template v-if="!creating">
            <button class="add-btn" @click="startCreate"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg><span>新增业务</span></button>
          </template>
          <div v-else class="add-form" @click.stop>
            <input class="rename-input" v-model="newName" placeholder="业务名称(如 汉庭酒店)" @keyup.enter="submitCreate" @keyup.esc="cancelCreate" />
            <div class="add-form-actions"><button class="mini-btn ok" @click="submitCreate">✓</button><button class="mini-btn" @click="cancelCreate">✕</button></div>
          </div>
        </div>
      </div>
    </template>

    <!-- 状态 B:选中业务的门店列表 -->
    <template v-else>
      <nav class="crumb">
        <a href="#" @click.prevent="selectBiz(null)">公司经营</a><span class="sep">/</span><b>{{ selectedGroup.name }}</b>
      </nav>
      <div class="content-h">{{ selectedGroup.name }} · {{ groupShops.length }} 家门店</div>
      <div class="content-desc">点击门店进入该店 Univer 经营报表。</div>

      <div class="grid grid-5">
        <div v-for="(s, i) in groupShops" :key="s.id" class="store-card">
          <div class="store-sw" :style="{ background: swatch(i) }" @click="emit('pick', s)">{{ firstChar(s.name) }}</div>
          <div class="store-info" @click="renamingShopId === s.id ? null : emit('pick', s)">
            <h4 v-if="renamingShopId !== s.id">{{ s.name }}</h4>
            <div v-else class="rename-row" @click.stop>
              <input class="rename-input" v-model="renameShopValue" @keyup.enter="submitRenameShop(s)" @keyup.esc="cancelRenameShop" />
              <button class="mini-btn ok" @click="submitRenameShop(s)">✓</button>
              <button class="mini-btn" @click="cancelRenameShop">✕</button>
            </div>
            <div class="biz">{{ selectedGroup.name }}</div>
          </div>
          <div v-if="canManage" class="store-actions" @click.stop>
            <button class="icon-btn" :disabled="renamingShopId === s.id" @click="startRenameShop(s)" title="重命名"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
            <button class="icon-btn danger" @click="removeShop(s)" title="删除"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
          </div>
          <div v-else class="store-go" @click="emit('pick', s)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg></div>
        </div>

        <!-- 新增门店卡(董事长) -->
        <div v-if="canManage" class="store-card add-card">
          <template v-if="!addingShop">
            <button class="add-btn" @click="startAddShop"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg><span>新增门店</span></button>
          </template>
          <div v-else class="add-form" @click.stop>
            <input class="rename-input" v-model="newShopName" placeholder="门店名称" @keyup.enter="submitAddShop" @keyup.esc="cancelAddShop" />
            <div class="add-form-actions"><button class="mini-btn ok" @click="submitAddShop">✓</button><button class="mini-btn" @click="cancelAddShop">✕</button></div>
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

/* 业务卡管理操作组 */
.biz-actions { display: flex; gap: 4px; flex-shrink: 0; align-items: center; }
.biz-actions label.icon-btn { cursor: pointer; }
</style>
