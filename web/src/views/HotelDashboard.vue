<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import type { EChartsOption } from 'echarts';
import { THEMES, type Theme } from '../theme';
import { useTheme } from '../composables/theme-store';
import type { HotelOverview, Shop } from '../types';
import Chart from '../components/Chart.vue';

const props = defineProps<{ overview: HotelOverview | null; shops: Shop[]; shopId: number | null }>();
const emit = defineEmits<{ (e: 'pick-shop', shopId: number): void }>();

const theme = reactive<Theme>({ ...THEMES.light });
const { theme: themeKey } = useTheme();
watch(themeKey, k => Object.assign(theme, THEMES[k] ?? THEMES.light), { immediate: true });

const money = (n: number) => '¥' + (n || 0).toLocaleString('zh-CN', { maximumFractionDigits: 0 });
const pct = (n: number) => (n || 0).toFixed(2);
const pieLabel = () => ({
  show: true, color: theme.text,
  formatter: (p: any) => p.name === '无数据' ? '无数据' : `${p.name}: ${Number(p.value).toLocaleString('zh-CN')} (${p.percent}%)`,
});

const k = () => props.overview;

const kpiCards = computed(() => {
  const kpis = k()?.kpis;
  return [
    { label: '酒店营业收入', val: money(kpis?.hotelRevenue || 0) },
    { label: '日收银总额', val: money(kpis?.dailyCashTotal || 0) },
    { label: '客房收入', val: money(kpis?.roomRevenue || 0) },
    { label: '餐券收入', val: money(kpis?.breakfastRevenue || 0) },
    { label: '会员权益', val: money(kpis?.memberBenefit || 0) },
    { label: '过夜间数', val: (kpis?.overnightRooms || 0).toLocaleString() },
    { label: '清扫间数', val: (kpis?.cleanedRooms || 0).toLocaleString() },
    { label: 'ADR(日均)', val: money(kpis?.adr || 0) },
    { label: 'OCC(日均)', val: pct(kpis?.occupancy || 0) },
    { label: 'REVPAR(日均)', val: money(kpis?.revpar || 0) },
  ];
});

const trendOpt = computed<EChartsOption>(() => {
  const t = k()?.revenueTrend || [];
  return {
    textStyle: { color: theme.subText },
    grid: { left: 55, right: 20, top: 20, bottom: 30 },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: t.map(x => x.label), axisLine: { lineStyle: { color: theme.subText } }, axisLabel: { color: theme.subText } },
    yAxis: { type: 'value', axisLabel: { color: theme.subText }, splitLine: { lineStyle: { color: theme.cardBorder } } },
    series: [{ type: 'line', smooth: true, data: t.map(x => x.revenue), lineStyle: { color: theme.accent }, itemStyle: { color: theme.accent }, areaStyle: { color: theme.accent, opacity: 0.15 } }],
  };
});

const revOpt = computed<EChartsOption>(() => {
  const s = k()?.revenueStructure;
  const items = [
    { name: '客房', value: s?.room || 0 }, { name: '餐券', value: s?.breakfast || 0 },
    { name: '客损', value: s?.guestDamage || 0 }, { name: '会员权益', value: s?.member || 0 },
    { name: '其他', value: s?.other || 0 }, { name: '线下房', value: s?.offlineRoom || 0 },
  ].filter(i => i.value > 0);
  return { textStyle: { color: theme.subText }, tooltip: { trigger: 'item' }, legend: { bottom: 0, textStyle: { color: theme.subText } },
    series: [{ type: 'pie', radius: ['45%','70%'], center: ['50%','45%'], data: items.length ? items : [{ name: '无数据', value: 1 }], color: theme.palette, label: pieLabel() }] };
});

const roomOpt = computed<EChartsOption>(() => {
  const s = k()?.roomTypeStructure;
  const items = [
    { name: '大床房', value: s?.bigBed || 0 }, { name: '套房', value: s?.suite || 0 }, { name: '家庭房', value: s?.family || 0 },
    { name: '高级大床', value: s?.superiorBigBed || 0 }, { name: '商务大床', value: s?.businessBigBed || 0 },
    { name: '高级双床', value: s?.superiorTwin || 0 }, { name: '商务双床', value: s?.businessTwin || 0 },
  ];
  return { textStyle: { color: theme.subText }, tooltip: { trigger: 'axis' }, grid: { left: 40, right: 20, top: 20, bottom: 30 },
    xAxis: { type: 'category', data: items.map(i => i.name), axisLabel: { color: theme.subText, interval: 0, rotate: 30, width: 80, overflow: 'truncate' } },
    yAxis: { type: 'value', axisLabel: { color: theme.subText } },
    series: [{ type: 'bar', data: items.map(i => i.value), itemStyle: { color: theme.accent, borderRadius: [6,6,0,0] } }] };
});

const chanOpt = computed<EChartsOption>(() => {
  const s = k()?.channelStructure;
  const items = [
    { name: '美团', value: s?.meituan || 0 }, { name: '携程', value: s?.ctrip || 0 }, { name: '华住', value: s?.huazhu || 0 },
    { name: '自用/免费', value: s?.selfuse || 0 }, { name: '自然客流', value: s?.walkin || 0 },
  ].filter(i => i.value > 0);
  return { textStyle: { color: theme.subText }, tooltip: { trigger: 'item' }, legend: { bottom: 0, textStyle: { color: theme.subText } },
    series: [{ type: 'pie', radius: ['45%','70%'], center: ['50%','45%'], data: items.length ? items : [{ name: '无数据', value: 1 }], color: theme.palette, label: pieLabel() }] };
});

// ---- 每日营收柱图(revenueTrend 的柱形版本) ----
const barTrendOpt = computed<EChartsOption>(() => {
  const t = k()?.revenueTrend || [];
  return {
    textStyle: { color: theme.subText },
    grid: { left: 55, right: 20, top: 20, bottom: 30 },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: t.map(x => x.label), axisLine: { lineStyle: { color: theme.subText } }, axisLabel: { color: theme.subText, interval: 0, rotate: 30, width: 80, overflow: 'truncate' } },
    yAxis: { type: 'value', axisLabel: { color: theme.subText }, splitLine: { lineStyle: { color: theme.cardBorder } } },
    series: [{ type: 'bar', data: t.map(x => x.revenue), itemStyle: { color: theme.accent, borderRadius: [6, 6, 0, 0] } }],
  };
});

const rankingOpt = computed<EChartsOption>(() => {
  const r = k()?.shopRanking || [];
  return { textStyle: { color: theme.subText }, grid: { left: 75, right: 24, top: 20, bottom: 20 }, tooltip: { trigger: 'axis' },
    xAxis: { type: 'value', axisLabel: { color: theme.subText }, splitLine: { lineStyle: { color: theme.cardBorder } } },
    yAxis: { type: 'category', data: r.map(x => x.shopName), axisLabel: { color: theme.text } },
    series: [{ type: 'bar', data: r.map(x => x.revenue), itemStyle: { color: (p: any) => theme.palette[p.dataIndex % theme.palette.length], borderRadius: [0,6,6,0] } }] };
});
const onRankingClick = (p: any) => { const r = k()?.shopRanking[p.dataIndex]; if (r) emit('pick-shop', r.shopId); };

const kpiTints = Array.from({ length: 10 }, (_, i) => ({ background: 'var(--od-primary-soft)', color: `var(--od-palette-${(i % 5) + 1})` }));

// ---- KPI 卡图标(10 个,沿用足浴大屏同款 SVG 风格) ----
const kpiIcons = [
  // 酒店营业收入 ¥
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  // 日收银总额 banknote
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>',
  // 客房收入 bed
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8a2 2 0 0 1 2 2v0"/></svg>',
  // 餐券收入 utensils
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h0a2 2 0 0 0 2-2V2M5 2v20M21 15V2a5 5 0 0 0-3 5v8c0 1.1.9 2 2 2h1v6"/></svg>',
  // 会员权益 award
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>',
  // 过夜间数 moon
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
  // 清扫间数 sparkles
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>',
  // ADR tag
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z"/><circle cx="7" cy="7" r="1.5"/></svg>',
  // OCC percent
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>',
  // REVPAR trending-up
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>',
];
</script>

<template>
  <div class="dashboard-inner">
    <div class="grid kpis">
      <div v-for="(kp, i) in kpiCards" :key="kp.label" class="card kpi">
        <div class="kpi-label"><span class="kpi-ico" :style="kpiTints[i]" v-html="kpiIcons[i]"></span>{{ kp.label }}</div>
        <div class="kpi-val">{{ kp.val }}</div>
      </div>
    </div>
    <div class="grid row-2">
      <div class="card"><div class="card-title"><h3>营收趋势</h3></div><div class="chart-box"><Chart :option="trendOpt" :theme="theme" /></div></div>
      <div class="card"><div class="card-title"><h3>收入结构</h3></div><div class="chart-box"><Chart :option="revOpt" :theme="theme" /></div></div>
    </div>
    <div class="grid row-even">
      <div class="card"><div class="card-title"><h3>房型结构</h3></div><div class="chart-box"><Chart :option="roomOpt" :theme="theme" /></div></div>
      <div class="card"><div class="card-title"><h3>渠道房量</h3></div><div class="chart-box"><Chart :option="chanOpt" :theme="theme" /></div></div>
    </div>
    <div class="grid row-even">
      <div class="card"><div class="card-title"><h3>每日营收</h3></div><div class="chart-box"><Chart :option="barTrendOpt" :theme="theme" /></div></div>
      <div class="card"><div class="card-title"><h3>门店营收排名</h3></div><div class="chart-box"><Chart :option="rankingOpt" :theme="theme" :on-click="onRankingClick" /></div></div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-inner {
  max-width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--od-space-5);
}

/* 卡片 */
.card { background: var(--od-surface); border: 1px solid var(--od-border); border-radius: var(--od-radius-lg); box-shadow: var(--od-shadow-sm); padding: var(--od-space-6); display: flex; flex-direction: column; }
.card-title { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--od-space-4); }
.card-title h3 { font-size: var(--od-text-lg); font-weight: var(--od-weight-semibold); margin: 0; }
.card-title .meta { font-size: var(--od-text-xs); color: var(--od-text-muted); }

.grid { display: grid; gap: var(--od-space-5); }
.kpis { grid-template-columns: repeat(4, 1fr); }
.row-2 { grid-template-columns: 1.4fr 1fr; }
.row-even { grid-template-columns: 1fr 1fr; }
@media (max-width: 1100px) { .kpis { grid-template-columns: repeat(2, 1fr); } .row-2, .row-even { grid-template-columns: 1fr; } }

/* KPI */
.kpi { gap: 6px; transition: all .18s ease; cursor: default; }
.kpi:hover { box-shadow: var(--od-shadow-md); transform: translateY(-2px); border-color: color-mix(in oklab, var(--od-border), black 12%); }
.kpi-label { font-size: var(--od-text-sm); color: var(--od-text-muted); display: flex; align-items: center; gap: 8px; }
.kpi-ico { width: 30px; height: 30px; border-radius: var(--od-radius-md); display: grid; place-items: center; flex-shrink: 0; }
.kpi-val { font-size: 26px; font-weight: var(--od-weight-bold); font-family: var(--od-font-mono); font-variant-numeric: tabular-nums; letter-spacing: -.01em; line-height: 1.2; }

/* 图表卡槽:真实 ECharts 填充 */
.chart-box { flex: 1 1 auto; min-height: 360px; width: 100%; }

/* 空数据占位 */
.chart-empty { flex: 1; display: grid; place-items: center; color: var(--od-text-muted); font-size: var(--od-text-sm); min-height: 280px; }
</style>
