import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb } from './helpers.js';
import { executeTool } from '../src/ai/ai.tools.js';
import { query } from '../src/db/pool.js';

beforeEach(async () => {
  await resetDb();
  const b = (await query("INSERT INTO business (code,name) VALUES ('footbath','足浴') RETURNING id")).rows[0];
  await query('INSERT INTO template (business_id, version, definition) VALUES ($1,1,$2)', [b.id, JSON.stringify({ sheets: [{ key: 'daily_ops', columns: [{ key: 'revenue', label: '营业收入', type: 'number', kind: 'entry' }] }] })]);
  const s = (await query("INSERT INTO shop (business_id, code, name, monthly_target) VALUES ($1,'dk','大河坎店',150000) RETURNING id", [b.id])).rows[0];
  await query("INSERT INTO daily_metric (shop_id,date,business_code,metrics,source_workbook_id) VALUES ($1,'2026-07-01','footbath','{\"revenue\":1000}',NULL)", [s.id]);
});

describe('ai tools', () => {
  it('get_template 返回指标定义', async () => {
    const r: any = await executeTool('get_template', {}, { shopId: null, period: '2026-07' });
    expect(r.sheets[0].columns[0].key).toBe('revenue');
  });
  it('get_kpis 返回营收汇总', async () => {
    const r: any = await executeTool('get_kpis', { period: '2026-07' }, { shopId: null, period: '2026-07' });
    expect(Number(r.totalRevenue)).toBe(1000);
    expect(r.taskProgress).toBeGreaterThan(0);
  });
  it('compare_shops 返回各店排名', async () => {
    const r: any = await executeTool('compare_shops', { period: '2026-07', metricKey: 'revenue' }, { shopId: null, period: '2026-07' });
    expect(r[0].shopName).toBe('大河坎店');
    expect(Number(r[0].value)).toBe(1000);
  });
});
