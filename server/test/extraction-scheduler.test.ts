import { describe, it, expect, beforeEach, vi } from 'vitest';
import { query } from '../src/db/pool.js';
import { resetDb } from './helpers.js';

vi.mock('../src/extraction/extraction.service.js', () => ({ extractWorkbook: vi.fn() }));
vi.mock('node-cron', () => ({ default: { schedule: vi.fn() } }));

const { extractWorkbook } = await import('../src/extraction/extraction.service.js');
const cron = (await import('node-cron')).default as unknown as { schedule: ReturnType<typeof vi.fn> };
const { selectDueWorkbooks, runScheduledExtraction, startScheduler } = await import('../src/extraction/extraction.scheduler.js');

let shop1Id: number;
let shop2Id: number;
const period = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; })();

beforeEach(async () => {
  await resetDb();
  vi.mocked(extractWorkbook).mockReset();
  cron.schedule.mockClear();
  const b = (await query("INSERT INTO business (code,name) VALUES ('footbath','足浴') RETURNING id")).rows[0];
  shop1Id = (await query("INSERT INTO shop (business_id, code, name) VALUES ($1,'dk','大河坎店') RETURNING id", [b.id])).rows[0].id;
  shop2Id = (await query("INSERT INTO shop (business_id, code, name) VALUES ($1,'jb','江北店') RETURNING id", [b.id])).rows[0].id;
});

describe('selectDueWorkbooks', () => {
  it('从未抽取 -> due', () => {
    expect(selectDueWorkbooks([{ id: 1, updated_at: '2026-07-01', last_extracted_at: null }])).toEqual([1]);
  });
  it('抽取后有更新 -> due', () => {
    expect(selectDueWorkbooks([{ id: 1, updated_at: '2026-07-02', last_extracted_at: '2026-07-01' }])).toEqual([1]);
  });
  it('抽取后无更新 -> not due', () => {
    expect(selectDueWorkbooks([{ id: 1, updated_at: '2026-07-01', last_extracted_at: '2026-07-01' }])).toEqual([]);
  });
});

describe('runScheduledExtraction', () => {
  it('只抽取 due 的工作簿', async () => {
    const wb1 = (await query('INSERT INTO workbook (shop_id, period, template_version) VALUES ($1,$2,1) RETURNING id', [shop1Id, period])).rows[0];
    const wb2 = (await query('INSERT INTO workbook (shop_id, period, template_version) VALUES ($1,$2,1) RETURNING id', [shop2Id, period])).rows[0];
    await query('UPDATE workbook SET last_extracted_at=updated_at WHERE id=$1', [wb2.id]); // 抽取后无更新 -> not due
    vi.mocked(extractWorkbook).mockResolvedValue({ ok: true, configured: true, extracted: { dailyMetrics: 0, expenses: 0 }, errors: [], sheets: [] });
    await runScheduledExtraction();
    const calledIds = vi.mocked(extractWorkbook).mock.calls.map(c => c[0]);
    expect(calledIds).toContain(wb1.id);
    expect(calledIds).not.toContain(wb2.id);
  });

  it('某个失败不阻塞后续', async () => {
    const wb1 = (await query('INSERT INTO workbook (shop_id, period, template_version) VALUES ($1,$2,1) RETURNING id', [shop1Id, period])).rows[0];
    const wb2 = (await query('INSERT INTO workbook (shop_id, period, template_version) VALUES ($1,$2,1) RETURNING id', [shop2Id, period])).rows[0];
    vi.mocked(extractWorkbook)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ ok: true, configured: true, extracted: { dailyMetrics: 0, expenses: 0 }, errors: [], sheets: [] });
    await runScheduledExtraction();
    expect(extractWorkbook).toHaveBeenCalledTimes(2);
  });

  it('非当期工作簿不抽取', async () => {
    await query('INSERT INTO workbook (shop_id, period, template_version) VALUES ($1,$2,1) RETURNING id', [shop1Id, '2020-01']);
    vi.mocked(extractWorkbook).mockResolvedValue({ ok: true, configured: true, extracted: { dailyMetrics: 0, expenses: 0 }, errors: [], sheets: [] });
    await runScheduledExtraction();
    expect(extractWorkbook).not.toHaveBeenCalled();
  });
});

describe('startScheduler', () => {
  it('test 环境不注册 cron', () => {
    startScheduler();
    expect(cron.schedule).not.toHaveBeenCalled();
  });
});
