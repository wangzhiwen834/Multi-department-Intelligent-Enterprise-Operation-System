import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { query } from '../src/db/pool.js';
import { hashPassword } from '../src/auth/password.js';
import { resetDb } from './helpers.js';

let bossT: string;
let shopId: number;
let tplDef: any;

async function login(u: string) {
  return (await request(app).post('/api/auth/login').send({ username: u, password: 'pw123' })).body.token as string;
}

const FULL_SNAP = {
  name: '店 2026-07', styles: { s1: { bg: { rgb: '#00ff00' } } }, sheetOrder: ['daily_ops', 'expense'],
  sheets: {
    daily_ops: { id: 'daily_ops', name: '经营报表', rowCount: 400, columnCount: 4, mergeData: [], columnData: {}, rowData: {}, cellData: { 0: { 0: { v: '日期', s: 's1' } } } },
    expense: { id: 'expense', name: '费用明细', rowCount: 400, columnCount: 3, mergeData: [], columnData: {}, rowData: {}, cellData: { 0: { 0: { v: '金额' } } } },
  },
};

beforeEach(async () => {
  await resetDb();
  tplDef = { sheets: [{ key: 'daily_ops', label: '经营报表', columns: [] }, { key: 'expense', label: '费用明细', columns: [] }] };
  const b = (await query("INSERT INTO business (code,name) VALUES ('footbath','足浴') RETURNING id")).rows[0];
  await query('INSERT INTO template (business_id, version, definition) VALUES ($1,1,$2)', [b.id, JSON.stringify(tplDef)]);
  const s = (await query("INSERT INTO shop (business_id, code, name) VALUES ($1,'dk','大河坎店') RETURNING id", [b.id])).rows[0];
  shopId = s.id;
  await query("INSERT INTO app_user (username,password_hash,name,role) VALUES ('boss',$1,'董事长','chairman')", [await hashPassword('pw123')]);
  bossT = await login('boss');
});

describe('POST /api/workbooks/bootstrap', () => {
  it('有快照:活动表带 cellData,其余表 cellData 为空,返回 template 与 lockStatus', async () => {
    const wb = (await query('INSERT INTO workbook (shop_id, period, template_version) VALUES ($1,$2,1) RETURNING id', [shopId, '2026-07'])).rows[0];
    await query('INSERT INTO workbook_snapshot (workbook_id, data) VALUES ($1,$2)', [wb.id, JSON.stringify(FULL_SNAP)]);
    const r = await request(app).post('/api/workbooks/bootstrap').set('Authorization', `Bearer ${bossT}`).send({ shopId, period: '2026-07' });
    expect(r.status).toBe(200);
    expect(r.body.wbId).toBe(wb.id);
    expect(r.body.template.definition.sheets.length).toBe(2);
    expect(r.body.lockStatus).toEqual({ held: false });
    const snap = r.body.snapshot.data;
    expect(snap.sheetOrder).toEqual(['daily_ops', 'expense']);
    expect(snap.sheets.daily_ops.cellData[0][0].v).toBe('日期');   // 活动表保留
    expect(snap.sheets.expense.cellData).toEqual({});               // 非活动表清空
    expect(snap.styles.s1).toBeDefined();                           // 全量 styles 保留
  });

  it('无快照:snapshot=null', async () => {
    const r = await request(app).post('/api/workbooks/bootstrap').set('Authorization', `Bearer ${bossT}`).send({ shopId, period: '2026-08' });
    expect(r.status).toBe(200);
    expect(r.body.snapshot).toBeNull();
    expect(r.body.wbId).toBeGreaterThan(0);
  });
});

describe('GET /api/workbooks/:id/sheets/:sheetKey/celldata', () => {
  it('返回指定表 cellData 与全量 styles', async () => {
    const wb = (await query('INSERT INTO workbook (shop_id, period, template_version) VALUES ($1,$2,1) RETURNING id', [shopId, '2026-07'])).rows[0];
    await query('INSERT INTO workbook_snapshot (workbook_id, data) VALUES ($1,$2)', [wb.id, JSON.stringify(FULL_SNAP)]);
    const r = await request(app).get(`/api/workbooks/${wb.id}/sheets/expense/celldata`).set('Authorization', `Bearer ${bossT}`);
    expect(r.status).toBe(200);
    expect(r.body.cellData[0][0].v).toBe('金额');
    expect(r.body.styles.s1).toBeDefined();
  });

  it('快照不存在返回 404', async () => {
    const wb = (await query('INSERT INTO workbook (shop_id, period, template_version) VALUES ($1,$2,1) RETURNING id', [shopId, '2026-07'])).rows[0];
    const r = await request(app).get(`/api/workbooks/${wb.id}/sheets/expense/celldata`).set('Authorization', `Bearer ${bossT}`);
    expect(r.status).toBe(404);
  });
});

describe('POST /api/workbooks(回归:upsertWorkbook 重构后)', () => {
  it('首次创建返回 201 + 完整行', async () => {
    const r = await request(app).post('/api/workbooks').set('Authorization', `Bearer ${bossT}`).send({ shopId, period: '2026-09' });
    expect(r.status).toBe(201);
    expect(r.body.id).toBeGreaterThan(0);
    expect(r.body).toMatchObject({ shop_id: shopId, period: '2026-09', template_version: 1, status: 'active' });
  });

  it('重复同月 upsert 返回同一 id', async () => {
    const r1 = await request(app).post('/api/workbooks').set('Authorization', `Bearer ${bossT}`).send({ shopId, period: '2026-10' });
    const r2 = await request(app).post('/api/workbooks').set('Authorization', `Bearer ${bossT}`).send({ shopId, period: '2026-10' });
    expect(r1.body.id).toBe(r2.body.id);
  });
});
