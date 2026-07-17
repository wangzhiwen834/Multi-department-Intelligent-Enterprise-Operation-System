import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { query } from '../src/db/pool.js';
import { hashPassword } from '../src/auth/password.js';
import { resetDb } from './helpers.js';

beforeEach(async () => {
  await resetDb();
  await query(
    `INSERT INTO app_user (username,password_hash,name,role,department)
     VALUES ('boss',$1,'董事长','chairman',NULL)`,
    [await hashPassword('pw123')],
  );
});

describe('auth', () => {
  it('login 成功返回 token', async () => {
    const r = await request(app).post('/api/auth/login').send({ username: 'boss', password: 'pw123' });
    expect(r.status).toBe(200);
    expect(r.body.token).toBeTypeOf('string');
    expect(r.body.user.role).toBe('chairman');
  });

  it('密码错误 401', async () => {
    const r = await request(app).post('/api/auth/login').send({ username: 'boss', password: 'wrong' });
    expect(r.status).toBe(401);
  });

  it('/me 需要登录', async () => {
    const r = await request(app).get('/api/auth/me');
    expect(r.status).toBe(401);
  });

  it('/me 带 token 返回当前用户', async () => {
    const login = await request(app).post('/api/auth/login').send({ username: 'boss', password: 'pw123' });
    const r = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`);
    expect(r.status).toBe(200);
    expect(r.body.username).toBe('boss');
  });
});
