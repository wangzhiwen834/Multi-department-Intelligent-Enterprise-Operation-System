import { Router } from 'express';
import { query } from '../db/pool.js';
import { authRequired } from '../auth/auth.middleware.js';
import { computeRange, isValidYmd, buildTrendSeries, type Granularity } from './dashboard.helpers.js';

export const dashboardRouter = Router();
dashboardRouter.use(authRequired);

const VALID_GRAINS: Granularity[] = ['day', 'week', 'month', 'year'];

// I-1 兜底:metrics 是无 schema JSONB,读侧每个数值键强转前先正则判定,非数字当 0(防脏数据 500)。
const KPI_KEYS = ['revenue','customers_total','recharge_total','total_clocks','new_members','therapist_attendance','therapist_wage','member_consume','customers_member','customers_group','customers_walkin','clocks_arranged','clocks_requested','clocks_added','recharge_first','recharge_renew','recharge_gift','footbath_revenue','spa_revenue','minor_revenue','cash','douyin','meituan','pos','alipay','wechat'];
const numGuard = (key: string, prefix = 'metrics') =>
  `CASE WHEN ${prefix}->>'${key}' ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (${prefix}->>'${key}')::numeric ELSE 0 END`;
const KPI_SELECT = KPI_KEYS.map(k => `COALESCE(SUM(${numGuard(k)}),0) AS ${k}`).join(',\n         ');

const todayISO = () => {
  const n = new Date();
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
};

// GET /api/dashboard/overview?granularity=day|week|month|year&date=YYYY-MM-DD&shopId=<可选>
// 向后兼容:?period=YYYY-MM(无 date) -> granularity=month, date=period+'-01'
dashboardRouter.get('/dashboard/overview', async (req, res, next) => {
  try {
    const grainRaw = req.query.granularity ? String(req.query.granularity) : '';
    const periodRaw = req.query.period ? String(req.query.period) : '';
    const dateRaw = req.query.date ? String(req.query.date) : '';

    // 校验 period:存在(非空)则必须 YYYY-MM 且月份 01-12,否则 400。
    // 防止 period=2026-13 经 parseISO 溢出为 2027-01 之类的问题。
    if (periodRaw && !/^\d{4}-(0[1-9]|1[0-2])$/.test(periodRaw)) {
      return res.status(400).json({ error: 'period invalid (YYYY-MM)' });
    }

    let granularity: string;
    let dateStr: string;

    if (dateRaw) {
      // 显式传 date:以 date 为锚点,granularity 缺省 month
      granularity = grainRaw || 'month';
      dateStr = isValidYmd(dateRaw) ? dateRaw : todayISO();
    } else if (periodRaw) {
      // 向后兼容:period=YYYY-MM(上面已校验月份 01-12)且无 date -> month + period-01。
      // 月份 01-12 时 period+'-01' 必为合法日历日,无需再校验。
      granularity = 'month';
      dateStr = `${periodRaw}-01`;
    } else {
      granularity = grainRaw || 'month';
      dateStr = todayISO();
    }

    if (!VALID_GRAINS.includes(granularity as Granularity)) {
      return res.status(400).json({ error: 'granularity must be one of day,week,month,year' });
    }
    const grain = granularity as Granularity;

    // 校验 shopId:存在则必须为正整数,否则 400(?shopId=0 / abc / 2.5 均非法)。
    // shopId=null 表示全部店汇总;响应中 shopId 与过滤口径一致(never 0/NaN)。
    const sidRaw = req.query.shopId;
    let shopId: number | null;
    if (sidRaw !== undefined && sidRaw !== null && String(sidRaw) !== '') {
      const sidStr = String(sidRaw);
      if (!/^\d+$/.test(sidStr) || Number(sidStr) <= 0) {
        return res.status(400).json({ error: 'shopId invalid' });
      }
      shopId = Number(sidStr);
    } else {
      shopId = null;
    }
    const { rangeStart, rangeEnd, trendStart, trendEnd, trendUnit } = computeRange(grain, dateStr);

    // 区间 + 门店过滤的参数构造(date/pay_date BETWEEN $1 AND $2 [+ AND shop_id=$3])
    const rangeShop = (start: string, end: string): { sql: string; params: unknown[] } =>
      shopId
        ? { sql: 'AND shop_id=$3', params: [start, end, shopId] }
        : { sql: '', params: [start, end] };

    // ---- 查询 1:KPI + 所有结构(同一行多 key SUM)----
    const k = rangeShop(rangeStart, rangeEnd);
    const kpiRow = (await query(
      `SELECT
         ${KPI_SELECT}
       FROM daily_metric WHERE date BETWEEN $1 AND $2 ${k.sql}`,
      k.params,
    )).rows[0];

    const revenue = Number(kpiRow.revenue);
    const customersTotal = Number(kpiRow.customers_total);
    const avgCustomerPrice = customersTotal ? revenue / customersTotal : 0;

    // ---- 查询 2:费用按科目 Top10 ----
    // GROUP BY 用与 SELECT 相同的 COALESCE(NULLIF(...))表达式,使 NULL 与 '' 合并为一组。
    const e = rangeShop(rangeStart, rangeEnd);
    const expenseBySubject = (await query(
      `SELECT COALESCE(NULLIF(subject,''),'(未分类)') AS subject, SUM(amount)::numeric AS amount
       FROM expense WHERE pay_date BETWEEN $1 AND $2 ${e.sql}
       GROUP BY COALESCE(NULLIF(subject,''),'(未分类)') ORDER BY amount DESC LIMIT 10`,
      e.params,
    )).rows.map((r: any) => ({ subject: r.subject, amount: Number(r.amount) }));

    // ---- 查询 3:门店排名(总是全店对比,忽略 shopId)----
    // 同营收时按店名升序,保证排序确定(避免抖动)。
    const shopRanking = (await query(
      `SELECT s.id, s.name,
         COALESCE(SUM(${numGuard('revenue', 'd.metrics')}),0) AS revenue
       FROM shop s LEFT JOIN daily_metric d ON d.shop_id=s.id AND d.date BETWEEN $1 AND $2
       GROUP BY s.id, s.name ORDER BY revenue DESC, s.name ASC`,
      [rangeStart, rangeEnd],
    )).rows.map((r: any) => ({ shopId: r.id, shopName: r.name, revenue: Number(r.revenue) }));

    // ---- 查询 4:营收趋势(按 trendUnit 桶聚合)----
    // 桶用 to_char(date_trunc(...), 'YYYY-MM-DD') 输出稳定 YYYY-MM-DD 字符串,
    // 便于 JS 侧与完整序列对齐做 0 填充:SQL 只返回有数据行的桶,无法表达空桶。
    const tParams: unknown[] = shopId
      ? [trendUnit, trendStart, trendEnd, shopId]
      : [trendUnit, trendStart, trendEnd];
    const tSql = shopId ? 'AND shop_id=$4' : '';
    const trendRows = (await query(
      `SELECT to_char(date_trunc($1, date), 'YYYY-MM-DD') AS bucket,
         COALESCE(SUM(${numGuard('revenue')}),0) AS revenue
       FROM daily_metric WHERE date BETWEEN $2 AND $3 ${tSql}
       GROUP BY bucket ORDER BY bucket`,
      tParams,
    )).rows;
    // 构造完整桶序列并 0 填充:day->trendStart..trendEnd 每日;month->每月首日。
    // day=14 点 / week=7 点 / month=当月天数 / year=12 点,升序,缺失桶 revenue=0。
    const revenueTrend = buildTrendSeries(
      trendStart,
      trendEnd,
      trendUnit,
      trendRows as { bucket: string; revenue: string | number }[],
    );

    res.json({
      granularity: grain,
      date: dateStr,
      rangeStart,
      rangeEnd,
      shopId,
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
      customerStructure: {
        member: Number(kpiRow.customers_member),
        group: Number(kpiRow.customers_group),
        walkin: Number(kpiRow.customers_walkin),
      },
      clockStructure: {
        arranged: Number(kpiRow.clocks_arranged),
        requested: Number(kpiRow.clocks_requested),
        added: Number(kpiRow.clocks_added),
      },
      rechargeStructure: {
        first: Number(kpiRow.recharge_first),
        renew: Number(kpiRow.recharge_renew),
        gift: Number(kpiRow.recharge_gift),
      },
      businessStructure: {
        footbath: Number(kpiRow.footbath_revenue),
        spa: Number(kpiRow.spa_revenue),
        minor: Number(kpiRow.minor_revenue),
      },
      paymentChannels: {
        cash: Number(kpiRow.cash),
        douyin: Number(kpiRow.douyin),
        meituan: Number(kpiRow.meituan),
        pos: Number(kpiRow.pos),
        alipay: Number(kpiRow.alipay),
        wechat: Number(kpiRow.wechat),
      },
      expenseBySubject,
      shopRanking,
    });
  } catch (e) { next(e); }
});
