<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import type { EChartsOption } from 'echarts';
import { THEMES, type Theme } from '../theme';
import { useTheme } from '../composables/theme-store';
import type { TiaoliOverview, Shop } from '../types';
import Chart from '../components/Chart.vue';

const props = defineProps<{ overview: TiaoliOverview | null; shops: Shop[]; shopId: number | null }>();
const emit = defineEmits<{ (e: 'pick-shop', shopId: number): void }>();

const theme = reactive<Theme>({ ...THEMES.light });
const { theme: themeKey } = useTheme();
watch(themeKey, k => Object.assign(theme, THEMES[k] ?? THEMES.light), { immediate: true });

const money = (n: number) => '¥' + (n || 0).toLocaleString('zh-CN', { maximumFractionDigits: 0 });
const pieLabel = () => ({
  show: true, color: theme.text,
  formatter: (p: any) => p.name === '无数据' ? '无数据' : `${p.name}: ${Number(p.value).toLocaleString('zh-CN')} (${p.percent}%)`,
});

const k = () => props.overview;

const kpiCards = computed(() => {
  const kpis = k()?.kpis;
  return [
    { label: '收款合计', val: money(kpis?.totalReceipt || 0) },
    { label: '退款合计', val: money(kpis?.refundTotal || 0) },
    { label: '净收款', val: money(kpis?.netReceipt || 0) },
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

// 柱图:项目销售(禧SPA 7 项 + 悦SPA 10 项,合并一张柱图,按金额降序)
const itemOpt = computed<EChartsOption>(() => {
  const x = k()?.xispaStructure || {} as any;
  const y = k()?.yuespaStructure || {} as any;
  const labels: Record<string, string> = {
    cika: '次卡', swimwear: '泳裤', swimming: '游泳项目', baby_herbal: '婴儿草本', haircut: '理发', diaper: '纸尿裤', other_goods: '其他商品',
    birth_checkup: '产道体检', bone_conditioning: '骨态调理', skin_care: '皮肤护理', postpartum_rehab: '产后康复', assistive_device: '辅助器材', fat_loss: '减脂', head_therapy: '头疗', fahan: '发汉', lactation: '开乳', card: '卡',
  };
  const items = [...Object.entries(x), ...Object.entries(y)]
    .map(([key, val]) => ({ name: labels[key] || key, value: Number(val) || 0 }))
    .filter(i => i.value > 0)
    .sort((a, b) => b.value - a.value);
  return {
    textStyle: { color: theme.subText }, tooltip: { trigger: 'axis' },
    grid: { left: 60, right: 20, top: 20, bottom: 60 },
    xAxis: { type: 'category', data: items.map(i => i.name), axisLabel: { color: theme.subText, interval: 0, rotate: 35 } },
    yAxis: { type: 'value', axisLabel: { color: theme.subText }, splitLine: { lineStyle: { color: theme.cardBorder } } },
    series: [{ type: 'bar', data: items.map(i => i.value), itemStyle: { color: theme.accent, borderRadius: [6, 6, 0, 0] } }],
  };
});

// ---- 禧SPA儿童项目饼图(xispaStructure 7 项) ----
const xispaPieOpt = computed<EChartsOption>(() => {
  const x = k()?.xispaStructure || {} as any;
  const labels: Record<string, string> = {
    cika: '次卡', swimwear: '泳裤', swimming: '游泳项目', baby_herbal: '婴儿草本', haircut: '理发', diaper: '纸尿裤', other_goods: '其他商品',
  };
  const items = Object.entries(x)
    .map(([key, val]) => ({ name: labels[key] || key, value: Number(val) || 0 }))
    .filter(i => i.value > 0);
  return { textStyle: { color: theme.subText }, tooltip: { trigger: 'item' }, legend: { bottom: 0, textStyle: { color: theme.subText } },
    series: [{ type: 'pie', radius: ['45%', '70%'], center: ['50%', '45%'], data: items.length ? items : [{ name: '无数据', value: 1 }], color: theme.palette, label: pieLabel() }] };
});

const rankingOpt = computed<EChartsOption>(() => {
  const r = k()?.shopRanking || [];
  return { textStyle: { color: theme.subText }, grid: { left: 75, right: 24, top: 20, bottom: 20 }, tooltip: { trigger: 'axis' },
    xAxis: { type: 'value', axisLabel: { color: theme.subText }, splitLine: { lineStyle: { color: theme.cardBorder } } },
    yAxis: { type: 'category', data: r.map(x => x.shopName), axisLabel: { color: theme.text } },
    series: [{ type: 'bar', data: r.map(x => x.revenue), itemStyle: { color: (p: any) => theme.palette[p.dataIndex % theme.palette.length], borderRadius: [0, 6, 6, 0] } }] };
});
const onRankingClick = (p: any) => { const r = k()?.shopRanking[p.dataIndex]; if (r) emit('pick-shop', r.shopId); };

// ---- 每日收款柱图(revenueTrend 的柱形版本) ----
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

// ---- 禧SPA(儿童) vs 悦SPA(产康) 营收占比饼图 ----
const spaPieOpt = computed<EChartsOption>(() => {
  const x = k()?.xispaStructure || {} as any;
  const y = k()?.yuespaStructure || {} as any;
  const xTotal = Object.values(x).reduce((s: number, v: any) => s + (Number(v) || 0), 0);
  const yTotal = Object.values(y).reduce((s: number, v: any) => s + (Number(v) || 0), 0);
  const items = [
    { name: '禧SPA儿童', value: xTotal },
    { name: '悦SPA产康', value: yTotal },
  ].filter(i => i.value > 0);
  return {
    textStyle: { color: theme.subText }, tooltip: { trigger: 'item' }, legend: { bottom: 0, textStyle: { color: theme.subText } },
    series: [{ type: 'pie', radius: ['45%', '70%'], center: ['50%', '45%'], data: items.length ? items : [{ name: '无数据', value: 1 }], color: [theme.palette[0], theme.palette[3]], label: pieLabel() }],
  };
});

// ---- KPI 卡图标/配色(3 个) ----
const kpiIcons = [
  // 收款合计 ¥
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  // 退款合计 undo/return
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>',
  // 净收款 wallet
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>',
];
const kpiTints = [
  { background: 'var(--od-primary-soft)', color: 'var(--od-primary)' },
  { background: 'var(--od-danger-soft)', color: 'var(--od-danger)' },
  { background: 'var(--od-success-soft)', color: 'var(--od-success)' },
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
      <div class="card"><div class="card-title"><h3>收款趋势</h3></div><div class="chart-box"><Chart :option="trendOpt" :theme="theme" /></div></div>
      <div class="card"><div class="card-title"><h3>每日收款</h3></div><div class="chart-box"><Chart :option="barTrendOpt" :theme="theme" /></div></div>
    </div>
    <div class="grid row-even">
      <div class="card"><div class="card-title"><h3>项目销售</h3></div><div class="chart-box"><Chart :option="itemOpt" :theme="theme" /></div></div>
      <div class="card"><div class="card-title"><h3>禧SPA / 悦SPA</h3><span class="meta">儿童 / 产康 营收占比</span></div><div class="chart-box"><Chart :option="spaPieOpt" :theme="theme" /></div></div>
    </div>
    <div class="grid row-even">
      <div class="card"><div class="card-title"><h3>禧SPA儿童项目</h3></div><div class="chart-box"><Chart :option="xispaPieOpt" :theme="theme" /></div></div>
      <div class="card"><div class="card-title"><h3>门店营收排名</h3></div><div class="chart-box"><Chart :option="rankingOpt" :theme="theme" :on-click="onRankingClick" /></div></div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-inner { max-width: 100%; margin: 0 auto; display: flex; flex-direction: column; gap: var(--od-space-5); }
.card { background: var(--od-surface); border: 1px solid var(--od-border); border-radius: var(--od-radius-lg); box-shadow: var(--od-shadow-sm); padding: var(--od-space-6); display: flex; flex-direction: column; }
.card-title { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--od-space-4); }
.card-title h3 { font-size: var(--od-text-lg); font-weight: var(--od-weight-semibold); margin: 0; }
.card-title .meta { font-size: var(--od-text-xs); color: var(--od-text-muted); }
.grid { display: grid; gap: var(--od-space-5); }
.kpis { grid-template-columns: repeat(3, 1fr); }
.row-2 { grid-template-columns: 1.4fr 1fr; }
.row-even { grid-template-columns: 1fr 1fr; }
@media (max-width: 1100px) { .kpis { grid-template-columns: repeat(2, 1fr); } .row-2, .row-even { grid-template-columns: 1fr; } }
.kpi { gap: 6px; transition: all .18s ease; cursor: default; }
.kpi:hover { box-shadow: var(--od-shadow-md); transform: translateY(-2px); border-color: color-mix(in oklab, var(--od-border), black 12%); }
.kpi-label { font-size: var(--od-text-sm); color: var(--od-text-muted); display: flex; align-items: center; gap: 8px; }
.kpi-ico { width: 30px; height: 30px; border-radius: var(--od-radius-md); display: grid; place-items: center; flex-shrink: 0; }
.kpi-val { font-size: 26px; font-weight: var(--od-weight-bold); font-family: var(--od-font-mono); font-variant-numeric: tabular-nums; }
.chart-box { flex: 1 1 auto; min-height: 360px; width: 100%; }
.chart-empty { flex: 1; display: grid; place-items: center; color: var(--od-text-muted); font-size: var(--od-text-sm); min-height: 280px; }
</style>
