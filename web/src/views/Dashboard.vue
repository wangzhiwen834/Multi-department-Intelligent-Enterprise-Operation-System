<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import type { EChartsOption } from 'echarts';
import { api } from '../api';
import { THEMES, type Theme } from '../theme';
import type { DashboardOverview, Shop } from '../types';
import Chart from '../components/Chart.vue';

const props = defineProps<{ period: string }>();
const emit = defineEmits<{ (e: 'update:period', p: string): void; (e: 'back'): void }>();

const theme: Theme = THEMES['light'];
const shops = ref<Shop[]>([]);
const shopId = ref<number | null>(null);
const data = ref<DashboardOverview | null>(null);
const err = ref('');

const fetch = () => {
  api.dashboardOverview(props.period, shopId.value ?? undefined).then(r => { data.value = r; err.value = ''; }).catch(e => err.value = e.message);
};
onMounted(() => { api.shops().then(r => shops.value = r).catch(() => {}); fetch(); });
watch([() => props.period, shopId], fetch);

const money = (n: number) => '¥' + (n || 0).toLocaleString('zh-CN', { maximumFractionDigits: 0 });

const kpis = computed(() => data.value?.kpis);
const taskPct = computed(() => Math.round((data.value?.taskProgress || 0) * 100));
const timePct = computed(() => Math.round((data.value?.timeProgress || 0) * 100));
const behind = computed(() => taskPct.value < timePct.value);

const trendOpt = computed<EChartsOption>(() => ({
  textStyle: { color: theme.subText },
  grid: { left: 55, right: 20, top: 20, bottom: 30 },
  tooltip: { trigger: 'axis' },
  xAxis: { type: 'category', data: (data.value?.revenueTrend || []).map(t => t.date.slice(5)), axisLine: { lineStyle: { color: theme.subText } } },
  yAxis: { type: 'value', axisLabel: { color: theme.subText }, splitLine: { lineStyle: { color: theme.cardBorder } } },
  series: [{ type: 'line', smooth: true, data: (data.value?.revenueTrend || []).map(t => t.revenue), lineStyle: { color: theme.accent }, itemStyle: { color: theme.accent }, areaStyle: { color: theme.accent, opacity: 0.15 } }],
}));

const rankingOpt = computed<EChartsOption>(() => ({
  textStyle: { color: theme.subText },
  grid: { left: 75, right: 24, top: 20, bottom: 20 },
  tooltip: { trigger: 'axis' },
  xAxis: { type: 'value', axisLabel: { color: theme.subText }, splitLine: { lineStyle: { color: theme.cardBorder } } },
  yAxis: { type: 'category', data: (data.value?.shopRanking || []).map(r => r.shopName), axisLine: { lineStyle: { color: theme.subText } }, axisLabel: { color: theme.text } },
  series: [{ type: 'bar', data: (data.value?.shopRanking || []).map(r => r.revenue), itemStyle: { color: (p: any) => theme.palette[p.dataIndex % theme.palette.length], borderRadius: [0, 6, 6, 0] } }],
}));

const structOpt = computed<EChartsOption>(() => {
  const s = data.value?.businessStructure;
  return {
    textStyle: { color: theme.subText }, tooltip: { trigger: 'item' }, legend: { bottom: 0, textStyle: { color: theme.subText } },
    series: [{ type: 'pie', radius: ['45%', '70%'], center: ['50%', '45%'],
      data: [{ name: '足浴', value: s?.footbath || 0 }, { name: 'SPA', value: s?.spa || 0 }, { name: '小项', value: s?.minor || 0 }],
      color: [theme.palette[0], theme.palette[1], theme.palette[2]], label: { color: theme.text } }],
  };
});

const payOpt = computed<EChartsOption>(() => {
  const p = data.value?.paymentChannels;
  const items = [
    { name: '微信', value: p?.wechat || 0 }, { name: '美团', value: p?.meituan || 0 },
    { name: '抖音', value: p?.douyin || 0 }, { name: '支付宝', value: p?.alipay || 0 },
    { name: 'POS', value: p?.pos || 0 }, { name: '现金', value: p?.cash || 0 },
  ].filter(i => i.value > 0);
  return {
    textStyle: { color: theme.subText }, tooltip: { trigger: 'item' }, legend: { bottom: 0, textStyle: { color: theme.subText }, type: 'scroll' },
    series: [{ type: 'pie', radius: '60%', center: ['50%', '45%'], data: items.length ? items : [{ name: '无数据', value: 1 }], color: theme.palette, label: { color: theme.text } }],
  };
});

const expOpt = computed<EChartsOption>(() => ({
  textStyle: { color: theme.subText },
  grid: { left: 85, right: 24, top: 20, bottom: 20 },
  tooltip: { trigger: 'axis' },
  xAxis: { type: 'value', axisLabel: { color: theme.subText }, splitLine: { lineStyle: { color: theme.cardBorder } } },
  yAxis: { type: 'category', data: (data.value?.expenseBySubject || []).map(e => e.subject).reverse(), axisLabel: { color: theme.text } },
  series: [{ type: 'bar', data: (data.value?.expenseBySubject || []).map(e => e.amount).reverse(), itemStyle: { color: theme.gold, borderRadius: [0, 6, 6, 0] } }],
}));

const onRankingClick = (p: any) => {
  const r = data.value?.shopRanking[p.dataIndex];
  if (r) shopId.value = r.shopId;
};

const kpiCards = computed(() => [
  { label: '总营业收入', val: money(kpis.value?.totalRevenue || 0) },
  { label: '总客流', val: (kpis.value?.totalCustomers || 0).toLocaleString() },
  { label: '平均客单价', val: money(kpis.value?.avgCustomerPrice || 0) },
  { label: '充值总额', val: money(kpis.value?.totalRecharge || 0) },
  { label: '任务完成', val: `${taskPct.value}% / 时间 ${timePct.value}%`, danger: behind.value },
]);

// ---- OpenDesign 卡片布局辅助(以上 ECharts/数据逻辑保持不变) ----
const kpiIcons = [
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/></svg>',
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4"/></svg>',
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>',
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
];
const kpiTints = [
  { background: 'var(--od-primary-soft)', color: 'var(--od-primary)' },
  { background: 'var(--od-success-soft)', color: 'var(--od-success)' },
  { background: 'var(--od-gold-soft)', color: 'var(--od-gold)' },
  { background: 'var(--od-primary-soft)', color: 'var(--od-palette-4)' },
  { background: 'var(--od-danger-soft)', color: 'var(--od-danger)' },
];
const kpiTint = (i: number, danger: boolean) => {
  if (i === 4 && !danger) return { background: 'var(--od-success-soft)', color: 'var(--od-success)' };
  return kpiTints[i];
};

// 5 店店标色,按 index 循环取 --od-palette-1..5(与 light 主题 palette 一致)
const shopPalette = ['var(--od-palette-1)', 'var(--od-palette-2)', 'var(--od-palette-3)', 'var(--od-palette-4)', 'var(--od-palette-5)'];
const taskRows = computed(() => (data.value?.shopRanking || []).map((r, i) => {
  const tp = Math.round((r.taskProgress || 0) * 100);
  const diff = tp - timePct.value;
  const badge = diff >= 2 ? { cls: 'badge-success', text: '超前' } : diff <= -2 ? { cls: 'badge-danger', text: '落后' } : { cls: 'badge-warning', text: '持平' };
  return { r, tp, color: shopPalette[i % 5], badge, late: diff <= -2 };
}));

const scopeLabel = computed(() => shopId.value ? (shops.value.find(s => s.id === shopId.value)?.name ?? '单店') : '5 店汇总');
const paceNote = computed(() => behind.value
  ? `落后时间进度 ${timePct.value - taskPct.value} 个百分点`
  : `超前时间进度 ${taskPct.value - timePct.value} 个百分点`);
const GAUGE_CIRC = Math.round(2 * Math.PI * 50); // 314
const gaugeOffset = computed(() => GAUGE_CIRC * (1 - (taskPct.value || 0) / 100));
</script>

<template>
  <div class="dashboard-page">
    <div class="dashboard-inner">

      <div class="page-head">
        <div>
          <h1>静水楼台·经营驾驶舱</h1>
          <div class="sub">{{ period }} · {{ scopeLabel }}</div>
        </div>
        <div class="head-tools">
          <span class="pill live"><span class="dot"></span>实时同步</span>
          <select class="shop-select" :value="shopId ?? ''"
            @change="shopId = ($event.target as HTMLSelectElement).value ? Number(($event.target as HTMLSelectElement).value) : null">
            <option value="">全部 5 店</option>
            <option v-for="s in shops" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </div>
      </div>

      <div v-if="err" class="err-banner">{{ err }}</div>

      <!-- KPI -->
      <div class="grid kpis">
        <div v-for="(k, i) in kpiCards" :key="k.label" class="card kpi">
          <div class="kpi-top">
            <span class="kpi-label">
              <span class="kpi-ico" :style="kpiTint(i, !!k.danger)" v-html="kpiIcons[i]"></span>
              {{ k.label }}
            </span>
          </div>
          <div class="kpi-val" :class="{ danger: k.danger }">{{ k.val }}</div>
          <div v-if="k.danger" class="kpi-warn">⚠ 落后时间进度 {{ timePct - taskPct }}%</div>
        </div>
      </div>

      <!-- 任务仪表盘 + 营收趋势 -->
      <div class="grid row-2">
        <div class="card">
          <div class="card-title"><h3>任务仪表盘</h3><span class="meta">月度目标 vs 时间进度</span></div>
          <div class="gauge-wrap">
            <div class="gauge">
              <svg width="120" height="120" viewBox="0 0 120 120">
                <circle class="gauge-bg" cx="60" cy="60" r="50"/>
                <circle class="gauge-fg" cx="60" cy="60" r="50"
                  :stroke-dasharray="GAUGE_CIRC"
                  :stroke-dashoffset="gaugeOffset"
                  :style="{ stroke: behind ? 'var(--od-danger)' : 'var(--od-primary)' }"/>
                <circle class="gauge-ring" cx="60" cy="60" r="36"/>
              </svg>
              <div class="gauge-center">
                <div class="pct" :class="{ danger: behind }">{{ taskPct }}%</div>
                <div class="lbl">任务进度</div>
              </div>
            </div>
            <div class="gauge-legend">
              <div class="legend-item"><span class="legend-sw" :style="{ background: behind ? 'var(--od-danger)' : 'var(--od-primary)' }"></span>任务进度<span class="legend-val">{{ taskPct }}%</span></div>
              <div class="legend-item"><span class="legend-sw" style="background:var(--od-border)"></span>时间进度<span class="legend-val">{{ timePct }}%</span></div>
              <div class="legend-item legend-note" :style="{ color: behind ? 'var(--od-danger)' : 'var(--od-success)' }">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg>
                {{ paceNote }}
              </div>
            </div>
          </div>
          <table class="task-table">
            <thead><tr><th>门店</th><th>任务进度</th><th>时间进度</th><th></th><th style="text-align:right">完成/目标</th></tr></thead>
            <tbody>
              <tr v-for="row in taskRows" :key="row.r.shopId" :class="{ late: row.late }">
                <td>{{ row.r.shopName }}</td>
                <td><div class="mini-bar"><i :style="{ width: row.tp + '%', background: row.color }"></i><span class="mark" :style="{ left: timePct + '%' }"></span></div></td>
                <td><span class="num">{{ timePct }}%</span></td>
                <td><span class="badge" :class="row.badge.cls">{{ row.badge.text }}</span></td>
                <td style="text-align:right" class="num">{{ money(row.r.revenue) }} / {{ money(row.r.target) }}</td>
              </tr>
              <tr v-if="!taskRows.length"><td colspan="5" class="empty">暂无数据</td></tr>
            </tbody>
          </table>
        </div>

        <div class="card">
          <div class="card-title"><h3>营收趋势</h3><span class="meta">{{ period }} · 日营收(元)</span></div>
          <div class="chart-box"><Chart :option="trendOpt" :theme="theme" /></div>
        </div>
      </div>

      <!-- 5 店排名 + 业务结构 -->
      <div class="grid row-2">
        <div class="card">
          <div class="card-title"><h3>5 店营收排名</h3><span class="meta">点击柱子钻取门店</span></div>
          <div class="chart-box"><Chart :option="rankingOpt" :theme="theme" :on-click="onRankingClick" /></div>
        </div>
        <div class="card">
          <div class="card-title"><h3>业务结构</h3><span class="meta">营收占比</span></div>
          <div class="chart-box"><Chart :option="structOpt" :theme="theme" /></div>
        </div>
      </div>

      <!-- 支付渠道 + 费用Top -->
      <div class="grid row-2">
        <div class="card">
          <div class="card-title"><h3>支付渠道</h3><span class="meta">收款占比</span></div>
          <div class="chart-box"><Chart :option="payOpt" :theme="theme" /></div>
        </div>
        <div class="card">
          <div class="card-title"><h3>费用 Top 5</h3><span class="meta">本月支出</span></div>
          <div class="chart-box"><Chart :option="expOpt" :theme="theme" /></div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* 令牌 --od-* 为全局,定义于 styles/tokens.css。此处仅本页局部样式(移植自 Opendesign/dashboard.html,移除 :root)。 */
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
.num { font-family: var(--od-font-mono); font-variant-numeric: tabular-nums; }

/* 页头 */
.page-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.page-head h1 { font-size: var(--od-text-2xl); font-weight: var(--od-weight-bold); margin: 0; }
.page-head .sub { font-size: var(--od-text-sm); color: var(--od-text-muted); margin-top: 2px; }
.head-tools { display: flex; align-items: center; gap: 10px; }
.pill { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border: 1px solid var(--od-border); border-radius: var(--od-radius-md); background: var(--od-surface); font-size: var(--od-text-sm); font-weight: var(--od-weight-medium); color: var(--od-text); }
.pill.live { color: var(--od-success); }
.dot { width: 7px; height: 7px; border-radius: 50%; background: var(--od-success); box-shadow: 0 0 0 3px var(--od-success-soft); }
.shop-select { display: inline-flex; align-items: center; height: 32px; padding: 0 10px; border: 1px solid var(--od-border); border-radius: var(--od-radius-md); background: var(--od-surface); color: var(--od-text); font-family: inherit; font-size: var(--od-text-sm); font-weight: var(--od-weight-medium); cursor: pointer; transition: border-color .15s ease; }
.shop-select:hover { border-color: var(--od-primary); }

.err-banner { color: color-mix(in oklab, var(--od-danger), black 10%); background: var(--od-danger-soft); padding: var(--od-space-3) var(--od-space-4); border-radius: var(--od-radius-md); font-size: var(--od-text-sm); border: 1px solid color-mix(in oklab, var(--od-danger), white 30%); }

/* 卡片 */
.card { background: var(--od-surface); border: 1px solid var(--od-border); border-radius: var(--od-radius-lg); box-shadow: var(--od-shadow-sm); padding: var(--od-space-5); display: flex; flex-direction: column; }
.card-title { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--od-space-4); }
.card-title h3 { font-size: var(--od-text-lg); font-weight: var(--od-weight-semibold); margin: 0; }
.card-title .meta { font-size: var(--od-text-xs); color: var(--od-text-muted); }

.grid { display: grid; gap: var(--od-space-4); }
.kpis { grid-template-columns: repeat(5, 1fr); }
.row-2 { grid-template-columns: 1.4fr 1fr; }
@media (max-width: 1100px) { .kpis { grid-template-columns: repeat(2, 1fr); } .row-2 { grid-template-columns: 1fr; } }

/* KPI */
.kpi { gap: 6px; transition: all .18s ease; cursor: default; }
.kpi:hover { box-shadow: var(--od-shadow-md); transform: translateY(-2px); border-color: color-mix(in oklab, var(--od-border), black 12%); }
.kpi-top { display: flex; align-items: center; justify-content: space-between; }
.kpi-label { font-size: var(--od-text-sm); color: var(--od-text-muted); display: flex; align-items: center; gap: 8px; }
.kpi-ico { width: 30px; height: 30px; border-radius: var(--od-radius-md); display: grid; place-items: center; flex-shrink: 0; }
.kpi-val { font-size: 26px; font-weight: var(--od-weight-bold); font-family: var(--od-font-mono); font-variant-numeric: tabular-nums; letter-spacing: -.01em; line-height: 1.2; }
.kpi-val.danger { color: var(--od-danger); }
.kpi-warn { font-size: var(--od-text-xs); color: var(--od-danger); font-weight: var(--od-weight-medium); }

/* 任务仪表盘 */
.gauge-wrap { display: flex; align-items: center; gap: var(--od-space-6); flex-wrap: wrap; }
.gauge { position: relative; width: 120px; height: 120px; flex-shrink: 0; }
.gauge svg { transform: rotate(-90deg); }
.gauge-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.gauge-center .pct { font-size: 24px; font-weight: var(--od-weight-bold); font-family: var(--od-font-mono); color: var(--od-text); }
.gauge-center .pct.danger { color: var(--od-danger); }
.gauge-center .lbl { font-size: var(--od-text-xs); color: var(--od-text-muted); }
.gauge-bg { fill: none; stroke: var(--od-surface-2); stroke-width: 12; }
.gauge-fg { fill: none; stroke-width: 12; stroke-linecap: round; transition: stroke-dashoffset .4s ease, stroke .2s ease; }
.gauge-ring { fill: none; stroke: var(--od-border); stroke-width: 2; stroke-dasharray: 4 4; }
.gauge-legend { flex: 1; display: flex; flex-direction: column; gap: 10px; min-width: 180px; }
.legend-item { display: flex; align-items: center; gap: 8px; font-size: var(--od-text-sm); color: var(--od-text); }
.legend-sw { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
.legend-val { margin-left: auto; font-family: var(--od-font-mono); font-weight: var(--od-weight-semibold); }
.legend-note { font-size: var(--od-text-xs); font-weight: var(--od-weight-medium); }
.legend-note svg { flex-shrink: 0; }

.task-table { margin-top: var(--od-space-4); width: 100%; border-collapse: collapse; font-size: var(--od-text-sm); }
.task-table th { text-align: left; font-weight: var(--od-weight-medium); color: var(--od-text-muted); padding: 6px 8px; border-bottom: 1px solid var(--od-border); }
.task-table td { padding: 8px; border-bottom: 1px solid var(--od-border); }
.task-table tr.late td { background: var(--od-danger-soft); }
.task-table .empty { text-align: center; color: var(--od-text-muted); }
.mini-bar { height: 6px; border-radius: 3px; background: var(--od-surface-2); overflow: visible; position: relative; width: 90px; }
.mini-bar i { position: absolute; top: 0; left: 0; height: 100%; border-radius: 3px; }
.mini-bar .mark { position: absolute; top: -2px; bottom: -2px; width: 2px; background: var(--od-text-muted); opacity: .5; }
.badge { display: inline-flex; align-items: center; gap: 4px; height: 20px; padding: 0 8px; border-radius: var(--od-radius-full); font-size: var(--od-text-xs); font-weight: var(--od-weight-medium); }
.badge-success { background: var(--od-success-soft); color: color-mix(in oklab, var(--od-success), black 20%); }
.badge-warning { background: var(--od-warning-soft); color: color-mix(in oklab, var(--od-warning), black 25%); }
.badge-danger { background: var(--od-danger-soft); color: color-mix(in oklab, var(--od-danger), black 20%); }

/* 图表卡槽:真实 ECharts 填充 */
.chart-box { flex: 1 1 auto; min-height: 280px; width: 100%; }
</style>
