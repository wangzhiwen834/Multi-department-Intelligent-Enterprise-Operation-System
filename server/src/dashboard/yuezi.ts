// 月子会所大屏处理器:按月子指标 key 聚合。KPI hardcode(② 线性成本)。
import { query } from '../db/pool.js';
import { buildTrendSeries } from './dashboard.helpers.js';

export interface YueziParams {
  businessId: number;
  rangeStart: string; rangeEnd: string;
  trendStart: string; trendEnd: string; trendUnit: 'day' | 'month';
  shopId: number | null;
}

const num = (key: string, prefix = 'metrics') =>
  `CASE WHEN ${prefix}->>'${key}' ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (${prefix}->>'${key}')::numeric ELSE 0 END`;
const avg = (key: string) =>
  `AVG(CASE WHEN metrics->>'${key}' ~ '^-?[0-9]+(\\.[0-9]+)?$' AND (metrics->>'${key}')::numeric <> 0 THEN (metrics->>'${key}')::numeric END)`;

const REVENUE_KEYS = ['deposit', 'intent_deposit', 'down_payment', 'balance', 'xiyue_home', 'chankang_sales', 'other_goods', 'renew_balance', 'accompany_fee'];
const REFUND_KEYS = ['refund_deposit', 'other_refund', 'refund_package', 'chankang_refund'];

export async function computeYueziOverview({ businessId, rangeStart, rangeEnd, trendStart, trendEnd, trendUnit, shopId }: YueziParams) {
  const rangeBiz = (start: string, end: string): { sql: string; params: unknown[] } =>
    shopId
      ? { sql: 'AND shop_id IN (SELECT id FROM shop WHERE business_id=$3) AND shop_id=$4', params: [start, end, businessId, shopId] }
      : { sql: 'AND shop_id IN (SELECT id FROM shop WHERE business_id=$3)', params: [start, end, businessId] };

  // 1. KPI(SUM + 日均) + 收款/退款结构(同一行)
  const k = rangeBiz(rangeStart, rangeEnd);
  const allKeys = ['cash_total', 'refund_total', 'occupied_rooms', ...REVENUE_KEYS, ...REFUND_KEYS];
  const sumSelect = allKeys.map(key => `COALESCE(SUM(${num(key)}),0) AS ${key}`).join(',\n         ');
  const kpiRow = (await query(
    `SELECT ${sumSelect}, COALESCE(${avg('occupancy_rate')},0) AS occupancy_rate FROM daily_metric WHERE date BETWEEN $1 AND $2 ${k.sql}`,
    k.params,
  )).rows[0];

  // 2. 费用科目
  const e = rangeBiz(rangeStart, rangeEnd);
  const expenseBySubject = (await query(
    `SELECT COALESCE(NULLIF(subject,''),'(未分类)') AS subject, SUM(amount)::numeric AS amount
     FROM expense WHERE pay_date BETWEEN $1 AND $2 ${e.sql}
     GROUP BY COALESCE(NULLIF(subject,''),'(未分类)') ORDER BY amount DESC LIMIT 10`,
    e.params,
  )).rows.map((r: any) => ({ subject: r.subject, amount: Number(r.amount) }));

  // 3. 门店排名(按 cash_total)
  const shopRanking = (await query(
    `SELECT s.id, s.name,
       COALESCE(SUM(${num('cash_total', 'd.metrics')}),0) AS revenue
     FROM shop s LEFT JOIN daily_metric d ON d.shop_id=s.id AND d.date BETWEEN $1 AND $2
     WHERE s.status='active' AND s.business_id=$3
     GROUP BY s.id, s.name ORDER BY revenue DESC, s.name ASC`,
    [rangeStart, rangeEnd, businessId],
  )).rows.map((r: any) => ({ shopId: r.id, shopName: r.name, revenue: Number(r.revenue) }));

  // 4. 营收趋势(按 cash_total)
  const tParams: unknown[] = shopId ? [trendUnit, trendStart, trendEnd, businessId, shopId] : [trendUnit, trendStart, trendEnd, businessId];
  const tSql = shopId
    ? 'AND shop_id IN (SELECT id FROM shop WHERE business_id=$4) AND shop_id=$5'
    : 'AND shop_id IN (SELECT id FROM shop WHERE business_id=$4)';
  const trendRows = (await query(
    `SELECT to_char(date_trunc($1, date), 'YYYY-MM-DD') AS bucket,
       COALESCE(SUM(${num('cash_total')}),0) AS revenue
     FROM daily_metric WHERE date BETWEEN $2 AND $3 ${tSql}
     GROUP BY bucket ORDER BY bucket`,
    tParams,
  )).rows;
  const revenueTrend = buildTrendSeries(trendStart, trendEnd, trendUnit, trendRows as { bucket: string; revenue: string | number }[]);

  return {
    kpis: {
      cashTotal: Number(kpiRow.cash_total),
      refundTotal: Number(kpiRow.refund_total),
      netCash: Number(Number(kpiRow.cash_total) - Number(kpiRow.refund_total)),
      occupiedRooms: Number(kpiRow.occupied_rooms),
      occupancyRate: Number(Number(kpiRow.occupancy_rate).toFixed(4)),
    },
    revenueTrend,
    revenueStructure: REVENUE_KEYS.reduce((a, key) => { a[key] = Number(kpiRow[key]); return a; }, {} as Record<string, number>),
    refundStructure: REFUND_KEYS.reduce((a, key) => { a[key] = Number(kpiRow[key]); return a; }, {} as Record<string, number>),
    expenseBySubject,
    shopRanking,
  };
}
