import { Router } from 'express';
import { query } from '../db/pool.js';
import { authRequired } from '../auth/auth.middleware.js';

export const dashboardRouter = Router();
dashboardRouter.use(authRequired);

// GET /api/dashboard/overview?period=YYYY-MM&shopId=<可选,不传=全部店>
dashboardRouter.get('/dashboard/overview', async (req, res, next) => {
  try {
    const period = String(req.query.period ?? '');
    if (!/^\d{4}-\d{2}$/.test(period)) return res.status(400).json({ error: 'period required (YYYY-MM)' });
    const shopId = req.query.shopId ? Number(req.query.shopId) : null;
    const shopFilter = shopId ? 'AND shop_id=$2' : '';
    const params = shopId ? [period, shopId] : [period];

    // KPI
    const kpi = (await query(
      `SELECT
         COALESCE(SUM((metrics->>'revenue')::numeric),0) AS total_revenue,
         COALESCE(SUM((metrics->>'customers_total')::numeric),0) AS total_customers,
         COALESCE(SUM((metrics->>'recharge_total')::numeric),0) AS total_recharge
       FROM daily_metric WHERE to_char(date,'YYYY-MM')=$1 ${shopFilter}`,
      params,
    )).rows[0];
    const totalRevenue = Number(kpi.total_revenue);
    const totalCustomers = Number(kpi.total_customers);
    const avgCustomerPrice = totalCustomers ? totalRevenue / totalCustomers : 0;

    // 营收趋势(按日)
    const trend = (await query(
      `SELECT to_char(date,'YYYY-MM-DD') AS date, COALESCE(SUM((metrics->>'revenue')::numeric),0) AS revenue
       FROM daily_metric WHERE to_char(date,'YYYY-MM')=$1 ${shopFilter}
       GROUP BY date ORDER BY date`,
      params,
    )).rows.map((r: any) => ({ date: r.date, revenue: Number(r.revenue) }));

    // 门店排名(总是全部店,用于对比)
    const ranking = (await query(
      `SELECT s.id, s.name, s.monthly_target,
         COALESCE(SUM((d.metrics->>'revenue')::numeric),0) AS revenue
       FROM shop s LEFT JOIN daily_metric d ON d.shop_id=s.id AND to_char(d.date,'YYYY-MM')=$1
       GROUP BY s.id, s.name, s.monthly_target ORDER BY revenue DESC`,
      [period],
    )).rows.map((r: any) => ({
      shopId: r.id, shopName: r.name, revenue: Number(r.revenue), target: Number(r.monthly_target),
      taskProgress: Number(r.monthly_target) ? Number(r.revenue) / Number(r.monthly_target) : 0,
    }));

    // 业务结构
    const struct = (await query(
      `SELECT
         COALESCE(SUM((metrics->>'footbath_revenue')::numeric),0) AS footbath,
         COALESCE(SUM((metrics->>'spa_revenue')::numeric),0) AS spa,
         COALESCE(SUM((metrics->>'minor_revenue')::numeric),0) AS minor
       FROM daily_metric WHERE to_char(date,'YYYY-MM')=$1 ${shopFilter}`,
      params,
    )).rows[0];

    // 支付渠道
    const pay = (await query(
      `SELECT
         COALESCE(SUM((metrics->>'cash')::numeric),0) AS cash,
         COALESCE(SUM((metrics->>'douyin')::numeric),0) AS douyin,
         COALESCE(SUM((metrics->>'meituan')::numeric),0) AS meituan,
         COALESCE(SUM((metrics->>'pos')::numeric),0) AS pos,
         COALESCE(SUM((metrics->>'alipay')::numeric),0) AS alipay,
         COALESCE(SUM((metrics->>'wechat')::numeric),0) AS wechat
       FROM daily_metric WHERE to_char(date,'YYYY-MM')=$1 ${shopFilter}`,
      params,
    )).rows[0];

    // 费用按科目 Top10
    const expense = (await query(
      `SELECT COALESCE(NULLIF(subject,''),'(未分类)') AS subject, SUM(amount)::numeric AS amount
       FROM expense WHERE to_char(pay_date,'YYYY-MM')=$1 ${shopFilter}
       GROUP BY subject ORDER BY amount DESC LIMIT 10`,
      params,
    )).rows.map((r: any) => ({ subject: r.subject, amount: Number(r.amount) }));

    // 任务/时间进度
    const target = shopId
      ? Number((ranking.find((r: any) => r.shopId === shopId) || { target: 0 }).target)
      : ranking.reduce((s: number, r: any) => s + r.target, 0);
    const taskProgress = target ? totalRevenue / target : 0;
    const now = new Date();
    const [yy, mm] = period.split('-').map(Number);
    const daysInMonth = new Date(yy, mm, 0).getDate();
    const curPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const timeProgress = period === curPeriod ? now.getDate() / daysInMonth : 1;

    res.json({
      period, shopId,
      kpis: {
        totalRevenue, totalCustomers,
        avgCustomerPrice: Number(avgCustomerPrice.toFixed(2)),
        totalRecharge: Number(kpi.total_recharge),
      },
      taskProgress: Number(taskProgress.toFixed(4)),
      timeProgress: Number(timeProgress.toFixed(4)),
      revenueTrend: trend,
      shopRanking: ranking,
      businessStructure: { footbath: Number(struct.footbath), spa: Number(struct.spa), minor: Number(struct.minor) },
      paymentChannels: { cash: Number(pay.cash), douyin: Number(pay.douyin), meituan: Number(pay.meituan), pos: Number(pay.pos), alipay: Number(pay.alipay), wechat: Number(pay.wechat) },
      expenseBySubject: expense,
    });
  } catch (e) { next(e); }
});
