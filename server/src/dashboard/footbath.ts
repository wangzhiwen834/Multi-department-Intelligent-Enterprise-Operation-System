// 足浴大屏处理器:从 dashboard.routes 抽出,加业务过滤(多业务下隔离)。
// 行为与原 routes 内联逻辑等价(足浴数据下结果不变),payload 形状不变。
import { query } from '../db/pool.js';
import { buildTrendSeries } from './dashboard.helpers.js';

export interface FootbathParams {
  businessId: number;
  rangeStart: string; rangeEnd: string;
  trendStart: string; trendEnd: string; trendUnit: 'day' | 'month';
  shopId: number | null;
}

const KPI_KEYS = ['revenue','customers_total','recharge_total','total_clocks','new_members','therapist_attendance','therapist_wage','member_consume','customers_member','customers_group','customers_walkin','clocks_arranged','clocks_requested','clocks_added','recharge_first','recharge_renew','recharge_gift','footbath_revenue','spa_revenue','minor_revenue','cash','douyin','meituan','pos','alipay','wechat'];
const numGuard = (key: string, prefix = 'metrics') =>
  `CASE WHEN ${prefix}->>'${key}' ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (${prefix}->>'${key}')::numeric ELSE 0 END`;
const KPI_SELECT = KPI_KEYS.map(k => `COALESCE(SUM(${numGuard(k)}),0) AS ${k}`).join(',\n         ');

export async function computeFootbathOverview({ businessId, rangeStart, rangeEnd, trendStart, trendEnd, trendUnit, shopId }: FootbathParams) {
  // 业务 + 门店过滤(shop_id IN 该业务的店 [+ 指定店])
  const rangeBiz = (start: string, end: string): { sql: string; params: unknown[] } =>
    shopId
      ? { sql: 'AND shop_id IN (SELECT id FROM shop WHERE business_id=$3) AND shop_id=$4', params: [start, end, businessId, shopId] }
      : { sql: 'AND shop_id IN (SELECT id FROM shop WHERE business_id=$3)', params: [start, end, businessId] };

  // 1. KPI + 结构
  const k = rangeBiz(rangeStart, rangeEnd);
  const kpiRow = (await query(
    `SELECT ${KPI_SELECT} FROM daily_metric WHERE date BETWEEN $1 AND $2 ${k.sql}`,
    k.params,
  )).rows[0];
  const revenue = Number(kpiRow.revenue);
  const customersTotal = Number(kpiRow.customers_total);
  const avgCustomerPrice = customersTotal ? revenue / customersTotal : 0;

  // 2. 费用科目 Top10
  const e = rangeBiz(rangeStart, rangeEnd);
  const expenseBySubject = (await query(
    `SELECT COALESCE(NULLIF(subject,''),'(未分类)') AS subject, SUM(amount)::numeric AS amount
     FROM expense WHERE pay_date BETWEEN $1 AND $2 ${e.sql}
     GROUP BY COALESCE(NULLIF(subject,''),'(未分类)') ORDER BY amount DESC LIMIT 10`,
    e.params,
  )).rows.map((r: any) => ({ subject: r.subject, amount: Number(r.amount) }));

  // 3. 门店排名(该业务内,同营收按店名升序)
  const shopRanking = (await query(
    `SELECT s.id, s.name,
       COALESCE(SUM(${numGuard('revenue', 'd.metrics')}),0) AS revenue
     FROM shop s LEFT JOIN daily_metric d ON d.shop_id=s.id AND d.date BETWEEN $1 AND $2
     WHERE s.status='active' AND s.business_id=$3
     GROUP BY s.id, s.name ORDER BY revenue DESC, s.name ASC`,
    [rangeStart, rangeEnd, businessId],
  )).rows.map((r: any) => ({ shopId: r.id, shopName: r.name, revenue: Number(r.revenue) }));

  // 4. 营收趋势(按 trendUnit 桶)
  const tParams: unknown[] = shopId ? [trendUnit, trendStart, trendEnd, businessId, shopId] : [trendUnit, trendStart, trendEnd, businessId];
  const tSql = shopId
    ? 'AND shop_id IN (SELECT id FROM shop WHERE business_id=$4) AND shop_id=$5'
    : 'AND shop_id IN (SELECT id FROM shop WHERE business_id=$4)';
  const trendRows = (await query(
    `SELECT to_char(date_trunc($1, date), 'YYYY-MM-DD') AS bucket,
       COALESCE(SUM(${numGuard('revenue')}),0) AS revenue
     FROM daily_metric WHERE date BETWEEN $2 AND $3 ${tSql}
     GROUP BY bucket ORDER BY bucket`,
    tParams,
  )).rows;
  const revenueTrend = buildTrendSeries(trendStart, trendEnd, trendUnit, trendRows as { bucket: string; revenue: string | number }[]);

  return {
    kpis: {
      revenue,
      customersTotal,
      avgCustomerPrice: Number(avgCustomerPrice.toFixed(2)),
      rechargeTotal: Number(kpiRow.recharge_total),
      totalClocks: Number(kpiRow.total_clocks),
      newMembers: Number(kpiRow.new_members),
      therapistAttendance: Number(kpiRow.therapist_attendance),
      therapistWage: Number(kpiRow.therapist_wage),
      memberConsume: Number(kpiRow.member_consume),
    },
    revenueTrend,
    customerStructure: { member: Number(kpiRow.customers_member), group: Number(kpiRow.customers_group), walkin: Number(kpiRow.customers_walkin) },
    clockStructure: { arranged: Number(kpiRow.clocks_arranged), requested: Number(kpiRow.clocks_requested), added: Number(kpiRow.clocks_added) },
    rechargeStructure: { first: Number(kpiRow.recharge_first), renew: Number(kpiRow.recharge_renew), gift: Number(kpiRow.recharge_gift) },
    businessStructure: { footbath: Number(kpiRow.footbath_revenue), spa: Number(kpiRow.spa_revenue), minor: Number(kpiRow.minor_revenue) },
    paymentChannels: { cash: Number(kpiRow.cash), douyin: Number(kpiRow.douyin), meituan: Number(kpiRow.meituan), pos: Number(kpiRow.pos), alipay: Number(kpiRow.alipay), wechat: Number(kpiRow.wechat) },
    expenseBySubject,
    shopRanking,
  };
}
