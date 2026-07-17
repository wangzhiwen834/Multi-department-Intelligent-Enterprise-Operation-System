import { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { api } from './api';
import { THEMES, type Theme } from './theme';
import type { DashboardOverview, Shop } from './types';

function Chart({ option, theme, onClick }: { option: echarts.EChartsOption; theme: Theme; onClick?: (p: any) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const clickRef = useRef(onClick);
  clickRef.current = onClick;

  useEffect(() => {
    if (!ref.current) return;
    if (!chartRef.current) chartRef.current = echarts.init(ref.current);
    chartRef.current.setOption(option, true);
  }, [option]);

  useEffect(() => {
    if (!chartRef.current) return;
    const handler = (p: any) => clickRef.current?.(p);
    chartRef.current.on('click', handler);
    return () => { chartRef.current?.off('click', handler); };
  }, []);

  useEffect(() => {
    const ro = new ResizeObserver(() => chartRef.current?.resize());
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => { chartRef.current?.resize(); }, [theme]);

  return <div ref={ref} className="h-full w-full" />;
}

const money = (n: number) => '¥' + (n || 0).toLocaleString('zh-CN', { maximumFractionDigits: 0 });

export function Dashboard({ period, onPeriod, onBack }: { period: string; onPeriod: (p: string) => void; onBack: () => void }) {
  const [themeKey, setThemeKey] = useState('dark');
  const theme = THEMES[themeKey];
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopId, setShopId] = useState<number | null>(null);
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => { api.shops().then(setShops).catch(() => {}); }, []);
  useEffect(() => {
    api.dashboardOverview(period, shopId ?? undefined).then(setData).catch(e => setErr(e.message));
  }, [period, shopId]);

  const cardStyle = { background: theme.cardBg, border: `1px solid ${theme.cardBorder}` };
  const inputStyle = { background: theme.cardBg, color: theme.text, border: `1px solid ${theme.cardBorder}` };

  const trendOpt = useMemo<echarts.EChartsOption>(() => ({
    textStyle: { color: theme.subText },
    grid: { left: 55, right: 20, top: 20, bottom: 30 },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: (data?.revenueTrend || []).map(t => t.date.slice(5)), axisLine: { lineStyle: { color: theme.subText } } },
    yAxis: { type: 'value', axisLabel: { color: theme.subText }, splitLine: { lineStyle: { color: theme.cardBorder } } },
    series: [{ type: 'line', smooth: true, data: (data?.revenueTrend || []).map(t => t.revenue), lineStyle: { color: theme.accent }, itemStyle: { color: theme.accent }, areaStyle: { color: theme.accent, opacity: 0.15 } }],
  }), [theme, data]);

  const rankingOpt = useMemo<echarts.EChartsOption>(() => ({
    textStyle: { color: theme.subText },
    grid: { left: 75, right: 24, top: 20, bottom: 20 },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'value', axisLabel: { color: theme.subText }, splitLine: { lineStyle: { color: theme.cardBorder } } },
    yAxis: { type: 'category', data: (data?.shopRanking || []).map(r => r.shopName), axisLine: { lineStyle: { color: theme.subText } }, axisLabel: { color: theme.text } },
    series: [{ type: 'bar', data: (data?.shopRanking || []).map(r => r.revenue), itemStyle: { color: theme.accent, borderRadius: [0, 6, 6, 0] } }],
  }), [theme, data]);

  const structOpt = useMemo<echarts.EChartsOption>(() => {
    const s = data?.businessStructure;
    return {
      textStyle: { color: theme.subText }, tooltip: { trigger: 'item' }, legend: { bottom: 0, textStyle: { color: theme.subText } },
      series: [{ type: 'pie', radius: ['45%', '70%'], center: ['50%', '45%'],
        data: [{ name: '足浴', value: s?.footbath || 0 }, { name: 'SPA', value: s?.spa || 0 }, { name: '小项', value: s?.minor || 0 }],
        color: [theme.palette[0], theme.palette[1], theme.palette[2]], label: { color: theme.text } }],
    };
  }, [theme, data]);

  const payOpt = useMemo<echarts.EChartsOption>(() => {
    const p = data?.paymentChannels;
    const items = [
      { name: '微信', value: p?.wechat || 0 }, { name: '美团', value: p?.meituan || 0 },
      { name: '抖音', value: p?.douyin || 0 }, { name: '支付宝', value: p?.alipay || 0 },
      { name: 'POS', value: p?.pos || 0 }, { name: '现金', value: p?.cash || 0 },
    ].filter(i => i.value > 0);
    return {
      textStyle: { color: theme.subText }, tooltip: { trigger: 'item' }, legend: { bottom: 0, textStyle: { color: theme.subText }, type: 'scroll' },
      series: [{ type: 'pie', radius: '60%', center: ['50%', '45%'], data: items.length ? items : [{ name: '无数据', value: 1 }], color: theme.palette, label: { color: theme.text } }],
    };
  }, [theme, data]);

  const expOpt = useMemo<echarts.EChartsOption>(() => ({
    textStyle: { color: theme.subText },
    grid: { left: 85, right: 24, top: 20, bottom: 20 },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'value', axisLabel: { color: theme.subText }, splitLine: { lineStyle: { color: theme.cardBorder } } },
    yAxis: { type: 'category', data: (data?.expenseBySubject || []).map(e => e.subject).reverse(), axisLabel: { color: theme.text } },
    series: [{ type: 'bar', data: (data?.expenseBySubject || []).map(e => e.amount).reverse(), itemStyle: { color: theme.gold, borderRadius: [0, 6, 6, 0] } }],
  }), [theme, data]);

  const kpis = data?.kpis;
  const taskPct = Math.round((data?.taskProgress || 0) * 100);
  const timePct = Math.round((data?.timeProgress || 0) * 100);
  const behind = taskPct < timePct;

  return (
    <div className="h-full overflow-auto" style={{ background: theme.bg, color: theme.text }}>
      <header className="flex flex-wrap items-center gap-3 p-4" style={{ borderBottom: `1px solid ${theme.cardBorder}` }}>
        <button onClick={onBack} style={{ color: theme.accent }}>← 返回</button>
        <h1 className="text-lg font-medium">📊 足浴经营驾驶舱 · {period}</h1>
        <input type="month" value={period} onChange={e => onPeriod(e.target.value)} className="rounded px-2 py-1" style={inputStyle} />
        <select value={shopId ?? ''} onChange={e => setShopId(e.target.value ? Number(e.target.value) : null)} className="rounded px-2 py-1" style={inputStyle}>
          <option value="">全部 5 店</option>
          {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className="flex-1" />
        {Object.values(THEMES).map(t => (
          <button key={t.key} onClick={() => setThemeKey(t.key)} className="rounded px-3 py-1 text-xs"
            style={{ background: themeKey === t.key ? t.accent : theme.cardBg, color: themeKey === t.key ? '#000' : theme.subText, border: `1px solid ${theme.cardBorder}` }}>
            {t.label}
          </button>
        ))}
      </header>

      {err && <div className="p-3" style={{ color: theme.danger }}>{err}</div>}

      <div className="p-4">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {([
            { label: '总营业收入', val: money(kpis?.totalRevenue || 0) },
            { label: '总客流', val: (kpis?.totalCustomers || 0).toLocaleString() },
            { label: '平均客单价', val: money(kpis?.avgCustomerPrice || 0) },
            { label: '充值总额', val: money(kpis?.totalRecharge || 0) },
            { label: '任务完成', val: `${taskPct}% / 时间 ${timePct}%`, danger: behind },
          ] as const).map(k => (
            <div key={k.label} className="rounded-xl p-4" style={cardStyle}>
              <div className="text-xs" style={{ color: theme.subText }}>{k.label}</div>
              <div className="mt-1 text-xl font-semibold" style={{ color: 'danger' in k && k.danger ? theme.danger : theme.text }}>{k.val}</div>
              {'danger' in k && k.danger && <div className="text-xs" style={{ color: theme.danger }}>⚠ 落后时间进度 {timePct - taskPct}%</div>}
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl p-3 md:col-span-2" style={cardStyle}>
            <div className="mb-1 text-sm" style={{ color: theme.subText }}>营业收入趋势(日)</div>
            <div className="h-64"><Chart option={trendOpt} theme={theme} /></div>
          </div>
          <div className="rounded-xl p-3" style={cardStyle}>
            <div className="mb-1 text-sm" style={{ color: theme.subText }}>5 店营收对比(点击钻取)</div>
            <div className="h-64"><Chart option={rankingOpt} theme={theme} onClick={(p) => { const r = data?.shopRanking[p.dataIndex]; if (r) setShopId(r.shopId); }} /></div>
          </div>
          <div className="rounded-xl p-3" style={cardStyle}>
            <div className="mb-1 text-sm" style={{ color: theme.subText }}>业务结构</div>
            <div className="h-56"><Chart option={structOpt} theme={theme} /></div>
          </div>
          <div className="rounded-xl p-3" style={cardStyle}>
            <div className="mb-1 text-sm" style={{ color: theme.subText }}>支付渠道</div>
            <div className="h-56"><Chart option={payOpt} theme={theme} /></div>
          </div>
          <div className="rounded-xl p-3" style={cardStyle}>
            <div className="mb-1 text-sm" style={{ color: theme.subText }}>费用支出 Top 科目</div>
            <div className="h-56"><Chart option={expOpt} theme={theme} /></div>
          </div>
        </div>
        <div className="mt-4 text-xs" style={{ color: theme.subText }}>提示:录入数据并"保存并同步"后,大屏自动反映。点 5 店对比柱可钻取单店,顶部可切全部/单店、切主题。</div>
      </div>
    </div>
  );
}
