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
      <div v-for="(kp, i) in kpiCards" :key="kp.label" class="card kpi">
        <div class="kpi-label">{{ kp.label }}</div>
        <div class="kpi-val">{{ kp.val }}</div>
      </div>
    </div>
    <div class="grid row-2">
      <div class="card"><div class="card-title"><h3>收款趋势</h3></div><div class="chart-box"><Chart :option="trendOpt" :theme="theme" /></div></div>
      <div class="card"><div class="card-title"><h3>项目销售</h3></div><div class="chart-box"><Chart :option="itemOpt" :theme="theme" /></div></div>
    </div>
    <div class="grid row-even">
      <div class="card"><div class="card-title"><h3>费用科目</h3></div><div class="chart-box"><Chart :option="expenseOpt" :theme="theme" /></div></div>
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
.kpis { grid-template-columns: repeat(3, 1fr); }
.row-2 { grid-template-columns: 1.4fr 1fr; }
.row-even { grid-template-columns: 1fr 1fr; }
@media (max-width: 1100px) { .kpis { grid-template-columns: repeat(2, 1fr); } .row-2, .row-even { grid-template-columns: 1fr; } }
.kpi { gap: 6px; }
.kpi-label { font-size: var(--od-text-sm); color: var(--od-text-muted); }
.kpi-val { font-size: 26px; font-weight: var(--od-weight-bold); font-family: var(--od-font-mono); font-variant-numeric: tabular-nums; }
.chart-box { flex: 1 1 auto; min-height: 280px; width: 100%; }
</style>
