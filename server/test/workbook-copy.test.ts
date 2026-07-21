import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { query } from '../src/db/pool.js';
import { hashPassword } from '../src/auth/password.js';
import { resetDb } from './helpers.js';

let bossT: string;
let srcId: number;
let tgtId: number;

async function login(u: string) {
  return (await request(app).post('/api/auth/login').send({ username: u, password: 'pw123' })).body.token as string;
}

const SRC_SNAP = {
  name: '店 2026-06', styles: { s1: { bg: { rgb: '#ff0000' } } }, sheetOrder: ['daily_ops', 'expense'],
  sheets: {
    daily_ops: { id: 'daily_ops', name: '经营报表', rowCount: 400, columnCount: 4, mergeData: [{ startRow: 0, startColumn: 0, endRow: 0, endColumn: 3 }], columnData: { 0: { w: 120 } }, rowData: {}, cellData: { 0: { 0: { v: '日期', s: 's1' } }, 1: { 0: { v: '2026-06-01', s: 's1' } } } },
    expense: { id: 'expense', name: '费用明细', rowCount: 400, columnCount: 3, mergeData: [], columnData: {}, rowData: {}, cellData: { 0: { 0: { v: '日期' } }, 2: { 0: { v: '2026-06-01' } } } },
  },
};

beforeEach(async () => {
  await resetDb();
  const b = (await query("INSERT INTO business (code,name) VALUES ('footbath','足浴') RETURNING id")).rows[0];
  await query('INSERT INTO template (business_id, version, definition) VALUES ($1,1,$2)', [b.id, JSON.stringify({ sheets: [] })]);
  const s = (await query("INSERT INTO shop (business_id, code, name) VALUES ($1,'dk','大河坎店') RETURNING id", [b.id])).rows[0];
  srcId = (await query('INSERT INTO workbook (shop_id, period, template_version) VALUES ($1,$2,1) RETURNING id', [s.id, '2026-06'])).rows[0].id;
  tgtId = (await query('INSERT INTO workbook (shop_id, period, template_version) VALUES ($1,$2,1) RETURNING id', [s.id, '2026-07'])).rows[0].id;
  await query('INSERT INTO workbook_snapshot (workbook_id, data) VALUES ($1,$2)', [srcId, JSON.stringify(SRC_SNAP)]);
  await query("INSERT INTO app_user (username,password_hash,name,role) VALUES ('boss',$1,'董事长','chairman')", [await hashPassword('pw123')]);
  bossT = await login('boss');
});

describe('POST /api/workbooks/:id/copy-from', () => {
  it('只保留第0行表头+结构,清空数据行,写入目标快照', async () => {
    const r = await request(app).post(`/api/workbooks/${tgtId}/copy-from`).set('Authorization', `Bearer ${bossT}`).send({ fromPeriod: '2026-06' });
    expect(r.status).toBe(200);
    const snap = (await query('SELECT data FROM workbook_snapshot WHERE workbook_id=$1', [tgtId])).rows[0].data;
    // 表头保留
    expect(snap.sheets.daily_ops.cellData[0][0].v).toBe('日期');
    expect(snap.sheets.daily_ops.cellData[0][0].s).toBe('s1');
    // 数据行清空
    expect(snap.sheets.daily_ops.cellData[1]).toBeUndefined();
    expect(snap.sheets.expense.cellData[2]).toBeUndefined();
    // 结构保留
    expect(snap.sheets.daily_ops.mergeData.length).toBe(1);
    expect(snap.sheets.daily_ops.columnData[0].w).toBe(120);
    expect(snap.styles.s1).toBeDefined();
    expect(snap.sheetOrder).toEqual(['daily_ops', 'expense']);
  });

  it('源月份不存在返回 404', async () => {
    const r = await request(app).post(`/api/workbooks/${tgtId}/copy-from`).set('Authorization', `Bearer ${bossT}`).send({ fromPeriod: '2025-12' });
    expect(r.status).toBe(404);
  });

  it('源无快照返回 400', async () => {
    await query('DELETE FROM workbook_snapshot WHERE workbook_id=$1', [srcId]);
    const r = await request(app).post(`/api/workbooks/${tgtId}/copy-from`).set('Authorization', `Bearer ${bossT}`).send({ fromPeriod: '2026-06' });
    expect(r.status).toBe(400);
  });
});
