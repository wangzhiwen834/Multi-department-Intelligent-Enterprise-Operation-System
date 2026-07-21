import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { query } from '../src/db/pool.js';
import { hashPassword } from '../src/auth/password.js';
import { resetDb } from './helpers.js';

let bossT: string;
let wbId: number;

async function login(u: string) {
  return (await request(app).post('/api/auth/login').send({ username: u, password: 'pw123' })).body.token as string;
}

beforeEach(async () => {
  await resetDb();
  const b = (await query("INSERT INTO business (code,name) VALUES ('footbath','足浴') RETURNING id")).rows[0];
  await query('INSERT INTO template (business_id, version, definition) VALUES ($1,1,$2)', [b.id, JSON.stringify({ sheets: [] })]);
  const s = (await query("INSERT INTO shop (business_id, code, name) VALUES ($1,'dk','大河坎店') RETURNING id", [b.id])).rows[0];
  wbId = (await query('INSERT INTO workbook (shop_id, period, template_version) VALUES ($1,$2,1) RETURNING id', [s.id, '2026-07'])).rows[0].id;
  await query('INSERT INTO daily_metric (shop_id, date, business_code, metrics, source_workbook_id) VALUES ($1,$2,$3,$4,$5)', [s.id, '2026-07-15', 'footbath', JSON.stringify({ revenue: 100 }), wbId]);
  await query("INSERT INTO app_user (username,password_hash,name,role) VALUES ('boss',$1,'董事长','chairman')", [await hashPassword('pw123')]);
  bossT = await login('boss');
});

describe('DELETE /api/workbooks/:id', () => {
  it('软删除成功,从列表消失,daily_metric 保留', async () => {
    const r = await request(app).delete(`/api/workbooks/${wbId}`).set('Authorization', `Bearer ${bossT}`);
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    const wb = (await query('SELECT deleted_at FROM workbook WHERE id=$1', [wbId])).rows[0];
    expect(wb.deleted_at).not.toBeNull();
    const dm = (await query('SELECT 1 FROM daily_metric WHERE source_workbook_id=$1', [wbId])).rows;
    expect(dm.length).toBe(1);
  });

  it('有活跃锁时拒绝(409)', async () => {
    await query("INSERT INTO sheet_lock (workbook_id, sheet_key, user_id, user_name, expires_at) VALUES ($1,'daily_ops',1,'boss',now()+interval '60 second')", [wbId]);
    const r = await request(app).delete(`/api/workbooks/${wbId}`).set('Authorization', `Bearer ${bossT}`);
    expect(r.status).toBe(409);
    const wb = (await query('SELECT deleted_at FROM workbook WHERE id=$1', [wbId])).rows[0];
    expect(wb.deleted_at).toBeNull();
  });

  it('不存在或已删返回 404', async () => {
    const r = await request(app).delete('/api/workbooks/999999').set('Authorization', `Bearer ${bossT}`);
    expect(r.status).toBe(404);
  });
});

describe('软删守卫:stale tab 不能向已删工作簿写快照/同步', () => {
  // 持锁后绕过 DELETE 路由的锁检查直接软删(模拟:删除后 tab 仍持有过期锁触发保存/同步)
  async function acquireLockThenSoftDelete() {
    await request(app).post(`/api/workbooks/${wbId}/locks/daily_ops`).set('Authorization', `Bearer ${bossT}`);
    await query('UPDATE workbook SET deleted_at=now() WHERE id=$1', [wbId]);
  }

  it('PUT /api/workbooks/:id/snapshot 对软删工作簿返回 404,不写快照', async () => {
    await acquireLockThenSoftDelete();
    const r = await request(app).put(`/api/workbooks/${wbId}/snapshot`).set('Authorization', `Bearer ${bossT}`)
      .send({ data: { sheets: {} } });
    expect(r.status).toBe(404);
    const snap = await query('SELECT 1 FROM workbook_snapshot WHERE workbook_id=$1', [wbId]);
    expect(snap.rows.length).toBe(0);
  });

  it('POST /api/workbooks/:id/extract 对软删工作簿返回 404,不插 daily_metric/expense', async () => {
    // beforeEach 已插入 1 条 daily_metric;软删后抽取不应新增
    const dmBefore = (await query('SELECT count(*)::int AS n FROM daily_metric WHERE source_workbook_id=$1', [wbId])).rows[0].n;
    const expBefore = (await query('SELECT count(*)::int AS n FROM expense WHERE source_workbook_id=$1', [wbId])).rows[0].n;
    await acquireLockThenSoftDelete();
    const r = await request(app).post(`/api/workbooks/${wbId}/extract`).set('Authorization', `Bearer ${bossT}`)
      .send({ source: 'manual' });
    expect(r.status).toBe(404);
    const dmAfter = (await query('SELECT count(*)::int AS n FROM daily_metric WHERE source_workbook_id=$1', [wbId])).rows[0].n;
    const expAfter = (await query('SELECT count(*)::int AS n FROM expense WHERE source_workbook_id=$1', [wbId])).rows[0].n;
    expect(dmAfter).toBe(dmBefore);
    expect(expAfter).toBe(expBefore);
  });
});
