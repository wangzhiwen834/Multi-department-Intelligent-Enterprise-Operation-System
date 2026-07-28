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
</script>

<template>
  <div class="dashboard-inner">
    <div class="grid kpis">
      <div v-for="kp in kpiCards" :key="kp.label" class="card kpi">
        <div class="kpi-label">{{ kp.label }}</div>
        <div class="kpi-val">{{ kp.val }}</div>
      </div>
    </div>
    <div class="grid row-2">
      <div class="card"><div class="card-title"><h3>收现趋势</h3></div><div class="chart-box"><Chart :option="trendOpt" :theme="theme" /></div></div>
      <div class="card"><div class="card-title"><h3>收款结构</h3></div><div class="chart-box"><Chart :option="revOpt" :theme="theme" /></div></div>
    </div>
    <div class="grid row-even">
      <div class="card"><div class="card-title"><h3>退款结构</h3></div><div class="chart-box"><Chart :option="refundOpt" :theme="theme" /></div></div>
      <div class="card"><div class="card-title"><h3>费用科目</h3></div><div class="chart-box"><Chart :option="expenseOpt" :theme="theme" /></div></div>
    </div>
    <div class="grid row-even">
      <div class="card"><div class="card-title"><h3>门店营收排名</h3></div><div class="chart-box"><Chart :option="rankingOpt" :theme="theme" :on-click="onRankingClick" /></div></div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-inner { max-width: 1320px; margin: 0 auto; display: flex; flex-direction: column; gap: var(--od-space-4); }
.card { background: var(--od-surface); border: 1px solid var(--od-border); border-radius: var(--od-radius-lg); box-shadow: var(--od-shadow-sm); padding: var(--od-space-5); display: flex; flex-direction: column; }
.card-title { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--od-space-4); }
.card-title h3 { font-size: var(--od-text-lg); font-weight: var(--od-weight-semibold); margin: 0; }
.grid { display: grid; gap: var(--od-space-4); }
.kpis { grid-template-columns: repeat(5, 1fr); }
.row-2 { grid-template-columns: 1.4fr 1fr; }
.row-even { grid-template-columns: 1fr 1fr; }
@media (max-width: 1100px) { .kpis { grid-template-columns: repeat(2, 1fr); } .row-2, .row-even { grid-template-columns: 1fr; } }
.kpi { gap: 6px; }
.kpi-label { font-size: var(--od-text-sm); color: var(--od-text-muted); }
.kpi-val { font-size: 24px; font-weight: var(--od-weight-bold); font-family: var(--od-font-mono); font-variant-numeric: tabular-nums; }
.chart-box { flex: 1 1 auto; min-height: 280px; width: 100%; }
</style>
