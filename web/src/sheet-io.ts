import * as XLSX from 'xlsx';
import type { TemplateDef } from './types';

// 工作表最大行数(与 buildFromTemplate 的 rowCount 一致)
const MAX_ROWS = 400;

// Date -> 'yyyy-mm-dd' 字符串(与 extractForSync 的日期处理一致)
const toDateStr = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

// 裁掉尾部全空行(避免导出几百行空行)
function trimTrailingEmpty(aoa: unknown[][]): unknown[][] {
  let last = aoa.length;
  while (last > 0) {
    const row = aoa[last - 1];
    const empty = !row || row.every(v => v === null || v === undefined || v === '');
    if (empty) last--; else break;
  }
  return aoa.slice(0, last);
}

// 导出工作簿所有 sheet 到 .xlsx 并触发浏览器下载。
// 每个 sheet = 模板里的一张表,用 label 作为 xlsx sheet 名。
export function exportWorkbookToXlsx(fwb: any, template: TemplateDef, filename: string): void {
  const wb = XLSX.utils.book_new();
  for (const s of template.sheets) {
    const sheet = fwb.getSheetByName(s.label);
    if (!sheet) continue;
    const cols = s.columns.length + 2;
    const aoa = sheet.getRange(0, 0, MAX_ROWS, cols).getValues() as unknown[][];
    let trimmed = trimTrailingEmpty(aoa);
    if (trimmed.length === 0) {
      // 空表至少保留表头,方便员工填数据
      trimmed = [s.columns.map(c => c.label)];
    }
    const ws = XLSX.utils.aoa_to_sheet(trimmed);
    XLSX.utils.book_append_sheet(wb, ws, s.label);
  }
  XLSX.writeFile(wb, filename);
}

// 导入 .xlsx,覆盖写入工作簿(按 sheet 名匹配)。返回成功导入的表数。
// - 表头校验:第 0 行应与模板列名一致,不符则弹确认警告(避免列错位)。
// - 覆盖:先清空数据区(1..MAX_ROWS 行),再写入 xlsx 内容(含表头)。
// - 日期:Date -> 'yyyy-mm-dd' 字符串;其余原样。
export async function importXlsxToWorkbook(fwb: any, template: TemplateDef, data: ArrayBuffer): Promise<number> {
  const wb = XLSX.read(data, { type: 'array', cellDates: true });
  let imported = 0;
  for (const s of template.sheets) {
    const xlsxSheet = wb.Sheets[s.label];
    if (!xlsxSheet) continue;
    const sheet = fwb.getSheetByName(s.label);
    if (!sheet) continue;

    const aoa = XLSX.utils.sheet_to_json<unknown[]>(xlsxSheet, { header: 1, raw: true, defval: null });
    if (!aoa.length) continue;

    // 表头校验
    const expectedHeader = s.columns.map(c => c.label);
    const actualHeader = (aoa[0] ?? []).map((v: unknown) => (v === null || v === undefined ? '' : String(v)).trim());
    const headerMismatch = expectedHeader.some((h, i) => actualHeader[i] !== h);
    if (headerMismatch) {
      const ok = confirm(`「${s.label}」表头与模板不符,继续导入可能数据错位。是否继续?`);
      if (!ok) continue;
    }

    const cols = s.columns.length + 2;

    // 1. 清空数据区(第 1..MAX_ROWS-1 行)。sheet 共 MAX_ROWS 行(0..MAX_ROWS-1),
    //    从第 1 行起清 MAX_ROWS-1 行,endRow=399 不越界;第 0 行由下面 matrix 覆盖。
    const empty: unknown[][] = Array.from({ length: MAX_ROWS - 1 }, () => Array(cols).fill(null));
    sheet.getRange(1, 0, MAX_ROWS - 1, cols).setValues(empty);

    // 2. 写入 xlsx 内容(含表头 + 数据),裁剪到 MAX_ROWS 行
    const writeRows = Math.min(aoa.length, MAX_ROWS);
    const matrix: unknown[][] = [];
    for (let r = 0; r < writeRows; r++) {
      const row: unknown[] = [];
      for (let c = 0; c < cols; c++) {
        let v = aoa[r]?.[c] ?? null;
        if (v instanceof Date) v = toDateStr(v);
        row.push(v);
      }
      matrix.push(row);
    }
    sheet.getRange(0, 0, matrix.length, cols).setValues(matrix);
    imported++;
  }
  return imported;
}
