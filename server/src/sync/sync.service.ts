import { query } from '../db/pool.js';
import type { TokenPayload } from '../auth/jwt.js';

interface SyncBody {
  dailyMetrics: { date: string; sheetKey?: string; metrics: Record<string, unknown> }[];
  expenses: { pay_date: string | null; attribution_month: string | null; summary: string | null; amount: number; payee: string | null; subject: string | null }[];
}

interface TplColumn { key: string; type: string; kind: string }
interface TplSheet { key: string; columns: TplColumn[] }
interface TemplateDef { sheets: TplSheet[] }

const isEmpty = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
const isValidDate = (v: unknown) => typeof v === 'string' && /^\d{4}[-/]\d{2}[-/]\d{2}$/.test(v.trim());
const typeCheck = (type: string, val: unknown): boolean => {
  if (isEmpty(val)) return true;
  switch (type) {
    case 'number': return typeof val === 'number' || (typeof val === 'string' && !isNaN(Number(val)));
    case 'int': return Number.isInteger(Number(val));
    case 'date': return typeof val === 'string' || val instanceof Date;
    default: return true; // text
  }
};

export const syncWorkbook = async (wbId: number, body: SyncBody, user: TokenPayload) => {
  // 保存防覆盖:校验锁归属
  const lock = await query(
    'SELECT 1 FROM sheet_lock WHERE workbook_id=$1 AND user_id=$2 AND expires_at > now()',
    [wbId, user.id],
  );
  if (!lock.rows.length) return { ok: false as const, error: 'lock lost', status: 409 };

  const wb = (await query<{ shop_id: number }>('SELECT shop_id FROM workbook WHERE id=$1 AND deleted_at IS NULL', [wbId])).rows[0];
  if (!wb) return { ok: false as const, error: 'workbook not found or deleted', status: 404 };
  const shopBiz = (await query<{ bid: number; bcode: string }>(
    'SELECT s.business_id AS bid, b.code AS bcode FROM shop s JOIN business b ON b.id=s.business_id WHERE s.id=$1', [wb.shop_id],
  )).rows[0];
  const tplRow = (await query<{ definition: TemplateDef }>(
    'SELECT definition FROM template WHERE business_id=$1 ORDER BY version DESC LIMIT 1', [shopBiz.bid],
  )).rows[0];
  const tpl = tplRow.definition;

  const errors: { sheetKey: string; date: string; key: string; msg: string }[] = [];
  const entryColsBySheet = new Map<string, TplColumn[]>();
  for (const s of tpl.sheets ?? []) entryColsBySheet.set(s.key, (s.columns ?? []).filter(c => c.kind === 'entry'));

  // upsert daily_metric(按 sheetKey 归属的 entry 列)
  for (const row of body.dailyMetrics ?? []) {
    if (isEmpty(row.date) || !isValidDate(row.date)) continue; // 跳过空日期或非日期格式行（如表头"日期"）
    const sheetKey = row.sheetKey ?? 'daily_ops';
    const cols = entryColsBySheet.get(sheetKey) ?? [];
    for (const c of cols) {
      if (!typeCheck(c.type, row.metrics[c.key])) errors.push({ sheetKey, date: row.date, key: c.key, msg: `类型错误(${c.type})` });
    }
    const metrics: Record<string, unknown> = {};
    for (const c of cols) {
      const v = row.metrics[c.key];
      if (!isEmpty(v)) metrics[c.key] = c.type === 'number' || c.type === 'int' ? Number(v) : v;
    }
    await query(
      `INSERT INTO daily_metric (shop_id, date, business_code, metrics, source_workbook_id)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (shop_id, date) DO UPDATE
       SET metrics = daily_metric.metrics || $4, source_workbook_id=$5, updated_at=now()`,
      [wb.shop_id, isEmpty(row.date) ? null : row.date, shopBiz.bcode, JSON.stringify(metrics), wbId],
    );
  }

  // expense:删旧插新(幂等)
  await query('DELETE FROM expense WHERE source_workbook_id=$1', [wbId]);
  for (const e of body.expenses ?? []) {
    if (!typeCheck('number', e.amount)) errors.push({ sheetKey: 'expense', date: String(e.pay_date ?? ''), key: 'amount', msg: '金额类型错误' });
    await query(
      `INSERT INTO expense (shop_id, pay_date, attribution_month, summary, amount, payee, subject, source_workbook_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [wb.shop_id, isEmpty(e.pay_date) ? null : e.pay_date, isEmpty(e.attribution_month) ? null : e.attribution_month, isEmpty(e.summary) ? null : e.summary, Number(e.amount) || 0, isEmpty(e.payee) ? null : e.payee, isEmpty(e.subject) ? null : e.subject, wbId],
    );
  }

  // 合计:autoSums = 每个 entry 指标的月合计
  const autoSums: Record<string, Record<string, number>> = {};
  const { rows: sums } = await query(
    'SELECT metrics FROM daily_metric WHERE shop_id=$1 AND source_workbook_id=$2', [wb.shop_id, wbId],
  );
  for (const [sheetKey, cols] of entryColsBySheet) {
    const acc: Record<string, number> = {};
    for (const c of cols) acc[c.key] = 0;
    for (const r of sums) {
      const m = r.metrics as Record<string, unknown>;
      for (const c of cols) {
        const v = Number(m[c.key]);
        if (!isNaN(v)) acc[c.key] += v;
      }
    }
    autoSums[sheetKey] = acc;
  }

  return { ok: true as const, autoSums, errors };
};
