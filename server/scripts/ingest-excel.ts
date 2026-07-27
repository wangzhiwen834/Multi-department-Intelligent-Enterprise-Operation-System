// 真实 Excel -> Univer 快照 -> AI 抽取 入库脚本(论文评估章前置动作)
// 用法:npx tsx scripts/ingest-excel.ts <excelPath> <businessCode> <shopCode> <shopName> <period>
// 例:npx tsx scripts/ingest-excel.ts "C:/.../Excel_exampel/2026.07月大河坎店.xlsx" footbath dahekan 大河坎店 2026-07
// 转换逻辑移植自 web/src/sheet-io.ts(exceljs -> Univer IWorkbookData,带样式)。
import 'dotenv/config';
import ExcelJS from 'exceljs';
import { pool, query } from '../src/db/pool.js';
import { extractWorkbook } from '../src/extraction/extraction.service.js';

const MAX_ROWS = 400;
// 模板 sheet key -> 可能的 Excel 工作表名(模板 label 优先,别名兜底)
const ALIASES: Record<string, string[]> = {
  daily_ops: ['经营报表', '酒店运营', '酒店运营数据统计表'],
  reconciliation: ['收入对账', '收入统计', '账户管理明细', '账户管理', '账户明细表'],
  expense: ['费用明细', '日常开销明细', '管理费用明细', '费用明细表'],
};

// ---------- exceljs -> Univer 样式/值转换(移植自 sheet-io.ts)----------
const argbToRgb = (argb?: string): string | undefined => {
  const m = argb && argb.match(/[0-9a-fA-F]{6}$/); return m ? `#${m[0].toLowerCase()}` : undefined;
};
const BORDER_FROM_EXCEL: Record<string, number> = {
  thin: 1, hair: 2, dotted: 3, dashed: 4, dashDot: 5, dashDotDot: 6, double: 7,
  medium: 8, mediumDashed: 9, mediumDashDot: 10, mediumDashDotDot: 11, slantDashDot: 12, thick: 13,
};
const HT_FROM_EXCEL: Record<string, number> = { left: 1, center: 2, right: 3, justify: 4, distributed: 6 };
const VT_FROM_EXCEL: Record<string, number> = { top: 1, middle: 2, bottom: 3 };
const excelWidthToPx = (w: number) => Math.round(w * 7 + 5);
const ptToPx = (pt: number) => Math.round(pt * 1.333);

function excelStyleToUniver(cell: ExcelJS.Cell): any | null {
  const st: any = {};
  const font = cell.font as any;
  if (font) {
    if (font.bold) st.bl = 1;
    if (font.italic) st.it = 1;
    if (font.underline) st.ul = { s: 1 };
    if (font.strike) st.st = { s: 1 };
    if (font.size) st.fs = font.size;
    if (font.name) st.ff = font.name;
    if (font.color?.argb) { const rgb = argbToRgb(font.color.argb); if (rgb) st.cl = { rgb }; }
  }
  const fill = cell.fill as any;
  if (fill && fill.type === 'pattern' && fill.fgColor?.argb) { const rgb = argbToRgb(fill.fgColor.argb); if (rgb) st.bg = { rgb }; }
  const al = cell.alignment as any;
  if (al) {
    if (al.horizontal && HT_FROM_EXCEL[al.horizontal]) st.ht = HT_FROM_EXCEL[al.horizontal];
    if (al.vertical && VT_FROM_EXCEL[al.vertical]) st.vt = VT_FROM_EXCEL[al.vertical];
    if (al.wrapText) st.tb = 3;
    if (al.textRotation != null) st.tr = { a: al.textRotation };
  }
  const border = cell.border as any;
  if (border) {
    const bd: any = {};
    for (const [side, k] of [['top', 't'], ['bottom', 'b'], ['left', 'l'], ['right', 'r']] as [string, string][]) {
      const b = border[side];
      if (b && b.style) bd[k] = { s: BORDER_FROM_EXCEL[b.style] ?? 1, cl: { rgb: argbToRgb(b.color?.argb) || '#000000' } };
    }
    if (Object.keys(bd).length) st.bd = bd;
  }
  if (cell.numFmt) st.n = { pattern: cell.numFmt };
  return Object.keys(st).length ? st : null;
}

function toUniverValue(v: any): any {
  if (v == null) return null;
  if (v instanceof Date) {
    const y = v.getFullYear(), m = String(v.getMonth() + 1).padStart(2, '0'), d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (v && typeof v === 'object' && Array.isArray(v.richText)) return v.richText.map((rt: any) => rt.text || '').join('');
  if (v && typeof v === 'object' && 'result' in v) return v.result;
  return v;
}

function colLetterToNum(letters: string): number { let n = 0; for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64); return n; }
function parseRange(s: string) {
  const m = String(s).match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
  if (!m) return null;
  return { startColumn: colLetterToNum(m[1]) - 1, endColumn: colLetterToNum(m[3]) - 1, startRow: Number(m[2]) - 1, endRow: Number(m[4]) - 1 };
}

function findWorksheet(wb: ExcelJS.Workbook, sheetKey: string, label: string): ExcelJS.Worksheet | undefined {
  for (const n of [label, ...(ALIASES[sheetKey] || [])]) { const ws = wb.getWorksheet(n); if (ws) return ws; }
  return undefined;
}

async function loadTemplate(businessId: number): Promise<any> {
  const r = (await query<{ definition: any }>('SELECT definition FROM template WHERE business_id=$1 ORDER BY version DESC LIMIT 1', [businessId])).rows[0];
  if (!r) throw new Error(`业务 ${businessId} 无模板`);
  return r.definition;
}

async function buildSnapshot(excelPath: string, template: any, title: string) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(excelPath);
  console.log('Excel 工作表:', wb.worksheets.map(w => `"${w.name}"`).join(', '));
  const stylesMap = new Map<string, string>(); const styles: Record<string, any> = {}; let styleIdx = 0;
  const getStyleId = (st: any | null): string | undefined => {
    if (!st) return undefined;
    const key = JSON.stringify(st);
    let id = stylesMap.get(key);
    if (!id) { id = String(styleIdx++); styles[id] = st; stylesMap.set(key, id); }
    return id;
  };
  const sheets: Record<string, any> = {}; const sheetOrder: string[] = [];
  for (const s of template.sheets) {
    const exWs = findWorksheet(wb, s.key, s.label);
    const sheetId = s.key; sheetOrder.push(sheetId);
    // 列上限取 Excel 实际列数与模板列数+2 的较大值:酒店经营报表指标散在 col 0~38(夹占比/前缀列),
    // 固定用模板列数会截断 col≥31 的房型/渠道指标,故按 Excel 实际宽度保留。
    const cols = exWs ? Math.max(s.columns.length + 2, exWs.columnCount) : s.columns.length + 2;
    const cellData: any = {}; const mergeData: any[] = []; const columnData: any = {}; const rowData: any = {};
    console.log(`  模板[${s.key}] label="${s.label}" -> ${exWs ? `Excel "${exWs.name}"` : '(未找到,留空)'}`);
    if (exWs) {
      exWs.eachRow((row, rowNum) => {
        const r = rowNum - 1; if (r >= MAX_ROWS) return;
        row.eachCell({ includeEmpty: false }, (cell, colNum) => {
          const c = colNum - 1; if (c >= cols) return;
          const st = excelStyleToUniver(cell);
          const cellObj: any = { v: toUniverValue(cell.value) };
          const sid = getStyleId(st); if (sid) cellObj.s = sid;
          if (!cellData[r]) cellData[r] = {}; cellData[r][c] = cellObj;
        });
        if (row.height) rowData[r] = { h: ptToPx(row.height) };
      });
      for (let i = 0; i < cols; i++) { const col = exWs.getColumn(i + 1); if (col && col.width) columnData[i] = { w: excelWidthToPx(col.width) }; }
      const merges: string[] = (exWs as any).model?.merges || [];
      for (const m of merges) { const range = parseRange(m); if (range) mergeData.push(range); }
    }
    sheets[sheetId] = { id: sheetId, name: s.label, rowCount: MAX_ROWS, columnCount: cols, cellData, mergeData, columnData, rowData };
  }
  return { name: title, styles, sheets, sheetOrder };
}

async function ensureShop(businessId: number, code: string, name: string): Promise<number> {
  // 优先按 name+business 匹配已有门店(老门店 code 可能为空,避免误建重复店)
  const byName = (await query<{ id: number }>("SELECT id FROM shop WHERE business_id=$1 AND name=$2 AND status='active'", [businessId, name])).rows[0];
  if (byName) { console.log(`  复用门店 name=${name} id=${byName.id}`); return byName.id; }
  const byCode = (await query<{ id: number }>('SELECT id FROM shop WHERE code=$1', [code])).rows[0];
  if (byCode) return byCode.id;
  const r = (await query<{ id: number }>(
    "INSERT INTO shop (business_id, code, name, monthly_target, status) VALUES ($1,$2,$3,150000,'active') RETURNING id",
    [businessId, code, name])).rows[0];
  console.log(`  新建门店 code=${code} name=${name} id=${r.id}`);
  return r.id;
}

async function main() {
  const [, , excelPath, businessCode, shopCode, shopName, period] = process.argv;
  if (!excelPath || !businessCode || !shopCode || !shopName || !period) {
    console.error('用法: npx tsx scripts/ingest-excel.ts <excelPath> <businessCode> <shopCode> <shopName> <period>');
    process.exit(1);
  }
  const biz = (await query<{ id: number; name: string }>('SELECT id,name FROM business WHERE code=$1', [businessCode])).rows[0];
  if (!biz) throw new Error(`业务 ${businessCode} 不存在,先 seed`);
  const template = await loadTemplate(biz.id);
  const shopId = await ensureShop(biz.id, shopCode, shopName);
  const wb = (await query<{ id: number }>(
    `INSERT INTO workbook (shop_id, period, template_version) VALUES ($1,$2,1)
     ON CONFLICT (shop_id, period) DO UPDATE SET updated_at=now(), deleted_at=NULL
     RETURNING id`, [shopId, period])).rows[0];
  console.log(`\n=== ${biz.name} / ${shopName} / ${period} -> workbook id=${wb.id} ===`);
  const snapshot = await buildSnapshot(excelPath, template, `${shopName} ${period}`);
  // 快照 upsert(SELECT-then-INSERT/UPDATE,不依赖唯一约束)
  const hasSnap = (await query('SELECT 1 FROM workbook_snapshot WHERE workbook_id=$1', [wb.id])).rows[0];
  if (hasSnap) await query('UPDATE workbook_snapshot SET data=$2, updated_at=now() WHERE workbook_id=$1', [wb.id, JSON.stringify(snapshot)]);
  else await query('INSERT INTO workbook_snapshot (workbook_id, data) VALUES ($1,$2)', [wb.id, JSON.stringify(snapshot)]);
  console.log('快照已写入,开始 AI 抽取...');
  const result = await extractWorkbook(wb.id, { source: 'manual', userId: null, onProgress: e => console.log('  [progress]', JSON.stringify(e)) });
  console.log('\n抽取结果:', JSON.stringify(result, null, 2));
  const cnt = (await query('SELECT count(*)::int n FROM daily_metric WHERE source_workbook_id=$1', [wb.id])).rows[0];
  console.log(`\ndaily_metric 总行数(本工作簿): ${cnt.n}`);
  const dm = (await query('SELECT date, metrics FROM daily_metric WHERE source_workbook_id=$1 ORDER BY date LIMIT 3', [wb.id])).rows;
  for (const d of dm) console.log(`  ${d.date}:`, JSON.stringify(d.metrics));
  await pool.end();
}
main().catch(e => { console.error('FAIL:', e); process.exit(1); });
