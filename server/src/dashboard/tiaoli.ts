// 调理馆大屏处理器:按调理馆指标 key 聚合。KPI hardcode(② 线性成本:加业态各写一个)。
import { query } from '../db/pool.js';
import { buildTrendSeries } from './dashboard.helpers.js';

export interface TiaoliParams {
  businessId: number;
  rangeStart: string; rangeEnd: string;
  trendStart: string; trendEnd: string; trendUnit: 'day' | 'month';
  shopId: number | null;
}

const num = (key: string, prefix = 'metrics') =>
  `CASE WHEN ${prefix}->>'${key}' ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (${prefix}->>'${key}')::numeric ELSE 0 END`;

// 禧SPA儿童 项目销售 keys
const XISPA_KEYS = ['cika', 'swimwear', 'swimming', 'baby_herbal', 'haircut', 'diaper', 'other_goods'];
// 悦SPA产康调理 项目销售 keys
const YUESPA_KEYS = ['birth_checkup', 'bone_conditioning', 'skin_care', 'postpartum_rehab', 'assistive_device', 'fat_loss', 'head_therapy', 'fahan', 'lactation', 'card'];

export async function computeTiaoliOverview({ businessId, rangeStart, rangeEnd, trendStart, trendEnd, trendUnit, shopId }: TiaoliParams) {
  const rangeBiz = (start: string, end: string): { sql: string; params: unknown[] } =>
    shopId
      ? { sql: 'AND shop_id IN (SELECT id FROM shop WHERE business_id=$3) AND shop_id=$4', params: [start, end, businessId, shopId] }
      : { sql: 'AND shop_id IN (SELECT id FROM shop WHERE business_id=$3)', params: [start, end, businessId] };

  // 1. KPI(total_receipt + refund_total)+ 全部项目销售(同一行 SUM)
  const k = rangeBiz(rangeStart, rangeEnd);
  const allKeys = ['total_receipt', 'refund_total', ...XISPA_KEYS, ...YUESPA_KEYS];
  const sumSelect = allKeys.map(key => `COALESCE(SUM(${num(key)}),0) AS ${key}`).join(',\n         ');
  const kpiRow = (await query(
    `SELECT ${sumSelect} FROM daily_metric WHERE date BETWEEN $1 AND $2 ${k.sql}`,
    k.params,
  )).rows[0];

  // 2. 费用科目 Top10
  const e = rangeBiz(rangeStart, rangeEnd);
  const expenseBySubject = (await query(
    `SELECT COALESCE(NULLIF(subject,''),'(未分类)') AS subject, SUM(amount)::numeric AS amount
     FROM expense WHERE pay_date BETWEEN $1 AND $2 ${e.sql}
     GROUP BY COALESCE(NULLIF(subject,''),'(未分类)') ORDER BY amount DESC LIMIT 10`,
    e.params,
  )).rows.map((r: any) => ({ subject: r.subject, amount: Number(r.amount) }));

  // 3. 门店排名(按 total_receipt)
  const shopRanking = (await query(
    `SELECT s.id, s.name,
       COALESCE(SUM(${num('total_receipt', 'd.metrics')}),0) AS revenue
     FROM shop s LEFT JOIN daily_metric d ON d.shop_id=s.id AND d.date BETWEEN $1 AND $2
     WHERE s.status='active' AND s.business_id=$3
     GROUP BY s.id, s.name ORDER BY revenue DESC, s.name ASC`,
    [rangeStart, rangeEnd, businessId],
  )).rows.map((r: any) => ({ shopId: r.id, shopName: r.name, revenue: Number(r.revenue) }));

  // 4. 营收趋势(按 total_receipt)
  const tParams: unknown[] = shopId ? [trendUnit, trendStart, trendEnd, businessId, shopId] : [trendUnit, trendStart, trendEnd, businessId];
  const tSql = shopId
    ? 'AND shop_id IN (SELECT id FROM shop WHERE business_id=$4) AND shop_id=$5'
    : 'AND shop_id IN (SELECT id FROM shop WHERE business_id=$4)';
  const trendRows = (await query(
    `SELECT to_char(date_trunc($1, date), 'YYYY-MM-DD') AS bucket,
       COALESCE(SUM(${num('total_receipt')}),0) AS revenue
     FROM daily_metric WHERE date BETWEEN $2 AND $3 ${tSql}
     GROUP BY bucket ORDER BY bucket`,
    tParams,
  )).rows;
  const revenueTrend = buildTrendSeries(trendStart, trendEnd, trendUnit, trendRows as { bucket: string; revenue: string | number }[]);

  // 5. 项目销售结构(禧SPA / 悦SPA 两组)
  const xispaStructure = XISPA_KEYS.reduce((acc, key) => { acc[key] = Number(kpiRow[key]); return acc; }, {} as Record<string, number>);
  const yuespaStructure = YUESPA_KEYS.reduce((acc, key) => { acc[key] = Number(kpiRow[key]); return acc; }, {} as Record<string, number>);

  return {
    kpis: {
      totalReceipt: Number(kpiRow.total_receipt),
      refundTotal: Number(kpiRow.refund_total),
      netReceipt: Number(Number(kpiRow.total_receipt) - Number(kpiRow.refund_total)),
    },
    revenueTrend,
    xispaStructure,
    yuespaStructure,
    expenseBySubject,
    shopRanking,
  };
}
