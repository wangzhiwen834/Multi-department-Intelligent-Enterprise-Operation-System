import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { query } from '../src/db/pool.js';
import { hashPassword } from '../src/auth/password.js';
import { resetDb } from './helpers.js';

let wbId: number;
let bossT: string;
let mgrT: string;

async function login(u: string) {
  return (await request(app).post('/api/auth/login').send({ username: u, password: 'pw123' })).body.token as string;
}

async function seedOne() {
  const b = (await query("INSERT INTO business (code,name) VALUES ('footbath','足浴') RETURNING id")).rows[0];
  await query('INSERT INTO template (business_id, version, definition) VALUES ($1,1,$2)', [b.id, JSON.stringify({ sheets: [] })]);
  const s = (await query("INSERT INTO shop (business_id, code, name) VALUES ($1,'dk','大河坎店') RETURNING id", [b.id])).rows[0];
  const w = (await query("INSERT INTO workbook (shop_id, period, template_version) VALUES ($1,'2026-07',1) RETURNING id", [s.id])).rows[0];
  return w.id;
}

beforeEach(async () => {
  await resetDb();
  wbId = await seedOne();
  await query("INSERT INTO app_user (username,password_hash,name,role) VALUES ('boss',$1,'董事长','chairman')", [await hashPassword('pw123')]);
  await query("INSERT INTO app_user (username,password_hash,name,role) VALUES ('mgr1',$1,'经理','manager')", [await hashPassword('pw123')]);
  bossT = await login('boss');
  mgrT = await login('mgr1');
});

describe('悲观锁(工作表级)', () => {
  it('占锁成功', async () => {
    const r = await request(app).post(`/api/workbooks/${wbId}/locks/daily_ops`).set('Authorization', `Bearer ${bossT}`);
    expect(r.status).toBe(201);
    expect(r.body.acquired).toBe(true);
  });

  it('他人占用时返回 heldBy(409)', async () => {
    await request(app).post(`/api/workbooks/${wbId}/locks/daily_ops`).set('Authorization', `Bearer ${bossT}`);
    const r = await request(app).post(`/api/workbooks/${wbId}/locks/daily_ops`).set('Authorization', `Bearer ${mgrT}`);
    expect(r.status).toBe(409);
    expect(r.body.acquired).toBe(false);
    expect(r.body.heldBy.user_name).toBe('boss');
  });

  it('持有者心跳续约成功', async () => {
    await request(app).post(`/api/workbooks/${wbId}/locks/daily_ops`).set('Authorization', `Bearer ${bossT}`);
    const r = await request(app).put(`/api/workbooks/${wbId}/locks/daily_ops`).set('Authorization', `Bearer ${bossT}`);
    expect(r.status).toBe(200);
    expect(r.body.renewed).toBe(true);
  });

  it('非持有者心跳失败(409)', async () => {
    await request(app).post(`/api/workbooks/${wbId}/locks/daily_ops`).set('Authorization', `Bearer ${bossT}`);
    const r = await request(app).put(`/api/workbooks/${wbId}/locks/daily_ops`).set('Authorization', `Bearer ${mgrT}`);
    expect(r.status).toBe(409);
    expect(r.body.renewed).toBe(false);
  });

  it('过期后可被接管', async () => {
    await request(app).post(`/api/workbooks/${wbId}/locks/daily_ops`).set('Authorization', `Bearer ${bossT}`);
    await query("UPDATE sheet_lock SET expires_at = now() - interval '1 second' WHERE workbook_id=$1", [wbId]);
    const r = await request(app).post(`/api/workbooks/${wbId}/locks/daily_ops/takeover`).set('Authorization', `Bearer ${mgrT}`);
    expect(r.status).toBe(201);
    expect(r.body.acquired).toBe(true);
    expect(r.body.lock.user_name).toBe('mgr1');
  });

  it('未过期时接管失败(409)', async () => {
    await request(app).post(`/api/workbooks/${wbId}/locks/daily_ops`).set('Authorization', `Bearer ${bossT}`);
    const r = await request(app).post(`/api/workbooks/${wbId}/locks/daily_ops/takeover`).set('Authorization', `Bearer ${mgrT}`);
    expect(r.status).toBe(409);
  });

  it('持有者释放后状态为空', async () => {
    await request(app).post(`/api/workbooks/${wbId}/locks/daily_ops`).set('Authorization', `Bearer ${bossT}`);
    const r = await request(app).delete(`/api/workbooks/${wbId}/locks/daily_ops`).set('Authorization', `Bearer ${bossT}`);
    expect(r.body.released).toBe(true);
    const st = await request(app).get(`/api/workbooks/${wbId}/locks/daily_ops`).set('Authorization', `Bearer ${bossT}`);
    expect(st.body).toEqual({ held: false });
  });

  it('不同工作表互不影响(粒度=工作表级)', async () => {
    await request(app).post(`/api/workbooks/${wbId}/locks/daily_ops`).set('Authorization', `Bearer ${bossT}`);
    const r = await request(app).post(`/api/workbooks/${wbId}/locks/expense`).set('Authorization', `Bearer ${mgrT}`);
    expect(r.status).toBe(201);
    expect(r.body.acquired).toBe(true);
  });
});
