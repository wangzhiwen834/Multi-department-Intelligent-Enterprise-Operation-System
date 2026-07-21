<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import type { EChartsOption } from 'echarts';
import { api } from '../api';
import { THEMES, type Theme } from '../theme';
import type { DashboardOverview, Shop } from '../types';
import Chart from '../components/Chart.vue';

const theme: Theme = THEMES['light'];

// ---- 日期状态(Dashboard 自管,无 period prop) ----
const pad = (x: number) => String(x).padStart(2, '0');
const todayIso = (() => { const n = new Date(); return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`; })();
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysInMonth = (y: number, m0: number) => new Date(y, m0 + 1, 0).getDate(); // m0: 0-indexed

const granularity = ref<'day' | 'week' | 'month' | 'year'>('month');
const refDate = ref(todayIso);
const shopId = ref<number | null>(null);
const shops = ref<Shop[]>([]);
const data = ref<DashboardOverview | null>(null);
const err = ref('');

const grains = [
  { key: 'day' as const, label: '日' },
  { key: 'week' as const, label: '周' },
  { key: 'month' as const, label: '月' },
  { key: 'year' as const, label: '年' },
];

// 请求计数器:快速切换粒度/日期时,仅应用最新响应,防止旧响应覆盖新响应。
// 不在 load 起始清空 data.value(保留上次有效数据,避免过渡期空白闪烁)。
let reqId = 0;
const load = () => {
  err.value = '';
  const id = ++reqId;
  api.dashboardOverview(granularity.value, refDate.value, shopId.value ?? undefined)
    .then(r => { if (id === reqId) data.value = r; })
    .catch(e => { if (id === reqId) err.value = e.message; });
};
onMounted(() => {
  api.shops().then(r => { shops.value = r; }).catch(() => {});
  load();
});
watch([granularity, refDate, shopId], load);

// ‹ › 步进:day ±1 天 / week ±7 天 / month ±1 月(日 clamp 到月末) / year ±1 年(日 clamp)
const step = (dir: 1 | -1) => {
  const [y, m, d] = refDate.value.split('-').map(Number); // m 1-indexed
  if (granularity.value === 'day' || granularity.value === 'week') {
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + dir * (granularity.value === 'week' ? 7 : 1));
    refDate.value = isoOf(dt);
  } else if (granularity.value === 'month') {
    const nm0 = (((m - 1 + dir) % 12) + 12) % 12;        // 0-indexed, wrap
    const ny = y + Math.floor((m - 1 + dir) / 12);       // 整年进位
    const nd = Math.min(d, daysInMonth(ny, nm0));
    refDate.value = `${ny}-${pad(nm0 + 1)}-${pad(nd)}`;
  } else { // year
    const ny = y + dir;
    const nd = Math.min(d, daysInMonth(ny, m - 1));
    refDate.value = `${ny}-${pad(m)}-${pad(nd)}`;
  }
};
const goToday = () => { refDate.value = todayIso; };

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const weekdayOf = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return WEEKDAYS[new Date(y, m - 1, d).getDay()]; };

// ISO 周区间(周一始):与后端 dashboard.helpers.ts computeRange('week') 同算法。
// 周一 = date - ((getDay()+6)%7) 天,周日 = 周一 + 6。前端独立从 refDate 计算,
// 不依赖 data.value,避免切换到 week 粒度瞬间仍读到上一区间的 rangeStart/rangeEnd。
const isoWeekRange = (dateStr: string): { start: string; end: string } => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const anchor = new Date(y, m - 1, d);
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() - ((anchor.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: isoOf(monday), end: isoOf(sunday) };
};

// 区间标签:全部从 refDate 派生,不依赖 data.value。
// day=锚点日+周几;week=ISO 周一~周日;month/year=锚点年月。
const rangeLabel = computed(() => {
  const g = granularity.value;
  const [y, m] = refDate.value.split('-').map(Number);
  if (g === 'day') return `${refDate.value} ${weekdayOf(refDate.value)}`;
  if (g === 'week') {
    const { start, end } = isoWeekRange(refDate.value);
    // 同年:完整 ISO 起 + MM-DD 止(规格 §5:2026-07-14 ~ 07-20);跨年:两端完整 ISO
    return start.slice(0, 4) !== end.slice(0, 4) ? `${start} ~ ${end}` : `${start} ~ ${end.slice(5)}`;
  }
  if (g === 'month') return `${y} 年 ${m} 月`;
  return `${y} 年`;
});

const scopeLabel = computed(() => shopId.value
  ? (shops.value.find(s => s.id === shopId.value)?.name ?? '单店')
  : `全部 ${shops.value.length} 店`);

const money = (n: number) => '¥' + (n || 0).toLocaleString('zh-CN', { maximumFractionDigits: 0 });

// 饼图标签:名 + 值(占比);无数据占位只显示"无数据"
const pieLabel = () => ({
  show: true,
  color: theme.text,
  formatter: (p: any) => p.name === '无数据' ? '无数据' : `${p.name}: ${Number(p.value).toLocaleString('zh-CN')} (${p.percent}%)`,
});

const kpiCards = computed(() => {
  const k = data.value?.kpis;
  return [
    { label: '营业收入', val: money(k?.revenue || 0) },
    { label: '总客流', val: (k?.customersTotal || 0).toLocaleString() },
    { label: '平均客单价', val: money(k?.avgCustomerPrice || 0) },
    { label: '充值总额', val: money(k?.rechargeTotal || 0) },
    { label: '总钟数', val: (k?.totalClocks || 0).toLocaleString() },
    { label: '新增会员', val: (k?.newMembers || 0).toLocaleString() },
    { label: '技师出勤', val: `${(k?.therapistAttendance || 0).toLocaleString()} 人天` },
    { label: '技师工资', val: money(k?.therapistWage || 0) },
  ];
});

// ---- 图表(8) ----
// 1. 营收趋势:line(平滑+面积)for day/week/month;bar for year。xAxis label 取后端 revenueTrend[].label
const trendOpt = computed<EChartsOption>(() => {
  const t = data.value?.revenueTrend || [];
  const labels = t.map(x => x.label);
  const vals = t.map(x => x.revenue);
  const isYear = granularity.value === 'year';
  return {
    textStyle: { color: theme.subText },
    grid: { left: 55, right: 20, top: 20, bottom: 30 },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: labels, axisLine: { lineStyle: { color: theme.subText } }, axisLabel: { color: theme.subText } },
    yAxis: { type: 'value', axisLabel: { color: theme.subText }, splitLine: { lineStyle: { color: theme.cardBorder } } },
    series: [isYear
      ? { type: 'bar', data: vals, itemStyle: { color: theme.accent, borderRadius: [6, 6, 0, 0] } }
      : { type: 'line', smooth: true, data: vals, lineStyle: { color: theme.accent }, itemStyle: { color: theme.accent }, areaStyle: { color: theme.accent, opacity: 0.15 } },
    ] as any[],
  };
});

// 2. 客流结构:pie 会员/团购/散客
const customerOpt = computed<EChartsOption>(() => {
  const s = data.value?.customerStructure;
  const items = [
    { name: '会员', value: s?.member || 0 },
    { name: '团购', value: s?.group || 0 },
    { name: '散客', value: s?.walkin || 0 },
  ].filter(i => i.value > 0);
  return {
    textStyle: { color: theme.subText }, tooltip: { trigger: 'item' }, legend: { bottom: 0, textStyle: { color: theme.subText } },
    series: [{ type: 'pie', radius: ['45%', '70%'], center: ['50%', '45%'],
      data: items.length ? items : [{ name: '无数据', value: 1 }],
      color: [theme.palette[0], theme.palette[1], theme.palette[2]], label: pieLabel() }],
  };
});

// 3. 钟数结构:横向堆叠柱(排钟/点钟/加钟),单条堆叠呈现构成
const clockOpt = computed<EChartsOption>(() => {
  const s = data.value?.clockStructure;
  const items = [
    { name: '排钟', value: s?.arranged || 0 },
    { name: '点钟', value: s?.requested || 0 },
    { name: '加钟', value: s?.added || 0 },
  ];
  return {
    textStyle: { color: theme.subText },
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, textStyle: { color: theme.subText } },
    grid: { left: 20, right: 30, top: 24, bottom: 40 },
    xAxis: { type: 'value', show: false },
    yAxis: { type: 'category', data: ['钟数'], show: false },
    series: items.map((it, i) => ({
      name: it.name, type: 'bar', stack: 'total', data: [it.value],
      itemStyle: { color: theme.palette[i % theme.palette.length] },
      label: { show: true, color: theme.text },
    })) as any[],
  };
});

// 4. 充值结构:pie 首充/续充/赠送
const rechargeOpt = computed<EChartsOption>(() => {
  const s = data.value?.rechargeStructure;
  const items = [
    { name: '首充', value: s?.first || 0 },
    { name: '续充', value: s?.renew || 0 },
    { name: '赠送', value: s?.gift || 0 },
  ].filter(i => i.value > 0);
  return {
    textStyle: { color: theme.subText }, tooltip: { trigger: 'item' }, legend: { bottom: 0, textStyle: { color: theme.subText } },
    series: [{ type: 'pie', radius: ['45%', '70%'], center: ['50%', '45%'],
      data: items.length ? items : [{ name: '无数据', value: 1 }],
      color: [theme.palette[0], theme.palette[1], theme.palette[2]], label: pieLabel() }],
  };
});

// 5. 业务结构:pie 足浴/SPA/小项
const structOpt = computed<EChartsOption>(() => {
  const s = data.value?.businessStructure;
  const items = [
    { name: '足浴', value: s?.footbath || 0 },
    { name: 'SPA', value: s?.spa || 0 },
    { name: '小项', value: s?.minor || 0 },
  ].filter(i => i.value > 0);
  return {
    textStyle: { color: theme.subText }, tooltip: { trigger: 'item' }, legend: { bottom: 0, textStyle: { color: theme.subText } },
    series: [{ type: 'pie', radius: ['45%', '70%'], center: ['50%', '45%'],
      data: items.length ? items : [{ name: '无数据', value: 1 }],
      color: [theme.palette[0], theme.palette[1], theme.palette[2]], label: pieLabel() }],
  };
});

// 6. 客流新老:pie 新增会员 / 老客(总客流-新增)。daily_ops 已聚合 KPI,无需后端改动
const customerNewOpt = computed<EChartsOption>(() => {
  const k = data.value?.kpis;
  const newM = k?.newMembers || 0;
  const old = Math.max(0, (k?.customersTotal || 0) - newM);
  const items = [
    { name: '新增会员', value: newM },
    { name: '老客', value: old },
  ].filter(i => i.value > 0);
  return {
    textStyle: { color: theme.subText }, tooltip: { trigger: 'item' }, legend: { bottom: 0, textStyle: { color: theme.subText } },
    series: [{ type: 'pie', radius: ['45%', '70%'], center: ['50%', '45%'],
      data: items.length ? items : [{ name: '无数据', value: 1 }],
      color: [theme.palette[0], theme.palette[1]], label: pieLabel() }],
  };
});

// 7. 充值与消耗:pie 充值总额 / 会员消耗(member_consume 负值取绝对值)
const rechargeFlowOpt = computed<EChartsOption>(() => {
  const k = data.value?.kpis;
  const items = [
    { name: '充值总额', value: k?.rechargeTotal || 0 },
    { name: '会员消耗', value: Math.abs(k?.memberConsume || 0) },
  ].filter(i => i.value > 0);
  return {
    textStyle: { color: theme.subText }, tooltip: { trigger: 'item' }, legend: { bottom: 0, textStyle: { color: theme.subText } },
    series: [{ type: 'pie', radius: ['45%', '70%'], center: ['50%', '45%'],
      data: items.length ? items : [{ name: '无数据', value: 1 }],
      color: [theme.palette[0], theme.palette[1]], label: pieLabel() }],
  };
});

// 8. 门店营收排名:横向柱,点击柱子钻取选店
const rankingOpt = computed<EChartsOption>(() => ({
  textStyle: { color: theme.subText },
  grid: { left: 75, right: 24, top: 20, bottom: 20 },
  tooltip: { trigger: 'axis' },
  xAxis: { type: 'value', axisLabel: { color: theme.subText }, splitLine: { lineStyle: { color: theme.cardBorder } } },
  yAxis: { type: 'category', data: (data.value?.shopRanking || []).map(r => r.shopName), axisLine: { lineStyle: { color: theme.subText } }, axisLabel: { color: theme.text } },
  series: [{ type: 'bar', data: (data.value?.shopRanking || []).map(r => r.revenue), itemStyle: { color: (p: any) => theme.palette[p.dataIndex % theme.palette.length], borderRadius: [0, 6, 6, 0] } }],
}));

const onRankingClick = (p: any) => {
  const r = data.value?.shopRanking[p.dataIndex];
  if (r) shopId.value = r.shopId;
};

// ---- KPI 卡图标/配色(8 个,沿用 --od-* token) ----
const kpiIcons = [
  // 营业收入 ¥
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  // 总客流 users
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/></svg>',
  // 平均客单价 tag
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z"/><circle cx="7" cy="7" r="1.5"/></svg>',
  // 充值总额 credit-card
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>',
  // 总钟数 clock
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  // 新增会员 user-plus
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>',
  // 技师出勤 calendar-check
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m9 16 2 2 4-4"/></svg>',
  // 技师工资 banknote
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>',
];
const kpiTints = [
  { background: 'var(--od-primary-soft)', color: 'var(--od-primary)' },
  { background: 'var(--od-success-soft)', color: 'var(--od-success)' },
  { background: 'var(--od-gold-soft)', color: 'var(--od-gold)' },
  { background: 'var(--od-primary-soft)', color: 'var(--od-palette-4)' },
  { background: 'var(--od-success-soft)', color: 'var(--od-palette-3)' },
  { background: 'var(--od-warning-soft)', color: 'var(--od-warning)' },
  { background: 'var(--od-primary-soft)', color: 'var(--od-palette-2)' },
  { background: 'var(--od-danger-soft)', color: 'var(--od-danger)' },
];
</script>

<template>
  <div class="dashboard-page">
    <div class="dashboard-inner">

      <div class="page-head">
        <div class="head-left">
          <h1>静水楼台·经营驾驶舱</h1>
          <div class="sub">{{ scopeLabel }}</div>
        </div>
        <div class="head-tools">
          <div class="gran-nav">
            <div class="gran-seg">
              <button v-for="g in grains" :key="g.key" class="gran-btn"
                :class="{ active: granularity === g.key }" @click="granularity = g.key">{{ g.label }}</button>
            </div>
            <button class="nav-arrow" @click="step(-1)" title="上一段">‹</button>
            <span class="range-lbl">{{ rangeLabel }}</span>
            <button class="nav-arrow" @click="step(1)" title="下一段">›</button>
            <button class="today-btn" @click="goToday">回到今天</button>
          </div>
          <span class="pill live"><span class="dot"></span>实时同步</span>
          <select class="shop-select" :value="shopId ?? ''"
            @change="shopId = ($event.target as HTMLSelectElement).value ? Number(($event.target as HTMLSelectElement).value) : null">
            <option value="">全部 {{ shops.length }} 店</option>
            <option v-for="s in shops" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </div>
      </div>

      <div v-if="err" class="err-banner">{{ err }}</div>

      <!-- KPI:2 行 × 4 -->
      <div class="grid kpis">
        <div v-for="(k, i) in kpiCards" :key="k.label" class="card kpi">
          <div class="kpi-top">
            <span class="kpi-label">
              <span class="kpi-ico" :style="kpiTints[i]" v-html="kpiIcons[i]"></span>
              {{ k.label }}
            </span>
          </div>
          <div class="kpi-val">{{ k.val }}</div>
        </div>
      </div>

      <!-- 营收趋势 + 客流结构 -->
      <div class="grid row-2">
        <div class="card">
          <div class="card-title"><h3>营收趋势</h3><span class="meta">{{ rangeLabel }}</span></div>
          <div class="chart-box"><Chart :option="trendOpt" :theme="theme" /></div>
        </div>
        <div class="card">
          <div class="card-title"><h3>客流结构</h3><span class="meta">会员 / 团购 / 散客</span></div>
          <div class="chart-box"><Chart :option="customerOpt" :theme="theme" /></div>
        </div>
      </div>

      <!-- 钟数结构 + 充值结构 -->
      <div class="grid row-even">
        <div class="card">
          <div class="card-title"><h3>钟数结构</h3><span class="meta">排钟 / 点钟 / 加钟</span></div>
          <div class="chart-box"><Chart :option="clockOpt" :theme="theme" /></div>
        </div>
        <div class="card">
          <div class="card-title"><h3>充值结构</h3><span class="meta">首充 / 续充 / 赠送</span></div>
          <div class="chart-box"><Chart :option="rechargeOpt" :theme="theme" /></div>
        </div>
      </div>

      <!-- 业务结构 + 支付渠道 -->
      <div class="grid row-even">
        <div class="card">
          <div class="card-title"><h3>业务结构</h3><span class="meta">营收占比</span></div>
          <div class="chart-box"><Chart :option="structOpt" :theme="theme" /></div>
        </div>
        <div class="card">
          <div class="card-title"><h3>客流新老</h3><span class="meta">新增 / 老客</span></div>
          <div class="chart-box"><Chart :option="customerNewOpt" :theme="theme" /></div>
        </div>
      </div>

      <!-- 费用 Top + 门店营收排名 -->
      <div class="grid row-even">
        <div class="card">
          <div class="card-title"><h3>充值与消耗</h3><span class="meta">进账 / 出账</span></div>
          <div class="chart-box"><Chart :option="rechargeFlowOpt" :theme="theme" /></div>
        </div>
        <div class="card">
          <div class="card-title"><h3>门店营收排名</h3><span class="meta">点击柱子钻取门店</span></div>
          <div class="chart-box"><Chart :option="rankingOpt" :theme="theme" :on-click="onRankingClick" /></div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* 令牌 --od-* 为全局,定义于 styles/tokens.css。本页局部样式(移植自 Opendesign/dashboard.html,移除 :root 与任务仪表盘相关样式)。 */
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

/* 卡片 */
.card { background: var(--od-surface); border: 1px solid var(--od-border); border-radius: var(--od-radius-lg); box-shadow: var(--od-shadow-sm); padding: var(--od-space-5); display: flex; flex-direction: column; }
.card-title { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--od-space-4); }
.card-title h3 { font-size: var(--od-text-lg); font-weight: var(--od-weight-semibold); margin: 0; }
.card-title .meta { font-size: var(--od-text-xs); color: var(--od-text-muted); }

.grid { display: grid; gap: var(--od-space-4); }
.kpis { grid-template-columns: repeat(4, 1fr); }
.row-2 { grid-template-columns: 1.4fr 1fr; }
.row-even { grid-template-columns: 1fr 1fr; }
@media (max-width: 1100px) { .kpis { grid-template-columns: repeat(2, 1fr); } .row-2, .row-even { grid-template-columns: 1fr; } }

/* KPI */
.kpi { gap: 6px; transition: all .18s ease; cursor: default; }
.kpi:hover { box-shadow: var(--od-shadow-md); transform: translateY(-2px); border-color: color-mix(in oklab, var(--od-border), black 12%); }
.kpi-top { display: flex; align-items: center; justify-content: space-between; }
.kpi-label { font-size: var(--od-text-sm); color: var(--od-text-muted); display: flex; align-items: center; gap: 8px; }
.kpi-ico { width: 30px; height: 30px; border-radius: var(--od-radius-md); display: grid; place-items: center; flex-shrink: 0; }
.kpi-val { font-size: 26px; font-weight: var(--od-weight-bold); font-family: var(--od-font-mono); font-variant-numeric: tabular-nums; letter-spacing: -.01em; line-height: 1.2; }

/* 图表卡槽:真实 ECharts 填充 */
.chart-box { flex: 1 1 auto; min-height: 280px; width: 100%; }
</style>
