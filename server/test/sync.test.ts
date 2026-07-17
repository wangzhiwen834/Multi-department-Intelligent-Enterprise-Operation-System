import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { query } from '../src/db/pool.js';
import { hashPassword } from '../src/auth/password.js';
import { resetDb } from './helpers.js';

let wbId: number;
let bossT: string;
let shopId: number;

const tpl = {
  sheets: [
    { key: 'daily_ops', columns: [
      { key: 'date', type: 'date', kind: 'entry' },
      { key: 'revenue', type: 'number', kind: 'entry' },
      { key: 'customers_total', type: 'int', kind: 'entry' },
    ] },
    { key: 'expense', columns: [{ key: 'amount', type: 'number', kind: 'entry' }] },
  ],
};

beforeEach(async () => {
  await resetDb();
  const b = (await query("INSERT INTO business (code,name) VALUES ('footbath','足浴') RETURNING id")).rows[0];
  await query('INSERT INTO template (business_id, version, definition) VALUES ($1,1,$2)', [b.id, JSON.stringify(tpl)]);
  const s = (await query("INSERT INTO shop (business_id, code, name) VALUES ($1,'dk','大河坎店') RETURNING id", [b.id])).rows[0];
  shopId = s.id;
  const w = (await query("INSERT INTO workbook (shop_id, period, template_version) VALUES ($1,'2026-07',1) RETURNING id", [s.id])).rows[0];
  wbId = w.id;
  await query("INSERT INTO app_user (username,password_hash,name,role) VALUES ('boss',$1,'董事长','chairman')", [await hashPassword('pw123')]);
  bossT = (await request(app).post('/api/auth/login').send({ username: 'boss', password: 'pw123' })).body.token;
});

async function acquire() {
  await request(app).post(`/api/workbooks/${wbId}/locks/daily_ops`).set('Authorization', `Bearer ${bossT}`);
}

describe('sync', () => {
  it('无锁时拒绝(409 防覆盖)', async () => {
    const r = await request(app).post(`/api/workbooks/${wbId}/sync`).set('Authorization', `Bearer ${bossT}`)
      .send({ dailyMetrics: [], expenses: [] });
    expect(r.status).toBe(409);
  });

  it('持锁同步后 daily_metric 可查且 autoSums 正确', async () => {
    await acquire();
    const r = await request(app).post(`/api/workbooks/${wbId}/sync`).set('Authorization', `Bearer ${bossT}`)
      .send({
        dailyMetrics: [
          { date: '2026-07-01', sheetKey: 'daily_ops', metrics: { revenue: 8026.66, customers_total: 25 } },
          { date: '2026-07-02', sheetKey: 'daily_ops', metrics: { revenue: 8073.34, customers_total: 31 } },
        ],
        expenses: [],
      });
    expect(r.status).toBe(200);
    expect(r.body.autoSums.daily_ops.revenue).toBeCloseTo(16100, 2);
    expect(r.body.autoSums.daily_ops.customers_total).toBe(56);
    const dm = await query('SELECT metrics FROM daily_metric WHERE shop_id=$1 AND date=$2', [shopId, '2026-07-01']);
    expect(Number(dm.rows[0].metrics.revenue)).toBeCloseTo(8026.66, 2);
  });

  it('类型错误进 errors', async () => {
    await acquire();
    const r = await request(app).post(`/api/workbooks/${wbId}/sync`).set('Authorization', `Bearer ${bossT}`)
      .send({
        dailyMetrics: [
          { date: '2026-07-03', sheetKey: 'daily_ops', metrics: { revenue: '不是数字', customers_total: 10 } },
        ],
        expenses: [],
      });
    expect(r.status).toBe(200);
    expect(r.body.errors.length).toBeGreaterThan(0);
    expect(r.body.errors[0].key).toBe('revenue');
  });

  it('费用同步可查', async () => {
    await acquire();
    await request(app).post(`/api/workbooks/${wbId}/sync`).set('Authorization', `Bearer ${bossT}`)
      .send({
        dailyMetrics: [],
        expenses: [
          { pay_date: '2026-07-01', attribution_month: '7月', summary: '维修费', amount: 1600, payee: '李伟明', subject: '维修费' },
        ],
      });
    const exp = await query('SELECT amount, subject FROM expense WHERE shop_id=$1', [shopId]);
    expect(exp.rows.length).toBe(1);
    expect(Number(exp.rows[0].amount)).toBe(1600);
    expect(exp.rows[0].subject).toBe('维修费');
  });
});
