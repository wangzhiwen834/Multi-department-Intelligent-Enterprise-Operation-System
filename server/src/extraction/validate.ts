// 共享校验/清洗工具:位置式 sync(报错用 typeCheck)与 AI 抽取(coerceMetric 清洗+强转)复用。
// 抽自原 sync.service.ts 的 isEmpty/isValidDate/typeCheck,新增 coerceMetric 供 AI 抽取用。

export const isEmpty = (v: unknown): boolean =>
  v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

export const isValidDate = (v: unknown): boolean =>
  typeof v === 'string' && /^\d{4}[-/]\d{2}[-/]\d{2}$/.test(v.trim());

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
