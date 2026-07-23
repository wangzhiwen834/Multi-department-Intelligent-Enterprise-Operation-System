import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { query } from '../src/db/pool.js';
import { hashPassword } from '../src/auth/password.js';
import { resetDb } from './helpers.js';

let bossT: string;
let shop1: number;
let shop2: number;

async function login(u: string) {
  return (await request(app).post('/api/auth/login').send({ username: u, password: 'pw123' })).body.token as string;
}

// 插一条酒店 daily_metric(指定 date + metrics)
const m = (o: Record<string, number>) => JSON.stringify(o);

beforeEach(async () => {
  await resetDb();
  const b = (await query("INSERT INTO business (code,name) VALUES ('hotel','汉庭酒店') RETURNING id")).rows[0];
  const s1 = (await query("INSERT INTO shop (business_id, code, name) VALUES ($1,'h1','酒店A店') RETURNING id", [b.id])).rows[0];
  const s2 = (await query("INSERT INTO shop (business_id, code, name) VALUES ($1,'h2','酒店B店') RETURNING id", [b.id])).rows[0];
  shop1 = s1.id; shop2 = s2.id;
  // 插 hotel 模板(避免开工作簿报错;大屏本身不依赖模板,但抽取/录入会)
  await query('INSERT INTO template (business_id, version, definition) VALUES ($1,1,$2)', [b.id, JSON.stringify({ sheets: [] })]);
  await query("INSERT INTO daily_metric (shop_id, date, business_code, metrics) VALUES ($1,'2026-07-01','hotel', $2)",
    [shop1, m({ hotel_revenue: 10000, room_revenue: 8000, breakfast_revenue: 500, member_benefit: 100, overnight_rooms: 60, cleaned_rooms: 65, big_bed_rooms: 20, suite_rooms: 2, meituan_rooms: 10, ctrip_rooms: 5, huazhu_rooms: 30, adr: 150, occupancy: 0.8, revpar: 120 })]);
  await query("INSERT INTO daily_metric (shop_id, date, business_code, metrics) VALUES ($1,'2026-07-02','hotel', $2)",
    [shop1, m({ hotel_revenue: 12000, room_revenue: 9500, breakfast_revenue: 600, member_benefit: 120, overnight_rooms: 70, cleaned_rooms: 72, big_bed_rooms: 25, suite_rooms: 3, meituan_rooms: 12, ctrip_rooms: 6, huazhu_rooms: 40, adr: 160, occupancy: 0.9, revpar: 130 })]);
  await query("INSERT INTO daily_metric (shop_id, date, business_code, metrics) VALUES ($1,'2026-07-01','hotel', $2)",
    [shop2, m({ hotel_revenue: 8000, room_revenue: 6500, breakfast_revenue: 400, member_benefit: 80, overnight_rooms: 50, cleaned_rooms: 55, big_bed_rooms: 15, suite_rooms: 1, meituan_rooms: 8, ctrip_rooms: 4, huazhu_rooms: 25, adr: 140, occupancy: 0.7, revpar: 110 })]);
  await query("INSERT INTO expense (shop_id, pay_date, amount, subject) VALUES ($1,'2026-07-01', 2000, '水电')", [shop1]);
  await query("INSERT INTO expense (shop_id, pay_date, amount, subject) VALUES ($1,'2026-07-02', 1500, '工资')", [shop1]);
  await query("INSERT INTO app_user (username,password_hash,name,role) VALUES ('boss',$1,'董事长','chairman')", [await hashPassword('pw123')]);
  bossT = await login('boss');
});

describe('GET /api/dashboard/overview?businessCode=hotel', () => {
  it('返酒店 payload,KPI/结构/趋势/费用/排名', async () => {
    const r = await request(app).get('/api/dashboard/overview?businessCode=hotel&granularity=month&date=2026-07-15').set('Authorization', `Bearer ${bossT}`);
    expect(r.status).toBe(200);
    // KPI SUM
    expect(r.body.kpis.hotelRevenue).toBe(30000);     // 10000+12000+8000
    expect(r.body.kpis.roomRevenue).toBe(24000);
    expect(r.body.kpis.overnightRooms).toBe(180);
    expect(r.body.kpis.cleanedRooms).toBe(192);
    // KPI 日均(adr 有 3 天数据:150/160/140 -> 均 150)
    expect(r.body.kpis.adr).toBeCloseTo(150, 0);
    // 收入结构
    expect(r.body.revenueStructure.room).toBe(24000);
    expect(r.body.revenueStructure.breakfast).toBe(1500);
    // 房型结构
    expect(r.body.roomTypeStructure.bigBed).toBe(60);   // 20+25+15
    expect(r.body.roomTypeStructure.suite).toBe(6);      // 2+3+1
    // 渠道结构
    expect(r.body.channelStructure.meituan).toBe(30);   // 10+12+8
    expect(r.body.channelStructure.huazhu).toBe(95);     // 30+40+25
    // 费用科目
    expect(r.body.expenseBySubject.length).toBeGreaterThan(0);
    // 排名:shop1(22000) > shop2(8000)
    expect(r.body.shopRanking[0].shopName).toBe('酒店A店');
    expect(r.body.shopRanking[0].revenue).toBe(22000);
    expect(r.body.shopRanking[1].shopName).toBe('酒店B店');
  });

  it('shopId 过滤:仅本店', async () => {
    const r = await request(app).get(`/api/dashboard/overview?businessCode=hotel&granularity=month&date=2026-07-15&shopId=${shop2}`).set('Authorization', `Bearer ${bossT}`);
    expect(r.status).toBe(200);
    expect(r.body.kpis.hotelRevenue).toBe(8000); // 仅 shop2
  });

  it('趋势序列非空(month 粒度=当月每日)', async () => {
    const r = await request(app).get('/api/dashboard/overview?businessCode=hotel&granularity=month&date=2026-07-15').set('Authorization', `Bearer ${bossT}`);
    expect(r.body.revenueTrend.length).toBeGreaterThan(0);
    const jul1 = r.body.revenueTrend.find((t: any) => t.label === '07-01');
    expect(jul1).toBeDefined();
    expect(jul1.revenue).toBe(18000); // shop1 10000 + shop2 8000
  });
});
