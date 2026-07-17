import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { authRequired } from '../auth/auth.middleware.js';
import { requireRole } from './rbac.middleware.js';
import { canCreateManager, canManageTarget } from './permissions.js';
import { hashPassword } from '../auth/password.js';
import { auditLog } from '../audit/audit.middleware.js';

const CreateBody = z.object({
  username: z.string(),
  password: z.string(),
  name: z.string(),
  role: z.enum(['chairman', 'manager', 'employee']),
  department: z.string().nullable().optional(),
  phone: z.string().optional(),
});

const PatchBody = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  status: z.enum(['active', 'disabled']).optional(),
  department: z.string().nullable().optional(),
});

export const userRouter = Router();
userRouter.use(authRequired);

// 列表:董事长看全部;经理看本部门(含自己)
userRouter.get('/', async (req, res, next) => {
  try {
    if (req.user!.role === 'chairman') {
      const { rows } = await query(
        'SELECT id,username,name,role,department,phone,status,created_at FROM app_user ORDER BY id',
      );
      return res.json(rows);
    }
    if (req.user!.role === 'manager') {
      const { rows } = await query(
        'SELECT id,username,name,role,department,phone,status,created_at FROM app_user WHERE department=$1 OR id=$2 ORDER BY id',
        [req.user!.department, req.user!.id],
      );
      return res.json(rows);
    }
    return res.status(403).json({ error: 'forbidden' });
  } catch (e) {
    next(e);
  }
});

// 创建:董事长可创建经理/员工;经理只能创建员工
userRouter.post(
  '/',
  requireRole('chairman', 'manager'),
  auditLog('user.create'),
  async (req, res, next) => {
    try {
      const b = CreateBody.parse(req.body);
      if (b.role === 'chairman') return res.status(403).json({ error: '不能创建董事长' });
      if (b.role === 'manager' && !canCreateManager(req.user!.role))
        return res.status(403).json({ error: '只有董事长能创建经理' });
      const hash = await hashPassword(b.password);
      const { rows } = await query(
        `INSERT INTO app_user (username,password_hash,name,role,department,phone,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING id,username,name,role,department,phone,status`,
        [b.username, hash, b.name, b.role, b.department ?? null, b.phone ?? null, req.user!.id],
      );
      res.status(201).json(rows[0]);
    } catch (e) {
      next(e);
    }
  },
);

// 改/禁用
userRouter.patch('/:id', auditLog('user.update'), async (req, res, next) => {
  try {
    const { rows: found } = await query<{ role: string; department: string | null; created_by: number | null; id: number }>(
      'SELECT role,department,created_by,id FROM app_user WHERE id=$1',
      [req.params.id],
    );
    const target = found[0];
    if (!target) return res.status(404).json({ error: 'not found' });
    if (!canManageTarget({ role: req.user!.role, department: req.user!.department }, target as never, req.user!.id))
      return res.status(403).json({ error: '无权管理该用户' });
    const b = PatchBody.parse(req.body);
    const { rows: updated } = await query(
      `UPDATE app_user SET name=COALESCE($2,name),phone=COALESCE($3,phone),status=COALESCE($4,status),department=COALESCE($5,department) WHERE id=$1
       RETURNING id,username,name,role,department,phone,status`,
      [req.params.id, b.name ?? null, b.phone ?? null, b.status ?? null, b.department ?? null],
    );
    res.json(updated[0]);
  } catch (e) {
    next(e);
  }
});

// 删除(软删=禁用)
userRouter.delete('/:id', auditLog('user.delete'), async (req, res, next) => {
  try {
    const { rows: found } = await query<{ role: string; department: string | null; created_by: number | null; id: number }>(
      'SELECT role,department,created_by,id FROM app_user WHERE id=$1',
      [req.params.id],
    );
    const target = found[0];
    if (!target) return res.status(404).json({ error: 'not found' });
    if (!canManageTarget({ role: req.user!.role, department: req.user!.department }, target as never, req.user!.id))
      return res.status(403).json({ error: '无权管理该用户' });
    await query('UPDATE app_user SET status=$2 WHERE id=$1', [req.params.id, 'disabled']);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
