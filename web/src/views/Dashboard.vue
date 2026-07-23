<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { api } from '../api';
import type { DashboardOverview, HotelOverview, Shop } from '../types';
import FootbathDashboard from './FootbathDashboard.vue';
import HotelDashboard from './HotelDashboard.vue';

const props = defineProps<{ businessCode?: string }>();   // 来自 App.vue(缺省 footbath)
const businessCode = computed(() => props.businessCode || 'footbath');

const pad = (x: number) => String(x).padStart(2, '0');
const todayIso = (() => { const n = new Date(); return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`; })();
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysInMonth = (y: number, m0: number) => new Date(y, m0 + 1, 0).getDate();

const granularity = ref<'day' | 'week' | 'month' | 'year'>('month');
const refDate = ref(todayIso);
const shopId = ref<number | null>(null);
const shops = ref<Shop[]>([]);
const data = ref<DashboardOverview | HotelOverview | null>(null);
const err = ref('');

const grains = [
  { key: 'day' as const, label: '日' }, { key: 'week' as const, label: '周' },
  { key: 'month' as const, label: '月' }, { key: 'year' as const, label: '年' },
];

let reqId = 0;
const load = () => {
  err.value = '';
  const id = ++reqId;
  api.dashboardOverview(granularity.value, refDate.value, shopId.value ?? undefined, businessCode.value)
    .then(r => { if (id === reqId) data.value = r; })
    .catch(e => { if (id === reqId) err.value = e.message; });
};
onMounted(() => { api.shops().then(r => { shops.value = r; }).catch(() => {}); load(); });
watch([granularity, refDate, shopId, businessCode], load);

const step = (dir: 1 | -1) => {
  const [y, m, d] = refDate.value.split('-').map(Number);
  if (granularity.value === 'day' || granularity.value === 'week') {
    const dt = new Date(y, m - 1, d); dt.setDate(dt.getDate() + dir * (granularity.value === 'week' ? 7 : 1)); refDate.value = isoOf(dt);
  } else if (granularity.value === 'month') {
    const nm0 = (((m - 1 + dir) % 12) + 12) % 12; const ny = y + Math.floor((m - 1 + dir) / 12);
    refDate.value = `${ny}-${pad(nm0 + 1)}-${pad(Math.min(d, daysInMonth(ny, nm0)))}`;
  } else { const ny = y + dir; refDate.value = `${ny}-${pad(m)}-${pad(Math.min(d, daysInMonth(ny, m - 1)))}`;
  }
};
const goToday = () => { refDate.value = todayIso; };
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const weekdayOf = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return WEEKDAYS[new Date(y, m - 1, d).getDay()]; };
const isoWeekRange = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number); const anchor = new Date(y, m - 1, d);
  const monday = new Date(anchor); monday.setDate(anchor.getDate() - ((anchor.getDay() + 6) % 7));
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  return { start: isoOf(monday), end: isoOf(sunday) };
};
const rangeLabel = computed(() => {
  const g = granularity.value; const [y, m] = refDate.value.split('-').map(Number);
  if (g === 'day') return `${refDate.value} ${weekdayOf(refDate.value)}`;
  if (g === 'week') { const { start, end } = isoWeekRange(refDate.value); return start.slice(0, 4) !== end.slice(0, 4) ? `${start} ~ ${end}` : `${start} ~ ${end.slice(5)}`; }
  if (g === 'month') return `${y} 年 ${m} 月`; return `${y} 年`;
});
const scopeLabel = computed(() => shopId.value ? (shops.value.find(s => s.id === shopId.value)?.name ?? '单店') : `全部 ${shops.value.length} 店`);
const title = computed(() => businessCode.value === 'hotel' ? '汉庭酒店·经营驾驶舱' : '静水楼台·经营驾驶舱');
const onPickShop = (id: number) => { shopId.value = id; };
</script>

<template>
  <div class="dashboard-page">
    <div class="dashboard-inner">
      <div class="page-head">
        <div class="head-left"><h1>{{ title }}</h1><div class="sub">{{ scopeLabel }}</div></div>
        <div class="head-tools">
          <div class="gran-nav">
            <div class="gran-seg"><button v-for="g in grains" :key="g.key" class="gran-btn" :class="{ active: granularity === g.key }" @click="granularity = g.key">{{ g.label }}</button></div>
            <button class="nav-arrow" @click="step(-1)">‹</button><span class="range-lbl">{{ rangeLabel }}</span><button class="nav-arrow" @click="step(1)">›</button>
            <button class="today-btn" @click="goToday">回到今天</button>
          </div>
          <span class="pill live"><span class="dot"></span>实时同步</span>
          <select class="shop-select" :value="shopId ?? ''" @change="shopId = ($event.target as HTMLSelectElement).value ? Number(($event.target as HTMLSelectElement).value) : null">
            <option value="">全部 {{ shops.length }} 店</option>
            <option v-for="s in shops" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </div>
      </div>
      <div v-if="err" class="err-banner">{{ err }}</div>
      <FootbathDashboard v-if="businessCode === 'footbath'" :overview="data as DashboardOverview | null" :shops="shops" :shop-id="shopId" @pick-shop="onPickShop" />
      <HotelDashboard v-else-if="businessCode === 'hotel'" :overview="data as HotelOverview | null" :shops="shops" :shop-id="shopId" @pick-shop="onPickShop" />
      <div v-else class="err-banner">该业务大屏尚未实现</div>
    </div>
  </div>
</template>

<style scoped>
/* 令牌 --od-* 为全局,定义于 styles/tokens.css。本页保留页头/工具栏样式。 */
.dashboard-page {
  font-family: var(--od-font-sans);
  color: var(--od-text);
  font-size: var(--od-text-base);
  line-height: 1.5;
}
.dashboard-inner {
  max-width: 1320px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--od-space-4);
}

/* 页头 */
.page-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.head-left h1 { font-size: var(--od-text-2xl); font-weight: var(--od-weight-bold); margin: 0; }
.head-left .sub { font-size: var(--od-text-sm); color: var(--od-text-muted); margin-top: 2px; }
.head-tools { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.gran-nav { display: flex; align-items: center; gap: 6px; }
.gran-seg { display: inline-flex; border: 1px solid var(--od-border); border-radius: var(--od-radius-md); overflow: hidden; background: var(--od-surface); }
.gran-btn { height: 30px; padding: 0 14px; border: none; background: none; color: var(--od-text-muted); font-family: inherit; font-size: var(--od-text-sm); font-weight: var(--od-weight-medium); cursor: pointer; transition: all .15s ease; }
.gran-btn:hover { background: var(--od-surface-2); color: var(--od-text); }
.gran-btn.active { background: var(--od-primary); color: #fff; }
.nav-arrow { width: 30px; height: 30px; border: 1px solid var(--od-border); border-radius: var(--od-radius-md); background: var(--od-surface); color: var(--od-text); font-size: 18px; line-height: 1; cursor: pointer; transition: all .15s ease; display: inline-flex; align-items: center; justify-content: center; }
.nav-arrow:hover { border-color: var(--od-primary); color: var(--od-primary); background: var(--od-primary-soft); }
.range-lbl { min-width: 130px; text-align: center; font-size: var(--od-text-sm); font-weight: var(--od-weight-semibold); color: var(--od-text); font-family: var(--od-font-mono); font-variant-numeric: tabular-nums; }
.today-btn { height: 30px; padding: 0 12px; border: 1px solid var(--od-border); border-radius: var(--od-radius-md); background: var(--od-surface); color: var(--od-text); font-family: inherit; font-size: var(--od-text-sm); font-weight: var(--od-weight-medium); cursor: pointer; transition: all .15s ease; }
.today-btn:hover { border-color: var(--od-primary); color: var(--od-primary); background: var(--od-primary-soft); }
.pill { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border: 1px solid var(--od-border); border-radius: var(--od-radius-md); background: var(--od-surface); font-size: var(--od-text-sm); font-weight: var(--od-weight-medium); color: var(--od-text); }
.pill.live { color: var(--od-success); }
.dot { width: 7px; height: 7px; border-radius: 50%; background: var(--od-success); box-shadow: 0 0 0 3px var(--od-success-soft); }
.shop-select { display: inline-flex; align-items: center; height: 32px; padding: 0 10px; border: 1px solid var(--od-border); border-radius: var(--od-radius-md); background: var(--od-surface); color: var(--od-text); font-family: inherit; font-size: var(--od-text-sm); font-weight: var(--od-weight-medium); cursor: pointer; transition: border-color .15s ease; }
.shop-select:hover { border-color: var(--od-primary); }

.err-banner { color: color-mix(in oklab, var(--od-danger), black 10%); background: var(--od-danger-soft); padding: var(--od-space-3) var(--od-space-4); border-radius: var(--od-radius-md); font-size: var(--od-text-sm); border: 1px solid color-mix(in oklab, var(--od-danger), white 30%); }
</style>
