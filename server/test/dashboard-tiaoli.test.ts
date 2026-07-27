import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { query } from '../src/db/pool.js';
import { hashPassword } from '../src/auth/password.js';
import { resetDb } from './helpers.js';

let bossT: string;
let shop1: number;

async function login(u: string) {
  return (await request(app).post('/api/auth/login').send({ username: u, password: 'pw123' })).body.token as string;
}
const m = (o: Record<string, number>) => JSON.stringify(o);

beforeEach(async () => {
  await resetDb();
  const b = (await query("INSERT INTO business (code,name) VALUES ('tiaoli','禧悦健康调理馆') RETURNING id")).rows[0];
  const s1 = (await query("INSERT INTO shop (business_id, code, name) VALUES ($1,'t1','调理馆A店') RETURNING id", [b.id])).rows[0];
  shop1 = s1.id;
  await query('INSERT INTO template (business_id, version, definition) VALUES ($1,1,$2)', [b.id, JSON.stringify({ sheets: [] })]);
  await query("INSERT INTO daily_metric (shop_id, date, business_code, metrics) VALUES ($1,'2026-07-01','tiaoli',$2)",
    [shop1, m({ total_receipt: 1000, refund_total: 100, cika: 5, swimming: 3, birth_checkup: 2, bone_conditioning: 4 })]);
  await query("INSERT INTO daily_metric (shop_id, date, business_code, metrics) VALUES ($1,'2026-07-02','tiaoli',$2)",
    [shop1, m({ total_receipt: 1500, refund_total: 50, cika: 8, swimming: 1, birth_checkup: 6, head_therapy: 3 })]);
  await query("INSERT INTO expense (shop_id, pay_date, amount, subject) VALUES ($1,'2026-07-01', 300, '物耗')", [shop1]);
  await query("INSERT INTO app_user (username,password_hash,name,role) VALUES ('boss',$1,'董事长','chairman')", [await hashPassword('pw123')]);
  bossT = await login('boss');
});

describe('GET /api/dashboard/overview?businessCode=tiaoli', () => {
  it('返调理馆 payload:KPI/结构/趋势/费用/排名', async () => {
    const r = await request(app).get('/api/dashboard/overview?businessCode=tiaoli&granularity=month&date=2026-07-15').set('Authorization', `Bearer ${bossT}`);
    expect(r.status).toBe(200);
    expect(r.body.kpis.totalReceipt).toBe(2500);   // 1000+1500
    expect(r.body.kpis.refundTotal).toBe(150);     // 100+50
    expect(r.body.kpis.netReceipt).toBe(2350);
    expect(r.body.xispaStructure.cika).toBe(13);   // 5+8
    expect(r.body.xispaStructure.swimming).toBe(4);
    expect(r.body.yuespaStructure.birth_checkup).toBe(8);  // 2+6
    expect(r.body.yuespaStructure.bone_conditioning).toBe(4);
    expect(r.body.expenseBySubject.length).toBeGreaterThan(0);
    expect(r.body.shopRanking[0].shopName).toBe('调理馆A店');
    expect(r.body.shopRanking[0].revenue).toBe(2500);
    expect(r.body.revenueTrend.length).toBeGreaterThan(0);
  });
});
