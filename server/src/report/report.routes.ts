import { Router } from 'express';
import { query } from '../db/pool.js';
import { authRequired } from '../auth/auth.middleware.js';

export const reportRouter = Router();
reportRouter.use(authRequired);

// 资金台账(滚动结余):GET /api/shops/:id/ledger?period=YYYY-MM
reportRouter.get('/shops/:id/ledger', async (req, res, next) => {
  try {
    const period = String(req.query.period ?? '');
    if (!/^\d{4}-\d{2}$/.test(period)) return res.status(400).json({ error: 'period required (YYYY-MM)' });
    const shopId = Number(req.params.id);

    const rev = await query(
      `SELECT to_char(date,'YYYY-MM-DD') AS date, (metrics->>'revenue')::numeric AS revenue
       FROM daily_metric WHERE shop_id=$1 AND to_char(date,'YYYY-MM')=$2 ORDER BY date`,
      [shopId, period],
    );
    const exp = await query(
      `SELECT to_char(pay_date,'YYYY-MM-DD') AS date, SUM(amount)::numeric AS expense
       FROM expense WHERE shop_id=$1 AND to_char(pay_date,'YYYY-MM')=$2 GROUP BY pay_date ORDER BY pay_date`,
      [shopId, period],
    );

    const map = new Map<string, { date: string; revenue: number; expense: number; running_balance: number }>();
    for (const r of rev.rows) {
      map.set(String(r.date), { date: String(r.date), revenue: Number(r.revenue ?? 0), expense: 0, running_balance: 0 });
    }
    for (const e of exp.rows) {
      const k = String(e.date);
      if (!map.has(k)) map.set(k, { date: k, revenue: 0, expense: Number(e.expense ?? 0), running_balance: 0 });
      else map.get(k)!.expense = Number(e.expense ?? 0);
    }
    let bal = 0;
    const days = [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
    for (const d of days) { bal += d.revenue - d.expense; d.running_balance = Number(bal.toFixed(2)); }
    res.json({ period, days });
  } catch (e) { next(e); }
});
