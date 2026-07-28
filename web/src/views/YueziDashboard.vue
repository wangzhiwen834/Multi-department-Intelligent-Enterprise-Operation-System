<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import type { EChartsOption } from 'echarts';
import { THEMES, type Theme } from '../theme';
import { useTheme } from '../composables/theme-store';
import type { YueziOverview, Shop } from '../types';
import Chart from '../components/Chart.vue';

const props = defineProps<{ overview: YueziOverview | null; shops: Shop[]; shopId: number | null }>();
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
    { label: '收现合计', val: money(kpis?.cashTotal || 0) },
    { label: '退款合计', val: money(kpis?.refundTotal || 0) },
    { label: '净收现', val: money(kpis?.netCash || 0) },
    { label: '占用套数', val: (kpis?.occupiedRooms || 0).toLocaleString() },
    { label: '入住率(日均)', val: pct(kpis?.occupancyRate || 0) },
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

const revLabels: Record<string, string> = { deposit: '押金', intent_deposit: '意向金', down_payment: '定金', balance: '尾款', xiyue_home: '禧悦到家', chankang_sales: '产康销售', other_goods: '其他商品', renew_balance: '续住/补尾款', accompany_fee: '陪产费用' };
const refundLabels: Record<string, string> = { refund_deposit: '退押金', other_refund: '其他退款', refund_package: '退套餐款', chankang_refund: '产康退款' };

const pieOpt = (structure: Record<string, number> | undefined, labels: Record<string, string>): EChartsOption => {
  const items = Object.entries(structure || {})
    .map(([key, val]) => ({ name: labels[key] || key, value: Number(val) || 0 }))
    .filter(i => i.value > 0);
  return { textStyle: { color: theme.subText }, tooltip: { trigger: 'item' }, legend: { bottom: 0, textStyle: { color: theme.subText } },
    series: [{ type: 'pie', radius: ['45%', '70%'], center: ['50%', '45%'], data: items.length ? items : [{ name: '无数据', value: 1 }], color: theme.palette, label: pieLabel() }] };
};
const revOpt = computed<EChartsOption>(() => pieOpt(k()?.revenueStructure, revLabels));
const refundOpt = computed<EChartsOption>(() => pieOpt(k()?.refundStructure, refundLabels));

const expenseOpt = computed<EChartsOption>(() => {
  const items = k()?.expenseBySubject || [];
  return { textStyle: { color: theme.subText }, tooltip: { trigger: 'axis' }, grid: { left: 75, right: 24, top: 20, bottom: 20 },
    xAxis: { type: 'value', axisLabel: { color: theme.subText }, splitLine: { lineStyle: { color: theme.cardBorder } } },
    yAxis: { type: 'category', data: items.map(i => i.subject), axisLabel: { color: theme.text } },
    series: [{ type: 'bar', data: items.map(i => i.amount), itemStyle: { color: (p: any) => theme.palette[p.dataIndex % theme.palette.length], borderRadius: [0, 6, 6, 0] } }] };
});

const rankingOpt = computed<EChartsOption>(() => {
  const r = k()?.shopRanking || [];
  return { textStyle: { color: theme.subText }, grid: { left: 75, right: 24, top: 20, bottom: 20 }, tooltip: { trigger: 'axis' },
    xAxis: { type: 'value', axisLabel: { color: theme.subText }, splitLine: { lineStyle: { color: theme.cardBorder } } },
    yAxis: { type: 'category', data: r.map(x => x.shopName), axisLabel: { color: theme.text } },
    series: [{ type: 'bar', data: r.map(x => x.revenue), itemStyle: { color: (p: any) => theme.palette[p.dataIndex % theme.palette.length], borderRadius: [0, 6, 6, 0] } }] };
});
const onRankingClick = (p: any) => { const r = k()?.shopRanking[p.dataIndex]; if (r) emit('pick-shop', r.shopId); };

// ---- 每日收现柱图(revenueTrend 的柱形版本) ----
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

// ---- 房间占用情况(纯 HTML 进度条) ----
const occupancyRate = computed(() => {
  let v = Number(k()?.kpis?.occupancyRate || 0);
  if (v > 0 && v <= 1) v *= 100;   // 后端存 0-1(如 0.956)-> 转百分比 95.6
  return Math.max(0, Math.min(100, v));
});
const occupiedRooms = computed(() => k()?.kpis?.occupiedRooms || 0);

// ---- KPI 卡图标/配色(5 个) ----
const kpiIcons = [
  // 收现合计 ¥
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  // 退款合计 undo
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>',
  // 净收现 wallet
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>',
  // 占用套数 bed
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8a2 2 0 0 1 2 2v0"/></svg>',
  // 入住率 percent
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>',
];
const kpiTints = [
  { background: 'var(--od-primary-soft)', color: 'var(--od-primary)' },
  { background: 'var(--od-danger-soft)', color: 'var(--od-danger)' },
  { background: 'var(--od-success-soft)', color: 'var(--od-success)' },
  { background: 'var(--od-gold-soft)', color: 'var(--od-gold)' },
  { background: 'var(--od-warning-soft)', color: 'var(--od-warning)' },
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
    <div class="grid row-even">
      <div class="card"><div class="card-title"><h3>收现趋势</h3></div><div class="chart-box"><Chart :option="trendOpt" :theme="theme" /></div></div>
      <div class="card"><div class="card-title"><h3>每日收现</h3></div><div class="chart-box"><Chart :option="barTrendOpt" :theme="theme" /></div></div>
    </div>
    <div class="grid row-even">
      <div class="card"><div class="card-title"><h3>收款结构</h3></div><div class="chart-box"><Chart :option="revOpt" :theme="theme" /></div></div>
      <div class="card"><div class="card-title"><h3>退款结构</h3></div><div class="chart-box"><Chart :option="refundOpt" :theme="theme" /></div></div>
    </div>
    <div class="grid row-even">
      <div class="card"><div class="card-title"><h3>费用科目</h3></div><div class="chart-box"><div v-if="(k()?.expenseBySubject || []).length === 0" class="chart-empty">暂无费用数据</div><Chart v-else :option="expenseOpt" :theme="theme" /></div></div>
      <div class="card"><div class="card-title"><h3>门店营收排名</h3></div><div class="chart-box"><Chart :option="rankingOpt" :theme="theme" :on-click="onRankingClick" /></div></div>
    </div>
    <div class="card">
      <div class="card-title"><h3>房间占用情况</h3><span class="meta">入住率 / 占用套数</span></div>
      <div class="occupancy-wrap">
        <div class="occupancy-row">
          <span class="occupancy-rate">{{ occupancyRate.toFixed(2) }}%</span>
          <span class="occupancy-rooms">占用 {{ occupiedRooms.toLocaleString() }} 套</span>
        </div>
        <div class="occupancy-track">
          <div class="occupancy-bar" :style="{ width: occupancyRate + '%' }"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-inner { max-width: 100%; margin: 0 auto; display: flex; flex-direction: column; gap: var(--od-space-5); }
.card { background: var(--od-surface); border: 1px solid var(--od-border); border-radius: var(--od-radius-lg); box-shadow: var(--od-shadow-sm); padding: var(--od-space-5); display: flex; flex-direction: column; }
.card-title { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--od-space-4); }
.card-title h3 { font-size: var(--od-text-lg); font-weight: var(--od-weight-semibold); margin: 0; }
.card-title .meta { font-size: var(--od-text-xs); color: var(--od-text-muted); }
.grid { display: grid; gap: var(--od-space-5); }
.kpis { grid-template-columns: repeat(5, 1fr); }
.row-2 { grid-template-columns: 1.4fr 1fr; }
.row-even { grid-template-columns: 1fr 1fr; }
@media (max-width: 1100px) { .kpis { grid-template-columns: repeat(2, 1fr); } .row-2, .row-even { grid-template-columns: 1fr; } }
.kpi { gap: 6px; transition: all .18s ease; cursor: default; }
.kpi:hover { box-shadow: var(--od-shadow-md); transform: translateY(-2px); border-color: color-mix(in oklab, var(--od-border), black 12%); }
.kpi-label { font-size: var(--od-text-sm); color: var(--od-text-muted); display: flex; align-items: center; gap: 8px; }
.kpi-ico { width: 30px; height: 30px; border-radius: var(--od-radius-md); display: grid; place-items: center; flex-shrink: 0; }
.kpi-val { font-size: 24px; font-weight: var(--od-weight-bold); font-family: var(--od-font-mono); font-variant-numeric: tabular-nums; }
.chart-box { flex: 1 1 auto; min-height: 280px; width: 100%; }
.chart-empty { flex: 1; display: grid; place-items: center; color: var(--od-text-muted); font-size: var(--od-text-sm); min-height: 280px; }

/* 房间占用情况(纯 HTML 进度条) */
.occupancy-wrap { display: flex; flex-direction: column; gap: var(--od-space-3); padding: var(--od-space-2) 0; }
.occupancy-row { display: flex; align-items: baseline; justify-content: space-between; }
.occupancy-rate { font-size: 34px; font-weight: var(--od-weight-bold); font-family: var(--od-font-mono); color: var(--od-primary); font-variant-numeric: tabular-nums; }
.occupancy-rooms { font-size: var(--od-text-sm); color: var(--od-text-muted); }
.occupancy-track { width: 100%; height: 14px; background: var(--od-primary-soft); border-radius: var(--od-radius-full); overflow: hidden; }
.occupancy-bar { height: 100%; background: linear-gradient(90deg, var(--od-primary), var(--od-palette-2)); border-radius: var(--od-radius-full); transition: width .4s ease; }
</style>

