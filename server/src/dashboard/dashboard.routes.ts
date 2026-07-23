import { Router } from 'express';
import { query } from '../db/pool.js';
import { authRequired } from '../auth/auth.middleware.js';
import { computeRange, isValidYmd, type Granularity } from './dashboard.helpers.js';
import { computeFootbathOverview } from './footbath.js';

export const dashboardRouter = Router();
dashboardRouter.use(authRequired);

const VALID_GRAINS: Granularity[] = ['day', 'week', 'month', 'year'];

const todayISO = () => {
  const n = new Date();
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
};

const HANDLERS: Record<string, (p: any) => Promise<any>> = {
  footbath: computeFootbathOverview,
};

// GET /api/dashboard/overview?businessCode=footbath|hotel&granularity=...&date=YYYY-MM-DD&shopId=...
// 缺省 businessCode=footbath(向后兼容)。业务无处理器 -> 501。
dashboardRouter.get('/dashboard/overview', async (req, res, next) => {
  try {
    const grainRaw = req.query.granularity ? String(req.query.granularity) : '';
    const periodRaw = req.query.period ? String(req.query.period) : '';
    const dateRaw = req.query.date ? String(req.query.date) : '';

    if (periodRaw && !/^\d{4}-(0[1-9]|1[0-2])$/.test(periodRaw)) {
      return res.status(400).json({ error: 'period invalid (YYYY-MM)' });
    }

    let granularity: string;
    let dateStr: string;
    if (dateRaw) { granularity = grainRaw || 'month'; dateStr = isValidYmd(dateRaw) ? dateRaw : todayISO(); }
    else if (periodRaw) { granularity = 'month'; dateStr = `${periodRaw}-01`; }
    else { granularity = grainRaw || 'month'; dateStr = todayISO(); }

    if (!VALID_GRAINS.includes(granularity as Granularity)) {
      return res.status(400).json({ error: 'granularity must be one of day,week,month,year' });
    }
    const grain = granularity as Granularity;

    // shopId 校验
    const sidRaw = req.query.shopId;
    let shopId: number | null;
    if (sidRaw !== undefined && sidRaw !== null && String(sidRaw) !== '') {
      const sidStr = String(sidRaw);
      if (!/^\d+$/.test(sidStr) || Number(sidStr) <= 0) return res.status(400).json({ error: 'shopId invalid' });
      shopId = Number(sidStr);
    } else { shopId = null; }

    // businessCode 解析(缺省 footbath)+ 业务存在性
    const businessCode = req.query.businessCode ? String(req.query.businessCode) : 'footbath';
    const biz = (await query<{ id: number }>('SELECT id FROM business WHERE code=$1', [businessCode])).rows[0];
    if (!biz) return res.status(404).json({ error: '业务不存在' });

    // shopId 必须属于该业务
    if (shopId) {
      const s = (await query('SELECT 1 FROM shop WHERE id=$1 AND business_id=$2', [shopId, biz.id])).rows[0];
      if (!s) return res.status(400).json({ error: 'shopId 不属于该业务' });
    }

    const handler = HANDLERS[businessCode];
    if (!handler) return res.status(501).json({ error: '该业务大屏尚未实现' });

    const { rangeStart, rangeEnd, trendStart, trendEnd, trendUnit } = computeRange(grain, dateStr);
    const payload = await handler({ businessId: biz.id, rangeStart, rangeEnd, trendStart, trendEnd, trendUnit, shopId });

    res.json({ granularity: grain, date: dateStr, rangeStart, rangeEnd, shopId, ...payload });
  } catch (e) { next(e); }
});
