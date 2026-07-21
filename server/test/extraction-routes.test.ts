import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { query } from '../src/db/pool.js';
import { hashPassword } from '../src/auth/password.js';
import { resetDb } from './helpers.js';

vi.mock('../src/ai/ai.gateway.js', () => ({
  callDoubaoJson: vi.fn(),
  NotConfigured: class NotConfigured extends Error { constructor(m = 'AI 未配置') { super(m); this.name = 'NotConfigured'; } },
}));
const { callDoubaoJson } = await import('../src/ai/ai.gateway.js');

let wbId: number;
let managerT: string;
let employeeT: string;

const tpl = {
  sheets: [
    { key: 'daily_ops', label: '经营报表', columns: [
      { key: 'date', type: 'date', kind: 'entry' },
      { key: 'revenue', type: 'number', kind: 'entry' },
    ]},
    { key: 'expense', label: '费用明细', columns: [{ key: 'amount', type: 'number', kind: 'entry' }] },
  ],
};
const snapshot = {
  name: 't', styles: {}, sheetOrder: ['daily_ops', 'expense'],
  sheets: {
    daily_ops: { id: 'daily_ops', name: '经营报表', cellData: { 0: { 0: { v: '日期' }, 1: { v: '营业收入' } }, 1: { 0: { v: '2026-07-01' }, 1: { v: 100 } } } },
    expense: { id: 'expense', name: '费用明细', cellData: {} },
  },
};

beforeEach(async () => {
  await resetDb();
  vi.mocked(callDoubaoJson).mockReset();
  const b = (await query("INSERT INTO business (code,name) VALUES ('footbath','足浴') RETURNING id")).rows[0];
  await query('INSERT INTO template (business_id, version, definition) VALUES ($1,1,$2)', [b.id, JSON.stringify(tpl)]);
  const s = (await query("INSERT INTO shop (business_id, code, name) VALUES ($1,'dk','大河坎店') RETURNING id", [b.id])).rows[0];
  const w = (await query("INSERT INTO workbook (shop_id, period, template_version) VALUES ($1,'2026-07',1) RETURNING id", [s.id])).rows[0];
  wbId = w.id;
  await query('INSERT INTO workbook_snapshot (workbook_id, data) VALUES ($1,$2)', [wbId, JSON.stringify(snapshot)]);
  await query("INSERT INTO app_user (username,password_hash,name,role) VALUES ('mgr',$1,'经理','manager')", [await hashPassword('pw')]);
  await query("INSERT INTO app_user (username,password_hash,name,role) VALUES ('emp',$1,'员工','employee')", [await hashPassword('pw')]);
  managerT = (await request(app).post('/api/auth/login').send({ username: 'mgr', password: 'pw' })).body.token;
  employeeT = (await request(app).post('/api/auth/login').send({ username: 'emp', password: 'pw' })).body.token;
});

function mockOk() {
  vi.mocked(callDoubaoJson).mockImplementation(async (m: any) => {
    const u: string = m[1]?.content || '';
    if (u.includes('(daily_ops)')) return { rows: [{ date: '2026-07-01', metrics: { revenue: 100 } }] };
    if (u.includes('(expense)')) return { expenses: [] };
    return { rows: [] };
  });
}

async function acquire() {
  await request(app).post(`/api/workbooks/${wbId}/locks/daily_ops`).set('Authorization', `Bearer ${managerT}`);
}

// 解析 SSE 流:取所有 data: 事件;doneResult 取末尾 done 事件的 result
function parseSSE(text: string): any[] {
  return text.split('\n\n').filter(Boolean).map(chunk => {
    const line = chunk.split('\n').find(l => l.startsWith('data: '));
    try { return line ? JSON.parse(line.slice(6)) : null; } catch { return null; }
  }).filter(Boolean);
}
function doneResult(text: string): any {
  return parseSSE(text).find((e: any) => e.stage === 'done')?.result;
}

describe('POST /api/workbooks/:id/extract', () => {
  it('manager 手动抽取 -> 200 + done ok', async () => {
    mockOk();
    const r = await request(app).post(`/api/workbooks/${wbId}/extract`).set('Authorization', `Bearer ${managerT}`)
      .send({ source: 'manual' });
    expect(r.status).toBe(200);
    const result = doneResult(r.text);
    expect(result.ok).toBe(true);
    expect(result.extracted.dailyMetrics).toBe(1);
    // 进度事件齐全:start + 每表 sheet_start/sheet_done + write + done
    const stages = parseSSE(r.text).map((e: any) => e.stage);
    expect(stages).toContain('start');
    expect(stages.filter(s => s === 'sheet_start').length).toBeGreaterThan(0);
    expect(stages).toContain('done');
  });

  it('employee 手动抽取 -> 403', async () => {
    const r = await request(app).post(`/api/workbooks/${wbId}/extract`).set('Authorization', `Bearer ${employeeT}`)
      .send({ source: 'manual' });
    expect(r.status).toBe(403);
  });

  it('save 未持锁 -> 409', async () => {
    const r = await request(app).post(`/api/workbooks/${wbId}/extract`).set('Authorization', `Bearer ${managerT}`)
      .send({ source: 'save' });
    expect(r.status).toBe(409);
  });

  it('save 持锁 -> 200 + done ok', async () => {
    mockOk();
    await acquire();
    const r = await request(app).post(`/api/workbooks/${wbId}/extract`).set('Authorization', `Bearer ${managerT}`)
      .send({ source: 'save' });
    expect(r.status).toBe(200);
    expect(doneResult(r.text).ok).toBe(true);
  });

  it('未配 key -> done configured:false', async () => {
    const { NotConfigured } = await import('../src/ai/ai.gateway.js');
    vi.mocked(callDoubaoJson).mockRejectedValue(new NotConfigured());
    const r = await request(app).post(`/api/workbooks/${wbId}/extract`).set('Authorization', `Bearer ${managerT}`)
      .send({ source: 'manual' });
    expect(r.status).toBe(200); // 流已开,结果在 done 事件
    const result = doneResult(r.text);
    expect(result.ok).toBe(false);
    expect(result.configured).toBe(false);
  });

  it('软删工作簿 -> 404', async () => {
    await query('UPDATE workbook SET deleted_at=now() WHERE id=$1', [wbId]);
    const r = await request(app).post(`/api/workbooks/${wbId}/extract`).set('Authorization', `Bearer ${managerT}`)
      .send({ source: 'manual' });
    expect(r.status).toBe(404);
  });

  it('GET status -> 200 + lastExtractedAt', async () => {
    mockOk();
    await request(app).post(`/api/workbooks/${wbId}/extract`).set('Authorization', `Bearer ${managerT}`).send({ source: 'manual' });
    const r = await request(app).get(`/api/workbooks/${wbId}/extract/status`).set('Authorization', `Bearer ${managerT}`);
    expect(r.status).toBe(200);
    expect(r.body.lastExtractedAt).not.toBeNull();
  });
});
