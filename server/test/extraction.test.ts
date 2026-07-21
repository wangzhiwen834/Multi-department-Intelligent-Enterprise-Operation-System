import { describe, it, expect, beforeEach, vi } from 'vitest';
import { query } from '../src/db/pool.js';
import { resetDb } from './helpers.js';

// mock AI 网关:callDoubaoJson 可控;NotConfigured 与服务端同源
vi.mock('../src/ai/ai.gateway.js', () => ({
  callDoubaoJson: vi.fn(),
  NotConfigured: class NotConfigured extends Error { constructor(m = 'AI 未配置') { super(m); this.name = 'NotConfigured'; } },
}));
const { callDoubaoJson, NotConfigured } = await import('../src/ai/ai.gateway.js');
const { extractWorkbook } = await import('../src/extraction/extraction.service.js');

let wbId: number;
let shopId: number;

const tpl = {
  sheets: [
    { key: 'daily_ops', label: '经营报表', layout: 'transposed', grain: 'per_day', columns: [
      { key: 'date', label: '日期', type: 'date', kind: 'entry' },
      { key: 'revenue', label: '营业收入', type: 'number', kind: 'entry' },
      { key: 'customers_total', label: '总客流', type: 'int', kind: 'entry' },
      { key: 'customer_price', label: '客单价', type: 'number', kind: 'manual_derived' },
    ]},
    { key: 'reconciliation', label: '收入对账', layout: 'row_per_day', grain: 'per_day', columns: [
      { key: 'date', label: '日期', type: 'date', kind: 'entry' },
      { key: 'cash', label: '现金', type: 'number', kind: 'entry' },
    ]},
    { key: 'expense', label: '费用明细', layout: 'row_per_transaction', grain: 'per_transaction', columns: [
      { key: 'pay_date', label: '付款日期', type: 'date', kind: 'entry' },
      { key: 'attribution_month', label: '费用归属月', type: 'text', kind: 'entry' },
      { key: 'summary', label: '摘要', type: 'text', kind: 'entry' },
      { key: 'amount', label: '金额', type: 'number', kind: 'entry' },
      { key: 'payee', label: '收款人', type: 'text', kind: 'entry' },
      { key: 'subject', label: '科目', type: 'text', kind: 'entry' },
    ]},
  ],
};

const snapshot = {
  name: '大河坎店 2026-07', styles: {}, sheetOrder: ['daily_ops', 'reconciliation', 'expense'],
  sheets: {
    daily_ops: { id: 'daily_ops', name: '经营报表', cellData: {
      0: { 0: { v: '日期' }, 1: { v: '营业收入' }, 2: { v: '总客流' } },
      1: { 0: { v: '2026-07-01' }, 1: { v: 1234 }, 2: { v: 25 } },
    } },
    reconciliation: { id: 'reconciliation', name: '收入对账', cellData: {
      0: { 0: { v: '日期' }, 1: { v: '现金' } },
      1: { 0: { v: '2026-07-01' }, 1: { v: 500 } },
    } },
    expense: { id: 'expense', name: '费用明细', cellData: {
      0: { 0: { v: '付款日期' }, 1: { v: '费用归属月' }, 2: { v: '摘要' }, 3: { v: '金额' }, 4: { v: '收款人' }, 5: { v: '科目' } },
      1: { 0: { v: '2026-07-01' }, 1: { v: '2026-07' }, 2: { v: '维修费' }, 3: { v: 1600 }, 4: { v: '李伟明' }, 5: { v: '维修费' } },
    } },
  },
};

beforeEach(async () => {
  await resetDb();
  vi.mocked(callDoubaoJson).mockReset();
  const b = (await query("INSERT INTO business (code,name) VALUES ('footbath','足浴') RETURNING id")).rows[0];
  await query('INSERT INTO template (business_id, version, definition) VALUES ($1,1,$2)', [b.id, JSON.stringify(tpl)]);
  const s = (await query("INSERT INTO shop (business_id, code, name) VALUES ($1,'dk','大河坎店') RETURNING id", [b.id])).rows[0];
  shopId = s.id;
  const w = (await query("INSERT INTO workbook (shop_id, period, template_version) VALUES ($1,'2026-07',1) RETURNING id", [s.id])).rows[0];
  wbId = w.id;
  await query('INSERT INTO workbook_snapshot (workbook_id, data) VALUES ($1,$2)', [wbId, JSON.stringify(snapshot)]);
});

// 按 sheet key 路由 mock 返回(用户消息含 "(sheetKey)")
function mockBySheet(map: Record<string, any>) {
  vi.mocked(callDoubaoJson).mockImplementation(async (messages: any) => {
    const u: string = messages[1]?.content || '';
    for (const k of Object.keys(map)) if (u.includes(`(${k})`)) return map[k];
    return { rows: [] };
  });
}

describe('extractWorkbook', () => {
  it('正常抽取:daily_metric 写入(last_source=ai),费用入库', async () => {
    mockBySheet({
      daily_ops: { rows: [{ date: '2026-07-01', metrics: { revenue: 1234, customers_total: 25 } }] },
      reconciliation: { rows: [{ date: '2026-07-01', metrics: { cash: 500 } }] },
      expense: { expenses: [{ pay_date: '2026-07-01', attribution_month: '2026-07', summary: '维修费', amount: 1600, payee: '李伟明', subject: '维修费' }] },
    });
    const r = await extractWorkbook(wbId, { source: 'manual', userId: 1 });
    expect(r.ok).toBe(true);
    expect(r.extracted!.dailyMetrics).toBe(1);
    expect(r.extracted!.expenses).toBe(1);
    const dm = await query('SELECT metrics, last_source FROM daily_metric WHERE shop_id=$1 AND date=$2', [shopId, '2026-07-01']);
    expect(Number(dm.rows[0].metrics.revenue)).toBe(1234);
    expect(Number(dm.rows[0].metrics.customers_total)).toBe(25);
    expect(Number(dm.rows[0].metrics.cash)).toBe(500); // 跨表合并
    expect(dm.rows[0].last_source).toBe('ai');
    const exp = await query('SELECT amount, subject, source FROM expense WHERE shop_id=$1', [shopId]);
    expect(exp.rows.length).toBe(1);
    expect(Number(exp.rows[0].amount)).toBe(1600);
    expect(exp.rows[0].source).toBe('ai');
  });

  it('数值清洗:¥1,234 -> 1234', async () => {
    mockBySheet({
      daily_ops: { rows: [{ date: '2026-07-01', metrics: { revenue: '¥1,234' } }] },
      reconciliation: { rows: [] }, expense: { expenses: [] },
    });
    const r = await extractWorkbook(wbId, { source: 'manual', userId: 1 });
    expect(r.ok).toBe(true);
    const dm = await query('SELECT metrics FROM daily_metric WHERE shop_id=$1 AND date=$2', [shopId, '2026-07-01']);
    expect(Number(dm.rows[0].metrics.revenue)).toBe(1234);
  });

  it('非法数值进 errors 不写,其余写入', async () => {
    mockBySheet({
      daily_ops: { rows: [{ date: '2026-07-01', metrics: { revenue: 'abc', customers_total: 5 } }] },
      reconciliation: { rows: [] }, expense: { expenses: [] },
    });
    const r = await extractWorkbook(wbId, { source: 'manual', userId: 1 });
    expect(r.ok).toBe(true);
    expect(r.errors!.some(e => e.key === 'revenue')).toBe(true);
    const dm = await query('SELECT metrics FROM daily_metric WHERE shop_id=$1 AND date=$2', [shopId, '2026-07-01']);
    expect(dm.rows[0].metrics.revenue).toBeUndefined();
    expect(Number(dm.rows[0].metrics.customers_total)).toBe(5);
  });

  it('manual_derived 键不被写入(客单价)', async () => {
    mockBySheet({
      daily_ops: { rows: [{ date: '2026-07-01', metrics: { revenue: 100, customer_price: 50 } }] },
      reconciliation: { rows: [] }, expense: { expenses: [] },
    });
    await extractWorkbook(wbId, { source: 'manual', userId: 1 });
    const dm = await query('SELECT metrics FROM daily_metric WHERE shop_id=$1 AND date=$2', [shopId, '2026-07-01']);
    expect(Number(dm.rows[0].metrics.revenue)).toBe(100);
    expect(dm.rows[0].metrics.customer_price).toBeUndefined();
  });

  it('费用幂等:重复抽取不累积', async () => {
    mockBySheet({
      daily_ops: { rows: [] }, reconciliation: { rows: [] },
      expense: { expenses: [{ pay_date: '2026-07-01', attribution_month: '2026-07', summary: '维修费', amount: 1600, payee: '李伟明', subject: '维修费' }] },
    });
    await extractWorkbook(wbId, { source: 'manual', userId: 1 });
    await extractWorkbook(wbId, { source: 'manual', userId: 1 });
    const exp = await query('SELECT count(*)::int AS n FROM expense WHERE shop_id=$1', [shopId]);
    expect(exp.rows[0].n).toBe(1);
  });

  it('软删工作簿 -> ok:false', async () => {
    await query('UPDATE workbook SET deleted_at=now() WHERE id=$1', [wbId]);
    const r = await extractWorkbook(wbId, { source: 'manual', userId: 1 });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('不存在或已删除');
  });

  it('无快照 -> ok:false', async () => {
    await query('DELETE FROM workbook_snapshot WHERE workbook_id=$1', [wbId]);
    const r = await extractWorkbook(wbId, { source: 'manual', userId: 1 });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('无快照');
  });

  it('未配 key(NotConfigured) -> configured:false', async () => {
    vi.mocked(callDoubaoJson).mockRejectedValue(new NotConfigured());
    const r = await extractWorkbook(wbId, { source: 'manual', userId: 1 });
    expect(r.ok).toBe(false);
    expect(r.configured).toBe(false);
  });

  it('workbook.last_extracted_at 更新', async () => {
    mockBySheet({
      daily_ops: { rows: [{ date: '2026-07-01', metrics: { revenue: 1 } }] },
      reconciliation: { rows: [] }, expense: { expenses: [] },
    });
    await extractWorkbook(wbId, { source: 'manual', userId: 1 });
    const w = await query('SELECT last_extracted_at FROM workbook WHERE id=$1', [wbId]);
    expect(w.rows[0].last_extracted_at).not.toBeNull();
  });

  it('日期宽松解析:2026/7/1 -> 2026-07-01', async () => {
    mockBySheet({
      daily_ops: { rows: [{ date: '2026/7/1', metrics: { revenue: 100 } }] },
      reconciliation: { rows: [] }, expense: { expenses: [] },
    });
    const r = await extractWorkbook(wbId, { source: 'manual', userId: 1 });
    expect(r.ok).toBe(true);
    expect(r.errors!.some(e => e.key === 'date')).toBe(false);
    const dm = await query('SELECT metrics FROM daily_metric WHERE shop_id=$1 AND date=$2', [shopId, '2026-07-01']);
    expect(Number(dm.rows[0].metrics.revenue)).toBe(100);
  });

  it('LLM 返回异常结构不中断整体(该表 0 条+错误,其他表仍抽取)', async () => {
    mockBySheet({
      daily_ops: { rows: [null] },          // item=null -> 解析抛错
      reconciliation: { rows: [{ date: '2026-07-02', metrics: { cash: 50 } }] },
      expense: { expenses: [] },
    });
    const r = await extractWorkbook(wbId, { source: 'manual', userId: 1 });
    expect(r.ok).toBe(true);                 // 其他表成功 -> 整体 ok
    expect(r.errors!.some(e => e.sheetKey === 'daily_ops' && e.msg.includes('解析 LLM 输出失败'))).toBe(true);
    const dm = await query('SELECT metrics FROM daily_metric WHERE shop_id=$1 AND date=$2', [shopId, '2026-07-02']);
    expect(Number(dm.rows[0].metrics.cash)).toBe(50);
  });
});
