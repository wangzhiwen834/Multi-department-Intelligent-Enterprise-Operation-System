import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { query } from '../src/db/pool.js';
import { hashPassword } from '../src/auth/password.js';
import { resetDb } from './helpers.js';

let bossT: string;
let mgrT: string;
let businessId: number;
let shopId: number;

async function login(u: string) {
  return (await request(app).post('/api/auth/login').send({ username: u, password: 'pw123' })).body.token as string;
}

beforeEach(async () => {
  await resetDb();
  const b = (await query("INSERT INTO business (code,name) VALUES ('footbath','静水楼台') RETURNING id")).rows[0];
  businessId = b.id;
  const s = (await query("INSERT INTO shop (business_id, code, name) VALUES ($1,'dk','大河坎店') RETURNING id", [b.id])).rows[0];
  shopId = s.id;
  await query("INSERT INTO app_user (username,password_hash,name,role) VALUES ('boss',$1,'董事长','chairman')", [await hashPassword('pw123')]);
  await query("INSERT INTO app_user (username,password_hash,name,role,department) VALUES ('mgr',$1,'经理','manager','财务部')", [await hashPassword('pw123')]);
  bossT = await login('boss');
  mgrT = await login('mgr');
});

describe('GET /api/shops', () => {
  it('返回活跃门店并带 business 信息', async () => {
    const r = await request(app).get('/api/shops').set('Authorization', `Bearer ${bossT}`);
    expect(r.status).toBe(200);
    expect(r.body).toHaveLength(1);
    expect(r.body[0].name).toBe('大河坎店');
    expect(r.body[0].business_code).toBe('footbath');
    expect(r.body[0].business_name).toBe('静水楼台');
  });

  it('软删后不再出现在列表', async () => {
    await query("UPDATE shop SET status='deleted' WHERE id=$1", [shopId]);
    const r = await request(app).get('/api/shops').set('Authorization', `Bearer ${bossT}`);
    expect(r.body).toHaveLength(0);
  });
});

describe('POST /api/shops (新增,仅董事长)', () => {
  it('董事长可新增门店', async () => {
    const r = await request(app).post('/api/shops').set('Authorization', `Bearer ${bossT}`).send({ name: '竹园店' });
    expect(r.status).toBe(201);
    expect(r.body.name).toBe('竹园店');
    expect(r.body.status).toBe('active');
    // 列表可见
    const list = await request(app).get('/api/shops').set('Authorization', `Bearer ${bossT}`);
    expect(list.body.map((s: any) => s.name)).toContain('竹园店');
  });

  it('经理新增被拒(403)', async () => {
    const r = await request(app).post('/api/shops').set('Authorization', `Bearer ${mgrT}`).send({ name: '竹园店' });
    expect(r.status).toBe(403);
  });

  it('空名被拒(400)', async () => {
    const r = await request(app).post('/api/shops').set('Authorization', `Bearer ${bossT}`).send({ name: '   ' });
    expect(r.status).toBe(400);
  });
});

describe('PATCH /api/shops/:id/rename (仅董事长)', () => {
  it('董事长可重命名', async () => {
    const r = await request(app).patch(`/api/shops/${shopId}/rename`).set('Authorization', `Bearer ${bossT}`).send({ name: '大河坎总店' });
    expect(r.status).toBe(200);
    expect(r.body.name).toBe('大河坎总店');
  });

  it('经理重命名被拒', async () => {
    const r = await request(app).patch(`/api/shops/${shopId}/rename`).set('Authorization', `Bearer ${mgrT}`).send({ name: 'X' });
    expect(r.status).toBe(403);
  });
});

describe('DELETE /api/shops/:id (软删,仅董事长)', () => {
  it('董事长软删门店,列表不再可见但行仍在', async () => {
    const r = await request(app).delete(`/api/shops/${shopId}`).set('Authorization', `Bearer ${bossT}`);
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    const row = (await query('SELECT status FROM shop WHERE id=$1', [shopId])).rows[0];
    expect(row.status).toBe('deleted');
    const list = await request(app).get('/api/shops').set('Authorization', `Bearer ${bossT}`);
    expect(list.body).toHaveLength(0);
  });

  it('经理删除被拒', async () => {
    const r = await request(app).delete(`/api/shops/${shopId}`).set('Authorization', `Bearer ${mgrT}`);
    expect(r.status).toBe(403);
    const row = (await query('SELECT status FROM shop WHERE id=$1', [shopId])).rows[0];
    expect(row.status).toBe('active');
  });
});
