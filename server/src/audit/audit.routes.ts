import { Router } from 'express';
import { query } from '../db/pool.js';
import { authRequired } from '../auth/auth.middleware.js';
import { requireRole } from '../rbac/rbac.middleware.js';

// 操作日志查询:仅董事长 / 经理可见。
export const auditRouter = Router();
auditRouter.use(authRequired, requireRole('chairman', 'manager'));

// GET /api/audit/logs?page=&pageSize=&action=&result=&q=&from=&to=
auditRouter.get('/logs', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize as string, 10) || 50));
    const action = typeof req.query.action === 'string' ? req.query.action.trim() : '';
    const result = req.query.result === 'success' || req.query.result === 'failed' ? req.query.result : '';
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const from = typeof req.query.from === 'string' ? req.query.from.trim() : '';
    const to = typeof req.query.to === 'string' ? req.query.to.trim() : '';

    const conds: string[] = [];
    const params: unknown[] = [];
    if (action) { params.push(action); conds.push(`action = $${params.length}`); }
    if (result) { params.push(result); conds.push(`result = $${params.length}`); }
    if (q) { params.push(`%${q}%`); conds.push(`(user_name ILIKE $${params.length} OR target ILIKE $${params.length} OR action ILIKE $${params.length} OR ip ILIKE $${params.length})`); }
    if (from) { params.push(from); conds.push(`created_at >= $${params.length}`); }
    if (to) { params.push(`${to} 23:59:59`); conds.push(`created_at <= $${params.length}`); }
    const whereSql = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const countRes = await query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM operation_log ${whereSql}`, params);
    const total = countRes.rows[0].c;

    params.push(pageSize);
    const limitN = `$${params.length}`;
    params.push((page - 1) * pageSize);
    const offN = `$${params.length}`;
    const { rows } = await query(
      `SELECT id, user_id, user_name, ip, action, target, detail, result, created_at
       FROM operation_log ${whereSql} ORDER BY created_at DESC LIMIT ${limitN} OFFSET ${offN}`,
      params,
    );

    res.json({ items: rows, total, page, pageSize });
  } catch (e) {
    next(e);
  }
});
