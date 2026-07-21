import { createUniver, defaultTheme, LocaleType } from '@univerjs/presets';
import type { FUniver, Univer } from '@univerjs/presets';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import UniverPresetSheetsCoreZhCN from '@univerjs/preset-sheets-core/locales/zh-CN';
import type { TemplateDef } from './types';

export interface UniverHandle {
  univerAPI: FUniver;
  dispose: () => void;
}

export function setupUniver(container: HTMLElement): UniverHandle {
  const { univer, univerAPI } = createUniver({
    locale: LocaleType.ZH_CN,
    locales: { zhCN: UniverPresetSheetsCoreZhCN },
    theme: defaultTheme,
    presets: [UniverSheetsCorePreset({ container })],
  });
  return { univerAPI, dispose: () => univer.dispose() };
}

// 从模板构建初始工作簿(每张录入表:第0行=列名表头,下方=数据;v1 统一行式布局)
export function buildFromTemplate(api: FUniver, template: TemplateDef, title: string): any {
  const sheets: Record<string, { id: string; name: string; rowCount: number; columnCount: number }> = {};
  template.sheets.forEach(s => {
    sheets[s.key] = { id: s.key, name: s.label, rowCount: 400, columnCount: s.columns.length + 2 };
  });
  const wb = api.createWorkbook({ name: title, sheets } as any);
  template.sheets.forEach(s => {
    // 优先按 sheetId(=模板 key,建表时 id 即 s.key;重命名只改 name 不改 id,故跨重命名稳定)
    // 回退按表名:兼容旧快照或删表后同名重建
    const sheet = wb.getSheetBySheetId(s.key) ?? wb.getSheetByName(s.label);
    if (!sheet) return;
    s.columns.forEach((c, ci) => {
      sheet.getRange(0, ci).setValue(c.label);
    });
  });
  return wb;
}

// 按需加载:把快照里某表的稀疏 cellData(带 style id)注入到已创建的工作表。
// 反解 style id -> 内联样式,确保 setValues 能正确套用样式(styles 为 bootstrap 全量返回的全局样式表)。
export function injectSheetCellData(sheet: any, cellData: any, styles: Record<string, any>) {
  const matrix: Record<string, Record<string, any>> = {};
  const rows = Object.keys(cellData || {});
  let maxR = 1, maxC = 1;
  for (const r of rows) {
    matrix[r] = {};
    const cols = Object.keys(cellData[r]);
    for (const c of cols) {
      const cell = cellData[r][c];
      const s = typeof cell.s === 'string' ? styles[cell.s] : cell.s;
      matrix[r][c] = s ? { ...cell, s } : { ...cell };
      maxR = Math.max(maxR, Number(r) + 1);
      maxC = Math.max(maxC, Number(c) + 1);
    }
  }
  sheet.getRange(0, 0, maxR, maxC).setValues(matrix);
}
