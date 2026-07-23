import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { query } from '../src/db/pool.js';
import { hashPassword } from '../src/auth/password.js';
import { resetDb } from './helpers.js';
import {
  computeRange,
  buildTrendSeries,
  formatBucketLabel,
  isValidYmd,
} from '../src/dashboard/dashboard.helpers.js';

// ---- 共享夹具 ----
let bossT: string;
let shop1: number; // 大河坎店
let shop2: number; // 江北店

// 仪表盘路由不读模板,给个最小桩即可满足外键
const tpl = { sheets: [{ key: 'daily_ops', columns: [{ key: 'date', type: 'date', kind: 'entry' }] }] };

// 与 footbath.template.ts 对齐的真实指标键(全量,便于结构断言)
type Metrics = {
  revenue: number; cash_revenue: number; customers_total: number;
  customers_member: number; customers_group: number; customers_walkin: number;
  new_members: number; recharge_total: number; recharge_first: number;
  recharge_renew: number; recharge_gift: number; member_consume: number;
  therapist_wage: number; therapist_attendance: number; total_clocks: number;
  clocks_arranged: number; clocks_requested: number; clocks_added: number;
  footbath_revenue: number; spa_revenue: number; minor_revenue: number;
  cash: number; douyin: number; meituan: number; pos: number; alipay: number; wechat: number;
};

const ZERO: Metrics = {
  revenue: 0, cash_revenue: 0, customers_total: 0, customers_member: 0, customers_group: 0,
  customers_walkin: 0, new_members: 0, recharge_total: 0, recharge_first: 0, recharge_renew: 0,
  recharge_gift: 0, member_consume: 0, therapist_wage: 0, therapist_attendance: 0,
  total_clocks: 0, clocks_arranged: 0, clocks_requested: 0, clocks_added: 0,
  footbath_revenue: 0, spa_revenue: 0, minor_revenue: 0,
  cash: 0, douyin: 0, meituan: 0, pos: 0, alipay: 0, wechat: 0,
};

// 部分覆盖构造器:只填关心的键,其余 0
const m = (p: Partial<Metrics>): Metrics => ({ ...ZERO, ...p });

beforeEach(async () => {
  await resetDb();
  const b = (await query("INSERT INTO business (code,name) VALUES ('footbath','足浴') RETURNING id")).rows[0];
  await query('INSERT INTO template (business_id, version, definition) VALUES ($1,1,$2)', [b.id, JSON.stringify(tpl)]);
  const s1 = (await query("INSERT INTO shop (business_id, code, name) VALUES ($1,'dk','大河坎店') RETURNING id", [b.id])).rows[0];
  const s2 = (await query("INSERT INTO shop (business_id, code, name) VALUES ($1,'jb','江北店') RETURNING id", [b.id])).rows[0];
  shop1 = s1.id;
  shop2 = s2.id;
  await query("INSERT INTO app_user (username,password_hash,name,role) VALUES ('boss',$1,'董事长','chairman')", [await hashPassword('pw123')]);
  bossT = (await request(app).post('/api/auth/login').send({ username: 'boss', password: 'pw123' })).body.token;
});

// ---- 种子辅助 ----
async function seedMetric(shopId: number, date: string, metrics: Metrics) {
  await query(
    "INSERT INTO daily_metric (shop_id, date, business_code, metrics) VALUES ($1,$2,'footbath',$3) " +
    'ON CONFLICT (shop_id,date) DO UPDATE SET metrics=excluded.metrics, updated_at=now()',
    [shopId, date, JSON.stringify(metrics)],
  );
}

async function seedExpense(shopId: number, payDate: string, subject: string, amount: number) {
  await query(
    'INSERT INTO expense (shop_id, pay_date, subject, amount) VALUES ($1,$2,$3,$4)',
    [shopId, payDate, subject, amount],
  );
}

const auth = () => ({ Authorization: `Bearer ${bossT}` });
const sumKey = (rows: { metrics: Metrics }[], key: keyof Metrics) =>
  rows.reduce((a, r) => a + (r.metrics[key] || 0), 0);
const byLabel = (trend: { label: string; revenue: number }[]) =>
  Object.fromEntries(trend.map((p) => [p.label, p.revenue]));

// ============================================================
// 端点测试(GET /api/dashboard/overview)
// 锚点事实:2026-07-01 = 周三;故 2026-07-03 = 周五,ISO 周 = 06-29..07-05
// ============================================================
describe('dashboard /overview 粒度聚合', () => {
  // ---- 1. month 全店 ----
  it('month 全店:KPI 汇总/趋势0填充/结构/排名/费用空', async () => {
    const shop1Rows = [
      { date: '2026-07-01', metrics: m({ revenue: 1000, cash_revenue: 400, customers_total: 10, customers_member: 4, customers_group: 3, customers_walkin: 3, new_members: 1, recharge_total: 200, recharge_first: 80, recharge_renew: 100, recharge_gift: 20, member_consume: 50, therapist_wage: 300, therapist_attendance: 2, total_clocks: 15, clocks_arranged: 8, clocks_requested: 5, clocks_added: 2, footbath_revenue: 600, spa_revenue: 300, minor_revenue: 100, cash: 400, douyin: 100, meituan: 100, pos: 200, alipay: 100, wechat: 100 }) },
      { date: '2026-07-02', metrics: m({ revenue: 1500, cash_revenue: 600, customers_total: 15, customers_member: 6, customers_group: 5, customers_walkin: 4, new_members: 2, recharge_total: 300, recharge_first: 100, recharge_renew: 150, recharge_gift: 50, member_consume: 80, therapist_wage: 350, therapist_attendance: 3, total_clocks: 20, clocks_arranged: 10, clocks_requested: 7, clocks_added: 3, footbath_revenue: 900, spa_revenue: 450, minor_revenue: 150, cash: 600, douyin: 200, meituan: 150, pos: 300, alipay: 150, wechat: 100 }) },
      { date: '2026-07-03', metrics: m({ revenue: 2000, cash_revenue: 800, customers_total: 20, customers_member: 8, customers_group: 7, customers_walkin: 5, new_members: 3, recharge_total: 400, recharge_first: 120, recharge_renew: 200, recharge_gift: 80, member_consume: 100, therapist_wage: 400, therapist_attendance: 4, total_clocks: 25, clocks_arranged: 12, clocks_requested: 9, clocks_added: 4, footbath_revenue: 1200, spa_revenue: 600, minor_revenue: 200, cash: 800, douyin: 300, meituan: 200, pos: 400, alipay: 200, wechat: 100 }) },
    ];
    const shop2Rows = [
      { date: '2026-07-01', metrics: m({ revenue: 500, cash_revenue: 200, customers_total: 5, customers_member: 2, customers_group: 2, customers_walkin: 1, new_members: 1, recharge_total: 100, recharge_first: 40, recharge_renew: 50, recharge_gift: 10, member_consume: 20, therapist_wage: 150, therapist_attendance: 1, total_clocks: 8, clocks_arranged: 4, clocks_requested: 3, clocks_added: 1, footbath_revenue: 300, spa_revenue: 150, minor_revenue: 50, cash: 200, douyin: 50, meituan: 50, pos: 100, alipay: 50, wechat: 50 }) },
      { date: '2026-07-02', metrics: m({ revenue: 700, cash_revenue: 300, customers_total: 7, customers_member: 3, customers_group: 2, customers_walkin: 2, new_members: 1, recharge_total: 150, recharge_first: 60, recharge_renew: 70, recharge_gift: 20, member_consume: 30, therapist_wage: 180, therapist_attendance: 2, total_clocks: 10, clocks_arranged: 5, clocks_requested: 4, clocks_added: 1, footbath_revenue: 400, spa_revenue: 200, minor_revenue: 100, cash: 300, douyin: 100, meituan: 50, pos: 150, alipay: 50, wechat: 100 }) },
    ];
    for (const r of shop1Rows) await seedMetric(shop1, r.date, r.metrics);
    for (const r of shop2Rows) await seedMetric(shop2, r.date, r.metrics);
    const all = [...shop1Rows, ...shop2Rows];

    const r = await request(app).get('/api/dashboard/overview?granularity=month&date=2026-07-15').set(auth());
    expect(r.status).toBe(200);
    expect(r.body.granularity).toBe('month');
    expect(r.body.rangeStart).toBe('2026-07-01');
    expect(r.body.rangeEnd).toBe('2026-07-31');
    expect(r.body.shopId).toBeNull();

    // KPI 汇总
    expect(r.body.kpis.revenue).toBe(sumKey(all, 'revenue')); // 5700
    expect(r.body.kpis.customersTotal).toBe(sumKey(all, 'customers_total')); // 57
    expect(r.body.kpis.avgCustomerPrice).toBeCloseTo(sumKey(all, 'revenue') / sumKey(all, 'customers_total'), 2);
    expect(r.body.kpis.rechargeTotal).toBe(sumKey(all, 'recharge_total'));
    expect(r.body.kpis.totalClocks).toBe(sumKey(all, 'total_clocks'));
    expect(r.body.kpis.newMembers).toBe(sumKey(all, 'new_members'));
    expect(r.body.kpis.therapistAttendance).toBe(sumKey(all, 'therapist_attendance'));
    expect(r.body.kpis.therapistWage).toBe(sumKey(all, 'therapist_wage'));
    expect(r.body.kpis.memberConsume).toBe(sumKey(all, 'member_consume'));

    // 趋势:31 天,首日=07-01 跨店求和,07-04 未种=0
    const trend = r.body.revenueTrend;
    expect(trend).toHaveLength(31);
    expect(trend[0].label).toBe('07-01');
    expect(trend[0].revenue).toBe(shop1Rows[0].metrics.revenue + shop2Rows[0].metrics.revenue); // 1500
    expect(trend[3].label).toBe('07-04');
    expect(trend[3].revenue).toBe(0);

    // 结构汇总
    expect(r.body.customerStructure.member).toBe(sumKey(all, 'customers_member'));
    expect(r.body.customerStructure.group).toBe(sumKey(all, 'customers_group'));
    expect(r.body.customerStructure.walkin).toBe(sumKey(all, 'customers_walkin'));
    expect(r.body.clockStructure.arranged).toBe(sumKey(all, 'clocks_arranged'));
    expect(r.body.clockStructure.requested).toBe(sumKey(all, 'clocks_requested'));
    expect(r.body.clockStructure.added).toBe(sumKey(all, 'clocks_added'));
    expect(r.body.rechargeStructure.first).toBe(sumKey(all, 'recharge_first'));
    expect(r.body.rechargeStructure.renew).toBe(sumKey(all, 'recharge_renew'));
    expect(r.body.rechargeStructure.gift).toBe(sumKey(all, 'recharge_gift'));
    expect(r.body.businessStructure.footbath).toBe(sumKey(all, 'footbath_revenue'));
    expect(r.body.businessStructure.spa).toBe(sumKey(all, 'spa_revenue'));
    expect(r.body.businessStructure.minor).toBe(sumKey(all, 'minor_revenue'));
    expect(r.body.paymentChannels.cash).toBe(sumKey(all, 'cash'));
    expect(r.body.paymentChannels.douyin).toBe(sumKey(all, 'douyin'));
    expect(r.body.paymentChannels.meituan).toBe(sumKey(all, 'meituan'));
    expect(r.body.paymentChannels.pos).toBe(sumKey(all, 'pos'));
    expect(r.body.paymentChannels.alipay).toBe(sumKey(all, 'alipay'));
    expect(r.body.paymentChannels.wechat).toBe(sumKey(all, 'wechat'));

    // 排名:两店均在,按营收降序(shop1=4500 > shop2=1200),无 target/taskProgress
    const ranking = r.body.shopRanking;
    expect(ranking).toHaveLength(2);
    expect(ranking[0].shopId).toBe(shop1);
    expect(ranking[0].shopName).toBe('大河坎店');
    expect(ranking[0].revenue).toBe(4500);
    expect(ranking[1].shopId).toBe(shop2);
    expect(ranking[1].revenue).toBe(1200);
    for (const row of ranking) {
      expect(row).not.toHaveProperty('target');
      expect(row).not.toHaveProperty('taskProgress');
    }

    // 无费用 -> 空数组
    expect(r.body.expenseBySubject).toEqual([]);
  });

  // ---- 2. month + shopId 过滤 ----
  it('month + shopId:KPI 仅本店,排名仍全店', async () => {
    const shop1Rows = [
      { date: '2026-07-01', metrics: m({ revenue: 1000, customers_total: 10 }) },
      { date: '2026-07-02', metrics: m({ revenue: 1500, customers_total: 15 }) },
      { date: '2026-07-03', metrics: m({ revenue: 2000, customers_total: 20 }) },
    ];
    const shop2Rows = [
      { date: '2026-07-01', metrics: m({ revenue: 500, customers_total: 5 }) },
      { date: '2026-07-02', metrics: m({ revenue: 700, customers_total: 7 }) },
    ];
    for (const r of shop1Rows) await seedMetric(shop1, r.date, r.metrics);
    for (const r of shop2Rows) await seedMetric(shop2, r.date, r.metrics);

    const r = await request(app).get(`/api/dashboard/overview?granularity=month&date=2026-07-15&shopId=${shop1}`).set(auth());
    expect(r.status).toBe(200);
    expect(r.body.shopId).toBe(shop1);
    expect(r.body.kpis.revenue).toBe(sumKey(shop1Rows, 'revenue')); // 4500,仅 shop1
    // 排名忽略 shopId,仍含两店
    expect(r.body.shopRanking).toHaveLength(2);
    const ids = r.body.shopRanking.map((s: { shopId: number }) => s.shopId);
    expect(ids).toContain(shop1);
    expect(ids).toContain(shop2);
  });

  // ---- 3. day(前 14 天 trailing) ----
  it('day:KPI 单天,趋势 14 天 trailing(06-19..07-02)', async () => {
    await seedMetric(shop1, '2026-07-01', m({ revenue: 1000 }));
    await seedMetric(shop1, '2026-07-02', m({ revenue: 1500 }));
    await seedMetric(shop1, '2026-07-03', m({ revenue: 2000 })); // 区间外,不计入

    const r = await request(app).get('/api/dashboard/overview?granularity=day&date=2026-07-02').set(auth());
    expect(r.status).toBe(200);
    expect(r.body.kpis.revenue).toBe(1500); // 仅 07-02
    const trend = r.body.revenueTrend;
    expect(trend).toHaveLength(14);
    expect(trend[0].label).toBe('06-19');
    expect(trend[13].label).toBe('07-02');
    const map = byLabel(trend);
    expect(map['07-01']).toBe(1000);
    expect(map['07-02']).toBe(1500);
    expect(map['06-19']).toBe(0);
    expect(map['06-30']).toBe(0);
    // 仅 07-01/07-02 非零,其余 0
    expect(trend.filter((p: { revenue: number }) => p.revenue !== 0)).toHaveLength(2);
  });

  // ---- 4. week(ISO 周一..周日) ----
  it('week:ISO 周 06-29..07-05,趋势 7 天', async () => {
    await seedMetric(shop1, '2026-06-29', m({ revenue: 300 }));
    await seedMetric(shop1, '2026-07-01', m({ revenue: 500 }));
    await seedMetric(shop1, '2026-07-03', m({ revenue: 800 }));

    const r = await request(app).get('/api/dashboard/overview?granularity=week&date=2026-07-03').set(auth());
    expect(r.status).toBe(200);
    expect(r.body.rangeStart).toBe('2026-06-29');
    expect(r.body.rangeEnd).toBe('2026-07-05');
    expect(r.body.kpis.revenue).toBe(1600); // 300+500+800
    const trend = r.body.revenueTrend;
    expect(trend).toHaveLength(7);
    expect(trend.map((p: { label: string }) => p.label)).toEqual(
      ['06-29', '06-30', '07-01', '07-02', '07-03', '07-04', '07-05'],
    );
    expect(trend.filter((p: { revenue: number }) => p.revenue !== 0)).toHaveLength(3);
    const map = byLabel(trend);
    expect(map['06-29']).toBe(300);
    expect(map['07-01']).toBe(500);
    expect(map['07-03']).toBe(800);
    expect(map['07-02']).toBe(0);
    expect(map['07-05']).toBe(0);
  });

  // ---- 5. year(12 个月桶) ----
  it('year:1/1..12/31,趋势 12 个月(1月..12月)', async () => {
    await seedMetric(shop1, '2026-01-15', m({ revenue: 1000 }));
    await seedMetric(shop1, '2026-07-01', m({ revenue: 2000 }));
    await seedMetric(shop1, '2026-12-20', m({ revenue: 3000 }));

    const r = await request(app).get('/api/dashboard/overview?granularity=year&date=2026-07-15').set(auth());
    expect(r.status).toBe(200);
    expect(r.body.rangeStart).toBe('2026-01-01');
    expect(r.body.rangeEnd).toBe('2026-12-31');
    expect(r.body.kpis.revenue).toBe(6000);
    const trend = r.body.revenueTrend;
    expect(trend).toHaveLength(12);
    expect(trend[0].label).toBe('1月');
    expect(trend[11].label).toBe('12月');
    const map = byLabel(trend);
    expect(map['1月']).toBe(1000);
    expect(map['7月']).toBe(2000);
    expect(map['12月']).toBe(3000);
    expect(map['2月']).toBe(0);
    expect(map['6月']).toBe(0);
  });

  // ---- 6. 空区间 ----
  it('空区间(8 月无数据):KPI 全 0,趋势全 0,排名含两店营收 0,费用空', async () => {
    const r = await request(app).get('/api/dashboard/overview?granularity=month&date=2026-08-15').set(auth());
    expect(r.status).toBe(200);
    expect(r.body.rangeStart).toBe('2026-08-01');
    expect(r.body.rangeEnd).toBe('2026-08-31');
    expect(r.body.kpis.revenue).toBe(0);
    expect(r.body.kpis.customersTotal).toBe(0);
    expect(r.body.kpis.avgCustomerPrice).toBe(0);
    expect(r.body.kpis.rechargeTotal).toBe(0);
    expect(r.body.kpis.totalClocks).toBe(0);
    const trend = r.body.revenueTrend;
    expect(trend).toHaveLength(31); // 8 月 31 天
    expect(trend.filter((p: { revenue: number }) => p.revenue !== 0)).toHaveLength(0);
    const ranking = r.body.shopRanking;
    expect(ranking).toHaveLength(2);
    expect(ranking.every((s: { revenue: number }) => s.revenue === 0)).toBe(true);
    expect(r.body.expenseBySubject).toEqual([]);
  });

  // ---- 7. period 向后兼容 ----
  it('period=YYYY-MM 向后兼容:等价 month,granularity=month', async () => {
    await seedMetric(shop1, '2026-07-01', m({ revenue: 1000 }));
    await seedMetric(shop1, '2026-07-02', m({ revenue: 1500 }));

    const r = await request(app).get('/api/dashboard/overview?period=2026-07').set(auth());
    expect(r.status).toBe(200);
    expect(r.body.granularity).toBe('month');
    expect(r.body.rangeStart).toBe('2026-07-01');
    expect(r.body.rangeEnd).toBe('2026-07-31');
    expect(r.body.kpis.revenue).toBe(2500); // 7 月求和
  });

  // ---- 8. 非法 granularity ----
  it('非法 granularity -> 400', async () => {
    const r = await request(app).get('/api/dashboard/overview?granularity=decade&date=2026-07-15').set(auth());
    expect(r.status).toBe(400);
  });

  // ---- 9. 非法 period(月份溢出) ----
  it('period=2026-13 -> 400(不可溢出为 2027-01)', async () => {
    const r = await request(app).get('/api/dashboard/overview?period=2026-13').set(auth());
    expect(r.status).toBe(400);
  });

  // ---- 10. 非法 shopId ----
  it('shopId=0 / shopId=abc -> 400', async () => {
    const r0 = await request(app).get('/api/dashboard/overview?granularity=month&date=2026-07-15&shopId=0').set(auth());
    expect(r0.status).toBe(400);
    const rAbc = await request(app).get('/api/dashboard/overview?granularity=month&date=2026-07-15&shopId=abc').set(auth());
    expect(rAbc.status).toBe(400);
  });

  // ---- 11. 费用 Top(分组求和 + 降序) ----
  it('expenseBySubject:重复科目合并求和,降序', async () => {
    await seedExpense(shop1, '2026-07-01', '维修费', 1000);
    await seedExpense(shop1, '2026-07-01', '工资', 2000);
    await seedExpense(shop1, '2026-07-02', '维修费', 500);

    const r = await request(app).get('/api/dashboard/overview?granularity=month&date=2026-07-15').set(auth());
    expect(r.status).toBe(200);
    expect(r.body.expenseBySubject).toEqual([
      { subject: '工资', amount: 2000 },
      { subject: '维修费', amount: 1500 },
    ]);
  });
});

// ============================================================
// 纯函数单元测试(dashboard.helpers.ts,无 IO)
// ============================================================
describe('dashboard.helpers 纯函数', () => {
  describe('computeRange', () => {
    it('week @ 周五(2026-07-03) -> 06-29..07-05, day 单位', () => {
      const r = computeRange('week', '2026-07-03');
      expect(r.rangeStart).toBe('2026-06-29');
      expect(r.rangeEnd).toBe('2026-07-05');
      expect(r.trendStart).toBe('2026-06-29');
      expect(r.trendEnd).toBe('2026-07-05');
      expect(r.trendUnit).toBe('day');
    });

    it('week @ 周日(2026-07-05) -> 周一仍为 06-29', () => {
      const r = computeRange('week', '2026-07-05');
      expect(r.rangeStart).toBe('2026-06-29');
      expect(r.rangeEnd).toBe('2026-07-05');
    });

    it('week @ 周一(2026-06-29) -> 周一为自身', () => {
      const r = computeRange('week', '2026-06-29');
      expect(r.rangeStart).toBe('2026-06-29');
      expect(r.rangeEnd).toBe('2026-07-05');
    });

    it('month @ 2026-02-15 -> 月末 02-28(非闰年)', () => {
      expect(computeRange('month', '2026-02-15').rangeEnd).toBe('2026-02-28');
    });

    it('month @ 2024-02-15 -> 月末 02-29(闰年)', () => {
      expect(computeRange('month', '2024-02-15').rangeEnd).toBe('2024-02-29');
    });

    it('year @ 2026-07-15 -> 01-01..12-31, month 单位', () => {
      const r = computeRange('year', '2026-07-15');
      expect(r.rangeStart).toBe('2026-01-01');
      expect(r.rangeEnd).toBe('2026-12-31');
      expect(r.trendUnit).toBe('month');
    });

    it('day @ 2026-07-15 -> trendStart 07-02(含端 14 天), day 单位', () => {
      const r = computeRange('day', '2026-07-15');
      expect(r.rangeStart).toBe('2026-07-15');
      expect(r.rangeEnd).toBe('2026-07-15');
      expect(r.trendStart).toBe('2026-07-02');
      expect(r.trendEnd).toBe('2026-07-15');
      expect(r.trendUnit).toBe('day');
    });
  });

  describe('buildTrendSeries', () => {
    it('day 桶:3 天序列,缺失 0 填充', () => {
      const out = buildTrendSeries('2026-07-01', '2026-07-03', 'day', [{ bucket: '2026-07-02', revenue: 100 }]);
      expect(out).toHaveLength(3);
      expect(out.map((p) => p.label)).toEqual(['07-01', '07-02', '07-03']);
      expect(out.map((p) => p.revenue)).toEqual([0, 100, 0]);
    });

    it('month 桶:12 个月序列,仅 3 月非零', () => {
      const out = buildTrendSeries('2026-01-01', '2026-12-31', 'month', [{ bucket: '2026-03-01', revenue: 50 }]);
      expect(out).toHaveLength(12);
      expect(out.map((p) => p.label)).toEqual(
        ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
      );
      expect(out[2].revenue).toBe(50);
      expect(out.filter((p) => p.revenue !== 0)).toHaveLength(1);
    });
  });

  describe('formatBucketLabel', () => {
    it('day -> MM-DD', () => {
      expect(formatBucketLabel(new Date(2026, 6, 2), 'day')).toBe('07-02');
    });
    it('month -> M月', () => {
      expect(formatBucketLabel(new Date(2026, 2, 1), 'month')).toBe('3月');
    });
  });

  describe('isValidYmd', () => {
    it('2026-02-30 -> false(2 月无 30 日)', () => {
      expect(isValidYmd('2026-02-30')).toBe(false);
    });
    it('2026-13-01 -> false(月份溢出)', () => {
      expect(isValidYmd('2026-13-01')).toBe(false);
    });
    it('2026-07-15 -> true', () => {
      expect(isValidYmd('2026-07-15')).toBe(true);
    });
    it('2024-02-29 -> true(闰年)', () => {
      expect(isValidYmd('2024-02-29')).toBe(true);
    });
  });
});

describe('businessCode 分派与校验', () => {
  it('缺省 businessCode = footbath(向后兼容)', async () => {
    const r = await request(app).get('/api/dashboard/overview?granularity=month&date=2026-07-15').set('Authorization', `Bearer ${bossT}`);
    expect(r.status).toBe(200);
    expect(r.body.kpis).toBeDefined();
  });

  it('非法 businessCode -> 404', async () => {
    const r = await request(app).get('/api/dashboard/overview?businessCode=xyz&granularity=month&date=2026-07-15').set('Authorization', `Bearer ${bossT}`);
    expect(r.status).toBe(404);
  });

  it('业务无大屏处理器 -> 501', async () => {
    await query("INSERT INTO business (code,name) VALUES ('foo','测试业务')");
    const r = await request(app).get('/api/dashboard/overview?businessCode=foo&granularity=month&date=2026-07-15').set('Authorization', `Bearer ${bossT}`);
    expect(r.status).toBe(501);
  });

  it('shopId 不属于该业务 -> 400', async () => {
    // shop1 属 footbath;造一个别的业务的店,用其 id 访 footbath
    const otherBiz = (await query("INSERT INTO business (code,name) VALUES ('other','其它') RETURNING id")).rows[0];
    const otherShop = (await query("INSERT INTO shop (business_id, code, name) VALUES ($1,'os','其它店') RETURNING id", [otherBiz.id])).rows[0];
    const r = await request(app).get(`/api/dashboard/overview?businessCode=footbath&granularity=month&date=2026-07-15&shopId=${otherShop.id}`).set('Authorization', `Bearer ${bossT}`);
    expect(r.status).toBe(400);
  });
});
