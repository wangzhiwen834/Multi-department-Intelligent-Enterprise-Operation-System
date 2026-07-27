// 只读盘点 Excel_exampel/ 下真实 Excel(评估章用):工作表结构 + 公式错误单元格 + 日期数。
// 纯 exceljs,不连 DB、不联网。可删。
import ExcelJS from 'exceljs';
import { fileURLToPath } from 'url';
import { readdirSync } from 'fs';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = join(__dirname, '../../Excel_exampel');
const ERR_RE = /#REF!|#DIV\/0!|#VALUE!|#N\/A|#NAME\?|#NULL!|#NUM!|#SPILL!|#CALC!/;

function valToStr(v: unknown): string {
  if (v == null || v === '') return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    const o = v as any;
    if ('error' in o) return String(o.error);
    if ('result' in o) return String(o.result);
    if (Array.isArray(o.richText)) return o.richText.map((r: any) => r.text || '').join('');
    return JSON.stringify(o);
  }
  return String(v);
}
function isDate(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === 'string' && /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(v.trim())) return v.trim().slice(0, 10).replace(/\//g, '-');
  return null;
}

async function inspect(file: string) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  console.log(`\n=== ${file.split(/[\\/]/).pop()} ===`);
  console.log(`工作表(${wb.worksheets.length}): ${wb.worksheets.map(w => `"${w.name}"`).join(', ')}`);
  for (const ws of wb.worksheets) {
    const rowCount = ws.rowCount, colCount = ws.columnCount;
    let errCount = 0; const errSamples: string[] = [];
    const dates = new Set<string>();
    const preview: string[][] = [];
    for (let r = 1; r <= Math.min(3, rowCount); r++) {
      const row = ws.getRow(r); const cells: string[] = [];
      for (let c = 1; c <= Math.min(14, colCount); c++) cells.push(valToStr(row.getCell(c).value));
      preview.push(cells);
    }
    ws.eachRow((row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        const v = cell.value as any;
        const d = isDate(v); if (d) dates.add(d);
        if (v && typeof v === 'object' && 'error' in v) { errCount++; if (errSamples.length < 6) errSamples.push(`${cell.address}=${v.error}`); }
        else { const s = valToStr(v); if (ERR_RE.test(s)) { errCount++; if (errSamples.length < 6) errSamples.push(`${cell.address}=${s}`); } }
      });
    });
    const darr = [...dates].sort();
    console.log(`  [${ws.name}] rows=${rowCount} cols=${colCount} 公式错误=${errCount} 日期数=${dates.size}${darr.length ? `(${darr[0]}~${darr[darr.length - 1]})` : ''}${errSamples.length ? ` | 错误例:${errSamples.join(', ')}` : ''}`);
    preview.forEach((cells, i) => console.log(`    行${i + 1}: ${cells.join(' | ')}`));
  }
}

(async () => {
  const files = readdirSync(DIR).filter(f => f.toLowerCase().endsWith('.xlsx') && !f.startsWith('~')).sort().map(f => join(DIR, f));
  console.log('盘点文件:', files.map(f => f.split(/[\\/]/).pop()).join(', '));
  for (const f of files) { try { await inspect(f); } catch (e) { console.error(`FAIL ${f}:`, (e as Error).message); } }
})();
