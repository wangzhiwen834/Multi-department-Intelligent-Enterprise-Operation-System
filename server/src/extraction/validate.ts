// 共享校验/清洗工具:位置式 sync(报错用 typeCheck)与 AI 抽取(coerceMetric 清洗+强转)复用。
// 抽自原 sync.service.ts 的 isEmpty/isValidDate/typeCheck,新增 coerceMetric 供 AI 抽取用。

export const isEmpty = (v: unknown): boolean =>
  v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

export const isValidDate = (v: unknown): boolean =>
  typeof v === 'string' && /^\d{4}[-/]\d{2}[-/]\d{2}$/.test(v.trim());

// 宽松日期解析+归一化:接受 YYYY-M-D / YYYY/M/D(月日 1-2 位)、Excel 数字序列号暂不支持。
// 返回 YYYY-MM-DD 或 null(无法解析)。供 AI 抽取用(LLM 常回 2026/7/1 这类)。
export const normalizeDate = (v: unknown): string | null => {
  if (v == null) return null;
  const m = String(v).trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const mm = mo.padStart(2, '0'), dd = d.padStart(2, '0');
  const iso = `${y}-${mm}-${dd}`;
  // 校验真实日历日(防 2026-13-45)
  const dt = new Date(`${iso}T00:00:00Z`);
  if (isNaN(dt.getTime())) return null;
  if (dt.getUTCFullYear() !== Number(y) || dt.getUTCMonth() + 1 !== Number(mo) || dt.getUTCDate() !== Number(d)) return null;
  return iso;
};

// 类型校验(仅判定,不改值)。sync 用它收集校验错误。
export const typeCheck = (type: string, val: unknown): boolean => {
  if (isEmpty(val)) return true;
  switch (type) {
    case 'number': return typeof val === 'number' || (typeof val === 'string' && !isNaN(Number(val)));
    case 'int': return Number.isInteger(Number(val));
    case 'date': return typeof val === 'string' || val instanceof Date;
    default: return true; // text
  }
};

// 清洗数值(去 ¥ ￥ , ， 空格等)并强转。AI 抽取用:LLM 可能回 "¥1,234" 之类。
// 空值 -> {ok, value:undefined}(调用方据此不写该键)。
// 非法 -> {ok:false, error}。合法 -> {ok, value}。
export type CoerceResult = { ok: true; value: unknown } | { ok: false; error: string };
export const coerceMetric = (type: string, val: unknown): CoerceResult => {
  if (isEmpty(val)) return { ok: true, value: undefined };
  if (type === 'number' || type === 'int') {
    const cleaned = String(val).replace(/[¥￥,，\s]/g, '').trim();
    if (cleaned === '' || cleaned === '-') return { ok: true, value: undefined };
    const n = Number(cleaned);
    if (isNaN(n)) return { ok: false, error: `类型错误(${type})` };
    return { ok: true, value: type === 'int' ? Math.trunc(n) : n };
  }
  if (type === 'date') {
    return isValidDate(val) ? { ok: true, value: String(val).trim().slice(0, 10) } : { ok: false, error: '日期格式错误' };
  }
  return { ok: true, value: String(val) }; // text
};
