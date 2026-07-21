import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { query } from '../src/db/pool.js';
import { hashPassword } from '../src/auth/password.js';
import { resetDb } from './helpers.js';

let token: string;
let shopId: number;

beforeEach(async () => {
  await resetDb();
  const b = (await query("INSERT INTO business (code,name) VALUES ('footbath','足浴') RETURNING id")).rows[0];
  const s = (await query("INSERT INTO shop (business_id, code, name) VALUES ($1,'dk','大河坎店') RETURNING id", [b.id])).rows[0];
  shopId = s.id;
  await query("INSERT INTO app_user (username,password_hash,name,role) VALUES ('boss',$1,'董事长','chairman')", [await hashPassword('pw')]);
  token = (await request(app).post('/api/auth/login').send({ username: 'boss', password: 'pw' })).body.token;
});

describe('I-1 dashboard 数值兜底', () => {
  it('脏数据(非数字字符串)不 500,当 0', async () => {
    // revenue='abc'(脏)、customers_total='12x'(脏)、cash=50(正常)
    await query(
      'INSERT INTO daily_metric (shop_id, date, business_code, metrics) VALUES ($1,$2,$3,$4)',
      [shopId, '2026-07-15', 'footbath', JSON.stringify({ revenue: 'abc', customers_total: '12x', cash: 50 })],
    );
    const r = await request(app)
      .get(`/api/dashboard/overview?granularity=day&date=2026-07-15&shopId=${shopId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
    expect(r.body.kpis.revenue).toBe(0);
    expect(r.body.kpis.customersTotal).toBe(0);
    expect(r.body.paymentChannels.cash).toBe(50);
  });

  it('合法数值仍正常聚合', async () => {
    await query(
      'INSERT INTO daily_metric (shop_id, date, business_code, metrics) VALUES ($1,$2,$3,$4)',
      [shopId, '2026-07-15', 'footbath', JSON.stringify({ revenue: '100.5', customers_total: '10' })],
    );
    const r = await request(app)
      .get(`/api/dashboard/overview?granularity=day&date=2026-07-15&shopId=${shopId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
    expect(r.body.kpis.revenue).toBeCloseTo(100.5, 2);
    expect(r.body.kpis.customersTotal).toBe(10);
  });
});
