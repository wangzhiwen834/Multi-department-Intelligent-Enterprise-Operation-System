<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import type { EChartsOption } from 'echarts';
import { api } from '../api';
import { THEMES, type Theme } from '../theme';
import type { DashboardOverview, Shop } from '../types';
import Chart from '../components/Chart.vue';

const props = defineProps<{ period: string }>();
const emit = defineEmits<{ (e: 'update:period', p: string): void; (e: 'back'): void }>();

const themeKey = ref('light');
const theme = computed<Theme>(() => THEMES[themeKey.value]);
const shops = ref<Shop[]>([]);
const shopId = ref<number | null>(null);
const data = ref<DashboardOverview | null>(null);
const err = ref('');

const fetch = () => {
  api.dashboardOverview(props.period, shopId.value ?? undefined).then(r => { data.value = r; err.value = ''; }).catch(e => err.value = e.message);
};
onMounted(() => { api.shops().then(r => shops.value = r).catch(() => {}); fetch(); });
watch([() => props.period, shopId], fetch);

const cardStyle = computed(() => ({ background: theme.value.cardBg, border: `1px solid ${theme.value.cardBorder}` }));
const inputStyle = computed(() => ({ background: theme.value.cardBg, color: theme.value.text, border: `1px solid ${theme.value.cardBorder}` }));
const money = (n: number) => '¥' + (n || 0).toLocaleString('zh-CN', { maximumFractionDigits: 0 });

const kpis = computed(() => data.value?.kpis);
const taskPct = computed(() => Math.round((data.value?.taskProgress || 0) * 100));
const timePct = computed(() => Math.round((data.value?.timeProgress || 0) * 100));
const behind = computed(() => taskPct.value < timePct.value);

const trendOpt = computed<EChartsOption>(() => ({
  textStyle: { color: theme.value.subText },
  grid: { left: 55, right: 20, top: 20, bottom: 30 },
  tooltip: { trigger: 'axis' },
  xAxis: { type: 'category', data: (data.value?.revenueTrend || []).map(t => t.date.slice(5)), axisLine: { lineStyle: { color: theme.value.subText } } },
  yAxis: { type: 'value', axisLabel: { color: theme.value.subText }, splitLine: { lineStyle: { color: theme.value.cardBorder } } },
  series: [{ type: 'line', smooth: true, data: (data.value?.revenueTrend || []).map(t => t.revenue), lineStyle: { color: theme.value.accent }, itemStyle: { color: theme.value.accent }, areaStyle: { color: theme.value.accent, opacity: 0.15 } }],
}));

const rankingOpt = computed<EChartsOption>(() => ({
  textStyle: { color: theme.value.subText },
  grid: { left: 75, right: 24, top: 20, bottom: 20 },
  tooltip: { trigger: 'axis' },
  xAxis: { type: 'value', axisLabel: { color: theme.value.subText }, splitLine: { lineStyle: { color: theme.value.cardBorder } } },
  yAxis: { type: 'category', data: (data.value?.shopRanking || []).map(r => r.shopName), axisLine: { lineStyle: { color: theme.value.subText } }, axisLabel: { color: theme.value.text } },
  series: [{ type: 'bar', data: (data.value?.shopRanking || []).map(r => r.revenue), itemStyle: { color: theme.value.accent, borderRadius: [0, 6, 6, 0] } }],
}));

const structOpt = computed<EChartsOption>(() => {
  const s = data.value?.businessStructure;
  return {
    textStyle: { color: theme.value.subText }, tooltip: { trigger: 'item' }, legend: { bottom: 0, textStyle: { color: theme.value.subText } },
    series: [{ type: 'pie', radius: ['45%', '70%'], center: ['50%', '45%'],
      data: [{ name: '足浴', value: s?.footbath || 0 }, { name: 'SPA', value: s?.spa || 0 }, { name: '小项', value: s?.minor || 0 }],
      color: [theme.value.palette[0], theme.value.palette[1], theme.value.palette[2]], label: { color: theme.value.text } }],
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
    textStyle: { color: theme.value.subText }, tooltip: { trigger: 'item' }, legend: { bottom: 0, textStyle: { color: theme.value.subText }, type: 'scroll' },
    series: [{ type: 'pie', radius: '60%', center: ['50%', '45%'], data: items.length ? items : [{ name: '无数据', value: 1 }], color: theme.value.palette, label: { color: theme.value.text } }],
  };
});

const expOpt = computed<EChartsOption>(() => ({
  textStyle: { color: theme.value.subText },
  grid: { left: 85, right: 24, top: 20, bottom: 20 },
  tooltip: { trigger: 'axis' },
  xAxis: { type: 'value', axisLabel: { color: theme.value.subText }, splitLine: { lineStyle: { color: theme.value.cardBorder } } },
  yAxis: { type: 'category', data: (data.value?.expenseBySubject || []).map(e => e.subject).reverse(), axisLabel: { color: theme.value.text } },
  series: [{ type: 'bar', data: (data.value?.expenseBySubject || []).map(e => e.amount).reverse(), itemStyle: { color: theme.value.gold, borderRadius: [0, 6, 6, 0] } }],
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
</script>

<template>
  <div class="h-full overflow-auto" :style="{ background: theme.bg, color: theme.text }">
    <header class="flex flex-wrap items-center gap-3 p-4" :style="{ borderBottom: `1px solid ${theme.cardBorder}` }">
      <button @click="emit('back')" :style="{ color: theme.accent }">← 返回</button>
      <h1 class="text-lg font-medium">📊 足浴经营驾驶舱 · {{ period }}</h1>
      <input type="month" :value="period" @change="emit('update:period', ($event.target as HTMLInputElement).value)" class="rounded-lg px-2 py-1" :style="inputStyle" />
      <select :value="shopId ?? ''" @change="shopId = ($event.target as HTMLSelectElement).value ? Number(($event.target as HTMLSelectElement).value) : null" class="rounded-lg px-2 py-1" :style="inputStyle">
        <option value="">全部 5 店</option>
        <option v-for="s in shops" :key="s.id" :value="s.id">{{ s.name }}</option>
      </select>
      <div class="flex-1"></div>
      <button v-for="t in Object.values(THEMES)" :key="t.key" @click="themeKey = t.key" class="rounded-lg px-3 py-1 text-xs"
        :style="{ background: themeKey === t.key ? t.accent : theme.cardBg, color: themeKey === t.key ? '#000' : theme.subText, border: `1px solid ${theme.cardBorder}` }">
        {{ t.label }}
      </button>
    </header>

    <div v-if="err" class="p-3" :style="{ color: theme.danger }">{{ err }}</div>

    <div class="p-4">
      <div class="grid grid-cols-2 gap-4 md:grid-cols-5">
        <div v-for="k in kpiCards" :key="k.label" class="rounded-xl p-4" :style="cardStyle">
          <div class="text-xs" :style="{ color: theme.subText }">{{ k.label }}</div>
          <div class="mt-1 text-xl font-semibold" :style="{ color: k.danger ? theme.danger : theme.text }">{{ k.val }}</div>
          <div v-if="k.danger" class="text-xs" :style="{ color: theme.danger }">⚠ 落后时间进度 {{ timePct - taskPct }}%</div>
        </div>
      </div>

      <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div class="rounded-xl p-3 md:col-span-2" :style="cardStyle">
          <div class="mb-1 text-sm" :style="{ color: theme.subText }">营业收入趋势(日)</div>
          <div class="h-64"><Chart :option="trendOpt" :theme="theme" /></div>
        </div>
        <div class="rounded-xl p-3" :style="cardStyle">
          <div class="mb-1 text-sm" :style="{ color: theme.subText }">5 店营收对比(点击钻取)</div>
          <div class="h-64"><Chart :option="rankingOpt" :theme="theme" :on-click="onRankingClick" /></div>
        </div>
        <div class="rounded-xl p-3" :style="cardStyle">
          <div class="mb-1 text-sm" :style="{ color: theme.subText }">业务结构</div>
          <div class="h-56"><Chart :option="structOpt" :theme="theme" /></div>
        </div>
        <div class="rounded-xl p-3" :style="cardStyle">
          <div class="mb-1 text-sm" :style="{ color: theme.subText }">支付渠道</div>
          <div class="h-56"><Chart :option="payOpt" :theme="theme" /></div>
        </div>
        <div class="rounded-xl p-3" :style="cardStyle">
          <div class="mb-1 text-sm" :style="{ color: theme.subText }">费用支出 Top 科目</div>
          <div class="h-56"><Chart :option="expOpt" :theme="theme" /></div>
        </div>
      </div>
      <div class="mt-4 text-xs" :style="{ color: theme.subText }">提示:录入数据并"保存并同步"后,大屏自动反映。点 5 店对比柱可钻取单店,顶部可切全部/单店、切主题。</div>
    </div>
  </div>
</template>
