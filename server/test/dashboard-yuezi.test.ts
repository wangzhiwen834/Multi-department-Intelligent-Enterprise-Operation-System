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
  const b = (await query("INSERT INTO business (code,name) VALUES ('yuezi','禧悦国际月子会所') RETURNING id")).rows[0];
  const s1 = (await query("INSERT INTO shop (business_id, code, name) VALUES ($1,'y1','月子A店') RETURNING id", [b.id])).rows[0];
  shop1 = s1.id;
  await query('INSERT INTO template (business_id, version, definition) VALUES ($1,1,$2)', [b.id, JSON.stringify({ sheets: [] })]);
  await query("INSERT INTO daily_metric (shop_id, date, business_code, metrics) VALUES ($1,'2026-07-01','yuezi',$2)",
    [shop1, m({ cash_total: 48600, refund_total: 0, deposit: 2000, down_payment: 8000, balance: 38600, occupied_rooms: 22, occupancy_rate: 0.95, refund_deposit: 0, refund_package: 0 })]);
  await query("INSERT INTO daily_metric (shop_id, date, business_code, metrics) VALUES ($1,'2026-07-02','yuezi',$2)",
    [shop1, m({ cash_total: 4518, refund_total: 100, chankang_sales: 4518, occupied_rooms: 22, occupancy_rate: 0.95, refund_package: 100 })]);
  await query("INSERT INTO expense (shop_id, pay_date, amount, subject) VALUES ($1,'2026-07-01', 5000, '物耗')", [shop1]);
  await query("INSERT INTO app_user (username,password_hash,name,role) VALUES ('boss',$1,'董事长','chairman')", [await hashPassword('pw123')]);
  bossT = await login('boss');
});

describe('GET /api/dashboard/overview?businessCode=yuezi', () => {
  it('返月子会所 payload:KPI/结构/趋势/费用/排名', async () => {
    const r = await request(app).get('/api/dashboard/overview?businessCode=yuezi&granularity=month&date=2026-07-15').set('Authorization', `Bearer ${bossT}`);
    expect(r.status).toBe(200);
    expect(r.body.kpis.cashTotal).toBe(53118);      // 48600+4518
    expect(r.body.kpis.refundTotal).toBe(100);
    expect(r.body.kpis.netCash).toBe(53018);
    expect(r.body.kpis.occupiedRooms).toBe(44);     // 22+22
    expect(r.body.kpis.occupancyRate).toBeCloseTo(0.95, 2);
    expect(r.body.revenueStructure.deposit).toBe(2000);
    expect(r.body.revenueStructure.chankang_sales).toBe(4518);
    expect(r.body.refundStructure.refund_package).toBe(100);
    expect(r.body.expenseBySubject.length).toBeGreaterThan(0);
    expect(r.body.shopRanking[0].shopName).toBe('月子A店');
    expect(r.body.revenueTrend.length).toBeGreaterThan(0);
  });
});
