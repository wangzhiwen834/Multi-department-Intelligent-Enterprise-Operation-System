<script setup lang="ts">
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
</script>

<template>
  <div class="ops-page">
    <div v-if="err" class="ops-err">{{ err }}</div>

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
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 3C12 3 5.5 10.5 5.5 15.2a6.5 6.5 0 0 0 13 0C18.5 10.5 12 3 12 3Z" fill="currentColor"/></svg>
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
        <div v-for="(s, i) in selectedGroup.shops" :key="s.id" class="store-card" @click="emit('pick', s)">
          <div class="store-sw" :style="{ background: swatch(i) }">{{ firstChar(s.name) }}</div>
          <div class="store-info">
            <h4>{{ s.name }}</h4>
            <div class="biz">{{ s.business_name }}</div>
          </div>
          <div class="store-go"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg></div>
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
.biz-ico { width: 48px; height: 48px; border-radius: var(--od-radius-md); display: grid; place-items: center; font-size: 24px; }
.go-arrow { width: 32px; height: 32px; border-radius: var(--od-radius-full); background: var(--od-surface-2); display: grid; place-items: center; color: var(--od-text-muted); transition: all .18s; }
.biz-card:hover .go-arrow { background: var(--od-primary); color: #fff; }
.biz-card h3 { font-size: var(--od-text-lg); font-weight: var(--od-weight-semibold); }
.biz-card .biz-name { font-size: var(--od-text-sm); color: var(--od-text-muted); }
.biz-stats { display: flex; gap: var(--od-space-6); padding-top: var(--od-space-4); border-top: 1px solid var(--od-border); }
.biz-stat .v { font-size: var(--od-text-lg); font-weight: var(--od-weight-bold); font-family: var(--od-font-mono); }
.biz-stat .l { font-size: var(--od-text-xs); color: var(--od-text-muted); }

/* 虚线占位卡 */
.placeholder-card { border: 2px dashed var(--od-border); border-radius: var(--od-radius-lg); padding: var(--od-space-6); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: var(--od-text-muted); min-height: 200px; background: transparent; cursor: default; }
.placeholder-card:hover { border-color: color-mix(in oklab, var(--od-border), black 8%); background: var(--od-surface-2); }
.placeholder-card .ph-ico { width: 44px; height: 44px; border-radius: var(--od-radius-md); background: var(--od-surface-2); display: grid; place-items: center; }
.placeholder-card h4 { font-size: var(--od-text-base); color: var(--od-text); font-weight: var(--od-weight-medium); }
.placeholder-card p { font-size: var(--od-text-xs); }

/* 店铺卡 */
.store-card { background: var(--od-surface); border: 1px solid var(--od-border); border-radius: var(--od-radius-lg); padding: var(--od-space-5); box-shadow: var(--od-shadow-sm); cursor: pointer; transition: all .18s ease; display: flex; align-items: center; gap: var(--od-space-4); }
.store-card:hover { box-shadow: var(--od-shadow-md); transform: translateY(-2px); border-color: var(--od-primary); }
.store-sw { width: 44px; height: 44px; border-radius: var(--od-radius-md); display: grid; place-items: center; flex-shrink: 0; color: #fff; font-size: 18px; font-weight: var(--od-weight-semibold); }
.store-info { flex: 1; min-width: 0; }
.store-info h4 { font-size: var(--od-text-lg); font-weight: var(--od-weight-semibold); display: flex; align-items: center; gap: 8px; }
.store-info .biz { font-size: var(--od-text-sm); color: var(--od-text-muted); margin-top: 2px; }
.store-go { width: 34px; height: 34px; border-radius: var(--od-radius-full); background: var(--od-surface-2); display: grid; place-items: center; color: var(--od-text-muted); transition: all .18s; flex-shrink: 0; }
.store-card:hover .store-go { background: var(--od-primary); color: #fff; }
</style>
