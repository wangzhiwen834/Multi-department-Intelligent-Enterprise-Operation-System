import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { query } from '../src/db/pool.js';
import { hashPassword } from '../src/auth/password.js';

beforeEach(async () => {
  await query('DELETE FROM operation_log');
  await query('DELETE FROM app_user');
  await query(
    `INSERT INTO app_user (username,password_hash,name,role) VALUES ('boss',$1,'董事长','chairman')`,
    [await hashPassword('pw123')],
  );
});

describe('audit', () => {
  it('登录成功记日志', async () => {
    await request(app).post('/api/auth/login').send({ username: 'boss', password: 'pw123' });
    const { rows } = await query("SELECT action,result FROM operation_log WHERE action='login'");
    expect(rows).toHaveLength(1);
    expect(rows[0].result).toBe('success');
  });

  it('登录失败记 failed', async () => {
    await request(app).post('/api/auth/login').send({ username: 'boss', password: 'wrong' });
    const { rows } = await query("SELECT result FROM operation_log WHERE action='login'");
    expect(rows[0].result).toBe('failed');
  });
});
