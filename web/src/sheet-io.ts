import ExcelJS from 'exceljs';
import type { TemplateDef } from './types';

// 工作表最大行数(与 buildFromTemplate 的 rowCount 一致)
const MAX_ROWS = 400;

// ---------- 颜色 / 单位换算 ----------
// Univer '#RRGGBB' -> exceljs 'FFRRGGBB'(加 FF alpha)。兼容 rgb(r,g,b) / RRGGBB / #AARRGGBB 等多种格式
const rgbToArgb = (rgb?: string): string | undefined => {
  if (!rgb) return undefined;
  const s = rgb.trim();
  const m1 = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m1) {
    const hex = (n: string | number) => Number(n).toString(16).padStart(2, '0');
    return `FF${hex(m1[1])}${hex(m1[2])}${hex(m1[3])}`.toUpperCase();
  }
  const h = s.replace(/^#/, '');
  if (/^[0-9a-fA-F]{6}$/.test(h)) return `FF${h.toUpperCase()}`;
  if (/^[0-9a-fA-F]{8}$/.test(h)) return h.toUpperCase();
  return undefined;
};
// exceljs 'FFRRGGBB' / 'RRGGBB' -> Univer '#RRGGBB'
const argbToRgb = (argb?: string): string | undefined => {
  if (!argb) return undefined;
  const m = argb.match(/[0-9a-fA-F]{6}$/);
  return m ? `#${m[0].toLowerCase()}` : undefined;
};

// Univer BorderStyleTypes(数字) <-> exceljs border style(字符串)
const BORDER_TO_EXCEL: Record<number, string> = {
  1: 'thin', 2: 'hair', 3: 'dotted', 4: 'dashed', 5: 'dashDot', 6: 'dashDotDot',
  7: 'double', 8: 'medium', 9: 'mediumDashed', 10: 'mediumDashDot', 11: 'mediumDashDotDot',
  12: 'slantDashDot', 13: 'thick',
};
const BORDER_FROM_EXCEL: Record<string, number> = Object.fromEntries(
  Object.entries(BORDER_TO_EXCEL).map(([k, v]) => [v, Number(k)])
);
const HT_TO_EXCEL: Record<number, string> = { 1: 'left', 2: 'center', 3: 'right', 4: 'justify', 6: 'distributed' };
const VT_TO_EXCEL: Record<number, string> = { 1: 'top', 2: 'middle', 3: 'bottom' };
const HT_FROM_EXCEL: Record<string, number> = { left: 1, center: 2, right: 3, justify: 4, distributed: 6 };
const VT_FROM_EXCEL: Record<string, number> = { top: 1, middle: 2, bottom: 3 };

// Univer 像素 <-> exceljs 字符宽度 / points
const pxToExcelWidth = (px: number) => Math.max(8, Math.round((px - 5) / 7));
const pxToPt = (px: number) => Math.round(px / 1.333);
const excelWidthToPx = (w: number) => Math.round(w * 7 + 5);
const ptToPx = (pt: number) => Math.round(pt * 1.333);

// ---------- 导出:Univer snapshot -> exceljs(带样式) ----------
function applyStyleToCell(cell: ExcelJS.Cell, st: any) {
  if (!st) return;
  const font: any = {};
  if (st.bl === 1) font.bold = true;
  if (st.it === 1) font.italic = true;
  if (st.ul && st.ul.s === 1) font.underline = 'single';
  if (st.st && st.st.s === 1) font.strike = true;
  if (st.fs != null) font.size = st.fs;
  if (st.ff) font.name = st.ff;
  const fc = rgbToArgb(st.cl?.rgb);
  if (fc) font.color = { argb: fc };
  if (Object.keys(font).length) cell.font = font;

  const bg = rgbToArgb(st.bg?.rgb);
  if (bg) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg }, bgColor: { argb: bg } };

  const alignment: any = {};
  if (HT_TO_EXCEL[st.ht]) alignment.horizontal = HT_TO_EXCEL[st.ht];
  if (VT_TO_EXCEL[st.vt]) alignment.vertical = VT_TO_EXCEL[st.vt];
  if (st.tb === 3) alignment.wrapText = true;
  if (st.tr && typeof st.tr === 'object' && st.tr.a != null) alignment.textRotation = st.tr.a;
  if (Object.keys(alignment).length) cell.alignment = alignment;

  if (st.bd) {
    const border: any = {};
    const sides: [string, string][] = [['t', 'top'], ['b', 'bottom'], ['l', 'left'], ['r', 'right']];
    for (const [k, side] of sides) {
      const b = st.bd[k];
      if (b && b.s) {
        border[side] = { style: BORDER_TO_EXCEL[b.s] || 'thin', color: { argb: rgbToArgb(b.cl?.rgb) || 'FF000000' } };
      }
    }
    if (Object.keys(border).length) cell.border = border;
  }

  if (st.n && st.n.pattern) cell.numFmt = st.n.pattern;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// 导出整个工作簿(含样式)为 .xlsx 并下载。用 fwb.save() 拿完整快照,解析后写 exceljs。
export async function exportWorkbookToXlsx(fwb: any, filename: string): Promise<void> {
  const snapshot = fwb.save();
  // DEBUG:排查颜色/样式字段(临时,定位背景色等导出问题)
  {
    const _st = snapshot.styles || {};
    console.log('[导出调试] styles keys:', Object.keys(_st));
    const _k = Object.keys(_st)[0];
    if (_k) console.log('[导出调试] sample style:', JSON.stringify(_st[_k]));
    outer: for (const _sid of (snapshot.sheetOrder || Object.keys(snapshot.sheets || {}))) {
      const _cd = snapshot.sheets[_sid]?.cellData || {};
      for (const _r in _cd) for (const _c in _cd[_r]) {
        if (_cd[_r][_c]?.s) { console.log('[导出调试] sample cell.s:', JSON.stringify(_cd[_r][_c].s), '(type:', typeof _cd[_r][_c].s + ')'); break outer; }
      }
    }
  }
  const wb = new ExcelJS.Workbook();
  const order: string[] = snapshot.sheetOrder || Object.keys(snapshot.sheets || {});
  for (const sheetId of order) {
    const wsData = snapshot.sheets[sheetId];
    if (!wsData) continue;
    const ws = wb.addWorksheet(wsData.name || sheetId);
    const styles = snapshot.styles || {};
    const cellData = wsData.cellData || {};
    for (const r in cellData) {
      for (const c in cellData[r]) {
        const cell = cellData[r][c];
        const exCell = ws.getCell(Number(r) + 1, Number(c) + 1);
        exCell.value = cell.v ?? null;
        const st = typeof cell.s === 'string' ? styles[cell.s] : cell.s;
        if (st) applyStyleToCell(exCell, st);
      }
    }
    for (const m of wsData.mergeData || []) {
      try { ws.mergeCells(m.startRow + 1, m.startColumn + 1, m.endRow + 1, m.endColumn + 1); } catch { /* ignore overlap */ }
    }
    const colData = wsData.columnData || {};
    for (const c in colData) {
      const w = colData[c].w;
      if (w) ws.getColumn(Number(c) + 1).width = pxToExcelWidth(w);
    }
    const rowData = wsData.rowData || {};
    for (const r in rowData) {
      const h = rowData[r].h;
      if (h) ws.getRow(Number(r) + 1).height = pxToPt(h);
    }
  }
  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(new Blob([buf as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
}

// ---------- 导入:exceljs -> Univer IWorkbookData snapshot ----------
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
  if (fill && fill.type === 'pattern' && fill.fgColor?.argb) {
    const rgb = argbToRgb(fill.fgColor.argb);
    if (rgb) st.bg = { rgb };
  }
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
    const sides: [string, string][] = [['top', 't'], ['bottom', 'b'], ['left', 'l'], ['right', 'r']];
    for (const [side, k] of sides) {
      const b = border[side];
      if (b && b.style) {
        bd[k] = { s: BORDER_FROM_EXCEL[b.style] ?? 1, cl: { rgb: argbToRgb(b.color?.argb) || '#000000' } };
      }
    }
    if (Object.keys(bd).length) st.bd = bd;
  }
  if (cell.numFmt) st.n = { pattern: cell.numFmt };
  return Object.keys(st).length ? st : null;
}

function toUniverValue(v: any): any {
  if (v == null) return null;
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (v && typeof v === 'object' && Array.isArray(v.richText)) {
    return v.richText.map((rt: any) => rt.text || '').join('');
  }
  if (v && typeof v === 'object' && 'result' in v) {
    return v.result; // 公式取结果值
  }
  return v;
}

function colLetterToNum(letters: string): number {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}
function parseRange(s: string): { startRow: number; endRow: number; startColumn: number; endColumn: number } | null {
  const m = String(s).match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
  if (!m) return null;
  return {
    startColumn: colLetterToNum(m[1]) - 1, endColumn: colLetterToNum(m[3]) - 1,
    startRow: Number(m[2]) - 1, endRow: Number(m[4]) - 1,
  };
}

// 导入 .xlsx,构建并返回 Univer IWorkbookData snapshot(含样式)。由调用方 createWorkbook 重建工作簿。
// 表头与模板不符时弹确认警告(避免列错位)。
export async function importXlsxToWorkbook(data: ArrayBuffer, template: TemplateDef, title: string): Promise<any> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data);

  const stylesMap = new Map<string, string>();
  const styles: Record<string, any> = {};
  let styleIdx = 0;
  const getStyleId = (st: any | null): string | undefined => {
    if (!st) return undefined;
    const key = JSON.stringify(st);
    let id = stylesMap.get(key);
    if (!id) { id = String(styleIdx++); styles[id] = st; stylesMap.set(key, id); }
    return id;
  };

  const sheets: Record<string, any> = {};
  const sheetOrder: string[] = [];
  for (const s of template.sheets) {
    const exWs = wb.getWorksheet(s.label);
    const sheetId = s.key;
    sheetOrder.push(sheetId);
    const cols = s.columns.length + 2;
    const cellData: any = {};
    const mergeData: any[] = [];
    const columnData: any = {};
    const rowData: any = {};

    if (exWs) {
      // 表头校验:第 0 行应与模板列名一致
      const expectedHeader = s.columns.map(c => c.label);
      let mismatch = false;
      for (let i = 0; i < s.columns.length; i++) {
        const v = exWs.getCell(1, i + 1).value;
        if (String(v ?? '').trim() !== expectedHeader[i]) { mismatch = true; break; }
      }
      if (mismatch) {
        const ok = confirm(`「${s.label}」表头与模板不符,继续可能数据错位。是否继续?`);
        if (!ok) {
          sheets[sheetId] = { id: sheetId, name: s.label, rowCount: MAX_ROWS, columnCount: cols, cellData: {}, mergeData: [], columnData: {}, rowData: {} };
          continue;
        }
      }

      exWs.eachRow((row, rowNum) => {
        const r = rowNum - 1;
        if (r >= MAX_ROWS) return;
        row.eachCell({ includeEmpty: false }, (cell, colNum) => {
          const c = colNum - 1;
          if (c >= cols) return;
          const st = excelStyleToUniver(cell);
          const cellObj: any = { v: toUniverValue(cell.value) };
          const sid = getStyleId(st);
          if (sid) cellObj.s = sid;
          if (!cellData[r]) cellData[r] = {};
          cellData[r][c] = cellObj;
        });
        if (row.height) rowData[r] = { h: ptToPx(row.height) };
      });
      for (let i = 0; i < cols; i++) {
        const col = exWs.getColumn(i + 1);
        if (col && col.width) columnData[i] = { w: excelWidthToPx(col.width) };
      }
      const merges: string[] = (exWs as any).model?.merges || [];
      for (const m of merges) {
        const range = parseRange(m);
        if (range) mergeData.push(range);
      }
    }
    sheets[sheetId] = { id: sheetId, name: s.label, rowCount: MAX_ROWS, columnCount: cols, cellData, mergeData, columnData, rowData };
  }
  return { name: title, styles, sheets, sheetOrder };
}
