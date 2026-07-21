import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { query } from '../src/db/pool.js';
import { hashPassword } from '../src/auth/password.js';
import { resetDb } from './helpers.js';

let bossT: string;
let shopId: number;

async function login(u: string) {
  return (await request(app).post('/api/auth/login').send({ username: u, password: 'pw123' })).body.token as string;
}

beforeEach(async () => {
  await resetDb();
  const b = (await query("INSERT INTO business (code,name) VALUES ('footbath','足浴') RETURNING id")).rows[0];
  await query('INSERT INTO template (business_id, version, definition) VALUES ($1,1,$2)', [b.id, JSON.stringify({ sheets: [] })]);
  const s = (await query("INSERT INTO shop (business_id, code, name) VALUES ($1,'dk','大河坎店') RETURNING id", [b.id])).rows[0];
  shopId = s.id;
  await query('INSERT INTO workbook (shop_id, period, template_version) VALUES ($1,$2,1)', [shopId, '2026-06']);
  await query('INSERT INTO workbook (shop_id, period, template_version) VALUES ($1,$2,1)', [shopId, '2026-07']);
  await query('INSERT INTO workbook (shop_id, period, template_version, deleted_at) VALUES ($1,$2,1,now())', [shopId, '2026-05']);
  await query("INSERT INTO app_user (username,password_hash,name,role) VALUES ('boss',$1,'董事长','chairman')", [await hashPassword('pw123')]);
  bossT = await login('boss');
});

describe('GET /api/shops/:shopId/workbooks', () => {
  it('按 period 倒序返回,排除软删除,lockedBy 默认 null', async () => {
    const r = await request(app).get(`/api/shops/${shopId}/workbooks`).set('Authorization', `Bearer ${bossT}`);
    expect(r.status).toBe(200);
    expect(r.body.map((w: any) => w.period)).toEqual(['2026-07', '2026-06']);
    expect(r.body[0].lockedBy).toBeNull();
  });

  it('lockedBy 反映活跃锁持有者', async () => {
    const wb = (await query('SELECT id FROM workbook WHERE shop_id=$1 AND period=$2', [shopId, '2026-07'])).rows[0];
    await query("INSERT INTO sheet_lock (workbook_id, sheet_key, user_id, user_name, expires_at) VALUES ($1,'daily_ops',1,'boss',now()+interval '60 second')", [wb.id]);
    const r = await request(app).get(`/api/shops/${shopId}/workbooks`).set('Authorization', `Bearer ${bossT}`);
    const july = r.body.find((w: any) => w.period === '2026-07');
    expect(july.lockedBy).toBe('boss');
  });

  it('过期锁不计入 lockedBy', async () => {
    const wb = (await query('SELECT id FROM workbook WHERE shop_id=$1 AND period=$2', [shopId, '2026-07'])).rows[0];
    await query("INSERT INTO sheet_lock (workbook_id, sheet_key, user_id, user_name, expires_at) VALUES ($1,'daily_ops',1,'boss',now()-interval '1 second')", [wb.id]);
    const r = await request(app).get(`/api/shops/${shopId}/workbooks`).set('Authorization', `Bearer ${bossT}`);
    expect(r.body.find((w: any) => w.period === '2026-07').lockedBy).toBeNull();
  });
});

describe('POST /api/workbooks (upsert 清 deleted_at)', () => {
  it('软删后再建同月:upsert 复用原行并清 deleted_at,列表重新可见', async () => {
    // 软删 2026-07
    await query('UPDATE workbook SET deleted_at=now() WHERE shop_id=$1 AND period=$2', [shopId, '2026-07']);
    // 列表此时应排除 2026-07
    const before = await request(app).get(`/api/shops/${shopId}/workbooks`).set('Authorization', `Bearer ${bossT}`);
    expect(before.body.map((w: any) => w.period)).not.toContain('2026-07');
    // 重新创建同月
    const r = await request(app).post('/api/workbooks').set('Authorization', `Bearer ${bossT}`)
      .send({ shopId, period: '2026-07' });
    expect(r.status).toBe(201);
    expect(r.body.period).toBe('2026-07');
    // 行的 deleted_at 已清
    const wb = (await query('SELECT deleted_at FROM workbook WHERE shop_id=$1 AND period=$2', [shopId, '2026-07'])).rows[0];
    expect(wb.deleted_at).toBeNull();
    // 列表重新包含 2026-07
    const after = await request(app).get(`/api/shops/${shopId}/workbooks`).set('Authorization', `Bearer ${bossT}`);
    expect(after.body.map((w: any) => w.period)).toContain('2026-07');
  });
});
