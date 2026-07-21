// AI 抽取管线核心:读工作簿快照 -> 序列化每表 -> 调 LLM(callDoubaoJson)语义化识别 ->
// coerceMetric 校验 -> 写 daily_metric/expense。位置式 sync 的替代入库路径。
import { query } from '../db/pool.js';
import { config } from '../config.js';
import { callDoubaoJson, NotConfigured } from '../ai/ai.gateway.js';
import { coerceMetric, isValidDate, isEmpty } from './validate.js';

export type ExtractSource = 'save' | 'manual' | 'scheduled';

export interface ExtractError { sheetKey: string; date: string; key: string; msg: string }
export interface ExtractResult {
  ok: boolean;
  code?: 'not_found' | 'not_configured' | 'llm_error'; // 路由据此定 404/503/502
  configured?: boolean;                              // false = 未配 key(503)
  extracted?: { dailyMetrics: number; expenses: number };
  errors?: ExtractError[];
  sheets?: { key: string; rowsIn: number; rowsOut: number }[];
  error?: string;                                    // ok=false 时的原因
}

interface TplColumn { key: string; label?: string; type: string; kind: string }
interface TplSheet { key: string; label?: string; layout?: string; grain?: string; columns: TplColumn[] }
interface TemplateDef { sheets: TplSheet[] }

// 抽取进度事件(SSE 推给前端,可视化流程)。done 事件由路由补发(result 在返回值里)。
export type ProgressEvent =
  | { stage: 'start'; sheets: { key: string; label: string }[] }
  | { stage: 'sheet_start'; key: string; label: string; index: number; total: number }
  | { stage: 'sheet_done'; key: string; rowsIn: number; rowsOut: number; errorCount: number }
  | { stage: 'write' };

// 序列化快照某表 cellData -> 紧凑 TSV(第0行表头 + 非空数据行)。后端纯 JSON 操作,不依赖 Univer。
function serializeSheet(sheet: any): { tsv: string; rowsIn: number } {
  const cd = sheet?.cellData || {};
  const rowIdx = Object.keys(cd).map(Number).filter(n => !Number.isNaN(n)).sort((a, b) => a - b);
  if (!rowIdx.length) return { tsv: '', rowsIn: 0 };
  const lines: string[] = [];
  let rowsIn = 0;
  for (const r of rowIdx) {
    if (r >= 400) break;
    const row = cd[r];
    if (!row) continue;
    const cols = Object.keys(row).map(Number).filter(n => !Number.isNaN(n));
    if (!cols.length) continue;
    const maxC = Math.max(...cols);
    const cells: string[] = [];
    for (let c = 0; c <= maxC; c++) {
      const v = row[c]?.v;
      cells.push(v == null ? '' : String(v));
    }
    if (r === 0 || cells.some(x => x !== '')) {
      lines.push(cells.join('\t'));
      if (r > 0) rowsIn++;
    }
  }
  return { tsv: lines.join('\n'), rowsIn };
}

function buildMessages(sheet: TplSheet, tsv: string) {
  const isExpense = sheet.key === 'expense';
  const entryCols = sheet.columns.filter(c => c.kind === 'entry' && c.key !== 'date' && c.key !== 'pay_date');
  const fields = entryCols.map(c => `- ${c.key}=${c.label || c.key}`).join('\n');
  const system = isExpense
    ? `你是足浴店财务数据抽取助手。从工作表数据(TSV,第1行表头)中识别费用明细,输出 JSON。
规则:按表头文字匹配目标字段(见用户消息);数值纯数字不带单位/千分位,空留 null;日期 YYYY-MM-DD。
严格输出 {"expenses":[{"pay_date":"YYYY-MM-DD","attribution_month":"...","summary":"...","amount":数值,"payee":"...","subject":"..."}]},不要 markdown/解释。`
    : `你是足浴店财务数据抽取助手。从工作表数据(TSV,第1行表头)中识别每日经营指标,输出 JSON。
规则:按表头文字匹配目标字段(见用户消息);只填目标字段;数值纯数字不带单位/千分位,空留 null;日期 YYYY-MM-DD。
严格输出 {"rows":[{"date":"YYYY-MM-DD","metrics":{"字段key":数值}}]},不要 markdown/解释。`;
  const user = `表名:${sheet.label || sheet.key}(${sheet.key})\n目标字段(key=中文标签):\n${fields}\n\nTSV 数据:\n${tsv}`;
  return [{ role: 'system' as const, content: system }, { role: 'user' as const, content: user }];
}

export async function extractWorkbook(
  wbId: number,
  opts: { source: ExtractSource; userId: number | null; onProgress?: (e: ProgressEvent) => void },
): Promise<ExtractResult> {
  const { onProgress } = opts;
  // 0. 配置预检(免得 emit 了 start 才发现没配 key;调度路径也受益)
  if (!config.doubaoApiKey) return { ok: false, code: 'not_configured', configured: false, error: 'AI 未配置' };
  // 1. 守卫:工作簿存在且未软删
  const wb = (await query<{ shop_id: number; deleted_at: string | null }>(
    'SELECT shop_id, deleted_at FROM workbook WHERE id=$1', [wbId],
  )).rows[0];
  if (!wb || wb.deleted_at) return { ok: false, code: 'not_found', error: '工作簿不存在或已删除' };
  // 2. 快照
  const snap = (await query<{ data: any }>('SELECT data FROM workbook_snapshot WHERE workbook_id=$1', [wbId])).rows[0];
  if (!snap || !snap.data) return { ok: false, code: 'not_found', error: '工作簿无快照' };
  // 3. 模板(经 shop -> business -> template)
  const shopBiz = (await query<{ bid: number; bcode: string }>(
    'SELECT s.business_id AS bid, b.code AS bcode FROM shop s JOIN business b ON b.id=s.business_id WHERE s.id=$1', [wb.shop_id],
  )).rows[0];
  if (!shopBiz) return { ok: false, code: 'not_found', error: '门店不存在' };
  const tplRow = (await query<{ definition: TemplateDef }>(
    'SELECT definition FROM template WHERE business_id=$1 ORDER BY version DESC LIMIT 1', [shopBiz.bid],
  )).rows[0];
  if (!tplRow) return { ok: false, code: 'not_found', error: '模板不存在' };
  const tpl = tplRow.definition;

  const errors: ExtractError[] = [];
  const sheetReports: { key: string; rowsIn: number; rowsOut: number }[] = [];
  const dailyByDate = new Map<string, Record<string, unknown>>(); // date -> metrics(跨 daily_ops/reconciliation 合并)
  let expenseRows: Record<string, unknown>[] | null = null;       // null = expense 表未成功(不删已有,避免丢数据)
  let anySheetOk = false;
  let notConfigured = false;

  const sheets = tpl.sheets || [];
  onProgress?.({ stage: 'start', sheets: sheets.map(s => ({ key: s.key, label: s.label || s.key })) });
  for (let i = 0; i < sheets.length; i++) {
    const s = sheets[i];
    const errsBefore = errors.length;
    const sheet = snap.data?.sheets?.[s.key];
    const { tsv, rowsIn } = sheet ? serializeSheet(sheet) : { tsv: '', rowsIn: 0 };
    onProgress?.({ stage: 'sheet_start', key: s.key, label: s.label || s.key, index: i, total: sheets.length });
    let llmResult: any;
    try {
      llmResult = await callDoubaoJson(buildMessages(s, tsv));
    } catch (e: any) {
      if (e instanceof NotConfigured || e?.name === 'NotConfigured') { notConfigured = true; break; }
      sheetReports.push({ key: s.key, rowsIn, rowsOut: 0 });
      errors.push({ sheetKey: s.key, date: '', key: '', msg: `LLM 调用失败:${e.message}` });
      onProgress?.({ stage: 'sheet_done', key: s.key, rowsIn, rowsOut: 0, errorCount: errors.length - errsBefore });
      continue;
    }
    anySheetOk = true;

    if (s.key === 'expense') {
      const expColByKey = new Map(s.columns.filter(c => c.kind === 'entry').map(c => [c.key, c]));
      const rows: Record<string, unknown>[] = [];
      for (const exp of llmResult.expenses || []) {
        const row: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(exp)) {
          const col = expColByKey.get(k);
          if (!col) continue;
          const r = coerceMetric(col.type, v);
          if (!r.ok) errors.push({ sheetKey: 'expense', date: String(exp.pay_date ?? ''), key: k, msg: r.error });
          else if (r.value !== undefined) row[k] = r.value;
        }
        rows.push(row);
      }
      expenseRows = rows;
      sheetReports.push({ key: s.key, rowsIn, rowsOut: rows.length });
      onProgress?.({ stage: 'sheet_done', key: s.key, rowsIn, rowsOut: rows.length, errorCount: errors.length - errsBefore });
    } else {
      const colByKey = new Map(s.columns.filter(c => c.kind === 'entry' && c.key !== 'date' && c.key !== 'pay_date').map(c => [c.key, c]));
      let rowsOut = 0;
      for (const item of llmResult.rows || []) {
        const date = item.date ? String(item.date).slice(0, 10) : '';
        if (!isValidDate(date)) { errors.push({ sheetKey: s.key, date: String(item.date ?? ''), key: 'date', msg: '日期格式错误' }); continue; }
        const metrics: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(item.metrics || {})) {
          const col = colByKey.get(k);
          if (!col) continue; // manual_derived / 未知键 -> 跳过
          const r = coerceMetric(col.type, v);
          if (!r.ok) errors.push({ sheetKey: s.key, date, key: k, msg: r.error });
          else if (r.value !== undefined) metrics[k] = r.value;
        }
        if (Object.keys(metrics).length) {
          dailyByDate.set(date, { ...(dailyByDate.get(date) || {}), ...metrics });
          rowsOut++;
        }
      }
      sheetReports.push({ key: s.key, rowsIn, rowsOut });
      onProgress?.({ stage: 'sheet_done', key: s.key, rowsIn, rowsOut, errorCount: errors.length - errsBefore });
    }
  }

  if (notConfigured) return { ok: false, code: 'not_configured', configured: false, error: 'AI 未配置' };
  if (!anySheetOk) return { ok: false, code: 'llm_error', configured: true, error: '所有工作表抽取失败', errors, sheets: sheetReports };
  onProgress?.({ stage: 'write' });

  // 4. 写 daily_metric(merge;last_source='ai')
  let dailyCount = 0;
  for (const [date, metrics] of dailyByDate) {
    await query(
      `INSERT INTO daily_metric (shop_id, date, business_code, metrics, source_workbook_id, last_source)
       VALUES ($1,$2,$3,$4,$5,'ai')
       ON CONFLICT (shop_id, date) DO UPDATE
       SET metrics = daily_metric.metrics || $4, source_workbook_id=$5, last_source='ai', updated_at=now()`,
      [wb.shop_id, date, shopBiz.bcode, JSON.stringify(metrics), wbId],
    );
    dailyCount++;
  }
  // 5. 写 expense(仅当 expense 表抽取成功才删后插,避免部分失败丢数据)
  let expenseCount = 0;
  if (expenseRows !== null) {
    await query('DELETE FROM expense WHERE source_workbook_id=$1', [wbId]);
    for (const e of expenseRows) {
      await query(
        `INSERT INTO expense (shop_id, pay_date, attribution_month, summary, amount, payee, subject, source_workbook_id, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'ai')`,
        [wb.shop_id, isEmpty(e.pay_date) ? null : String(e.pay_date), isEmpty(e.attribution_month) ? null : String(e.attribution_month),
         isEmpty(e.summary) ? null : String(e.summary), Number(e.amount) || 0, isEmpty(e.payee) ? null : String(e.payee),
         isEmpty(e.subject) ? null : String(e.subject), wbId],
      );
      expenseCount++;
    }
  }
  // 6. 更新 workbook.last_extracted_at(调度跳过 + /status 用)。不 bump updated_at(那是"最后保存"语义)。
  await query('UPDATE workbook SET last_extracted_at=now() WHERE id=$1', [wbId]);

  return { ok: true, configured: true, extracted: { dailyMetrics: dailyCount, expenses: expenseCount }, errors, sheets: sheetReports };
}
