import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { verifyPassword } from './password.js';
import { signToken } from './jwt.js';
import { authRequired } from './auth.middleware.js';
import { logOperation } from '../audit/audit.log.js';

const LoginBody = z.object({ username: z.string(), password: z.string() });
export const authRouter = Router();

authRouter.post('/login', async (req, res, next) => {
  try {
    const { username, password } = LoginBody.parse(req.body);
    const { rows } = await query<{
      id: number; username: string; password_hash: string; name: string;
      role: 'chairman' | 'manager' | 'employee'; department: string | null;
      status: string;
    }>(
      'SELECT id,username,password_hash,name,role,department,status FROM app_user WHERE username=$1',
      [username],
    );
    const u = rows[0];
    const ip = req.ip ?? '';
    if (!u || u.status !== 'active' || !(await verifyPassword(password, u.password_hash))) {
      await logOperation({
        userId: u?.id ?? null,
        userName: username,
        ip,
        action: 'login',
        result: 'failed',
        detail: { username },
      });
      return res.status(401).json({ error: 'invalid credentials' });
    }
    await query('UPDATE app_user SET last_login_ip=$1, last_login_at=now() WHERE id=$2', [ip, u.id]);
    await logOperation({ userId: u.id, userName: u.username, ip, action: 'login', result: 'success' });
    const token = signToken({ id: u.id, username: u.username, role: u.role, department: u.department });
    res.json({
      token,
      user: { id: u.id, username: u.username, name: u.name, role: u.role, department: u.department },
    });
  } catch (e) {
    next(e);
  }
});

authRouter.get('/me', authRequired, async (req, res) => {
  const { rows } = await query(
    'SELECT id,username,name,role,department,phone FROM app_user WHERE id=$1',
    [req.user!.id],
  );
  res.json(rows[0] ?? null);
});
