// 日期粒度区间计算 - 纯日期数学(无 IO,无 Date.now),便于单元测试。
// 语义对齐设计规格 §3:day/week/month/year 的 KPI 区间与趋势下钻窗口。

export type Granularity = 'day' | 'week' | 'month' | 'year';

export interface DateRange {
  rangeStart: string;   // YYYY-MM-DD,KPI/结构/费用/排名区间起
  rangeEnd: string;     // YYYY-MM-DD,区间止
  trendStart: string;   // YYYY-MM-DD,趋势查询起
  trendEnd: string;     // YYYY-MM-DD,趋势查询止
  trendUnit: 'day' | 'month'; // date_trunc 单位
}

const pad = (n: number) => String(n).padStart(2, '0');

const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const parseISO = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

// 校验 YYYY-MM-DD 是否为真实日历日(防止 2026-13-45 之类的非法值)
export const isValidYmd = (s: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
};

/**
 * 按 granularity + 锚点日 计算区间与趋势窗口。
 * week 用 ISO 周(周一起):周一 = date - ((getDay()+6)%7) 天,等价 date_trunc('week', date)。
 */
export function computeRange(granularity: Granularity, dateStr: string): DateRange {
  const anchor = parseISO(dateStr);

  if (granularity === 'day') {
    // 单天无内部细粒度,趋势用前 14 天 trailing 提供上下文
    const trendStart = new Date(anchor);
    trendStart.setDate(anchor.getDate() - 13);
    return {
      rangeStart: toISO(anchor),
      rangeEnd: toISO(anchor),
      trendStart: toISO(trendStart),
      trendEnd: toISO(anchor),
      trendUnit: 'day',
    };
  }

  if (granularity === 'week') {
    const dayOfWeek = anchor.getDay(); // JS: 周日=0..周六=6
    const monday = new Date(anchor);
    monday.setDate(anchor.getDate() - ((dayOfWeek + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      rangeStart: toISO(monday),
      rangeEnd: toISO(sunday),
      trendStart: toISO(monday),
      trendEnd: toISO(sunday),
      trendUnit: 'day',
    };
  }

  if (granularity === 'month') {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0); // 下月 0 号 = 本月末日
    return {
      rangeStart: toISO(first),
      rangeEnd: toISO(last),
      trendStart: toISO(first),
      trendEnd: toISO(last),
      trendUnit: 'day',
    };
  }

  // year
  const jan1 = new Date(anchor.getFullYear(), 0, 1);
  const dec31 = new Date(anchor.getFullYear(), 11, 31);
  return {
    rangeStart: toISO(jan1),
    rangeEnd: toISO(dec31),
    trendStart: toISO(jan1),
    trendEnd: toISO(dec31),
    trendUnit: 'month',
  };
}

/**
 * 趋势桶标签:date_trunc 返回的 bucket(Date)映射成显示标签。
 * day/week/month 粒度 -> 'MM-DD';year 粒度(按月桶) -> 'M月'。
 */
export function formatBucketLabel(bucket: Date, unit: 'day' | 'month'): string {
  if (unit === 'month') return `${bucket.getMonth() + 1}月`;
  return `${pad(bucket.getMonth() + 1)}-${pad(bucket.getDate())}`;
}

/**
 * 构造完整且 0 填充的趋势序列(规格 §2:固定长度 trend)。
 * SQL 的 `GROUP BY date_trunc(...)` 只返回有数据行的桶,无法表达空桶,
 * 故在此用 trendStart/trendEnd/trendUnit 生成完整桶序列,缺失桶 revenue=0。
 *
 * - trendUnit='day':trendStart~trendEnd 每日一个点(label 'MM-DD')
 *   -> day 粒度 14 点 / week 粒度 7 点 / month 粒度 当月天数
 * - trendUnit='month':trendStart~trendEnd 每月首日一个点(label 'M月')
 *   -> year 粒度 12 点
 *
 * bucket key 为 'YYYY-MM-DD',与 SQL `to_char(date_trunc(unit, date), 'YYYY-MM-DD')` 对齐:
 * 'day' 桶 = 当日, 'month' 桶 = 月首 'YYYY-MM-01'。顺序升序。
 */
export function buildTrendSeries(
  trendStart: string,
  trendEnd: string,
  trendUnit: 'day' | 'month',
  rows: ReadonlyArray<{ bucket: string; revenue: number | string }>,
): { label: string; revenue: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.bucket, Number(r.revenue));

  const lookup = (key: string): number => (map.has(key) ? (map.get(key) as number) : 0);
  const out: { label: string; revenue: number }[] = [];

  if (trendUnit === 'month') {
    // 逐月推进:trendStart/trendEnd 均为月首(年由 computeRange 给出 jan1/dec31)
    const [sy, sm] = trendStart.split('-').map(Number);
    const [ey, em] = trendEnd.split('-').map(Number);
    let y = sy;
    let m = sm;
    while (y < ey || (y === ey && m <= em)) {
      const dt = new Date(y, m - 1, 1);
      const key = `${y}-${pad(m)}-01`;
      out.push({ label: formatBucketLabel(dt, 'month'), revenue: lookup(key) });
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
  } else {
    // 逐日推进:trendStart~trendEnd 含端点
    const cur = parseISO(trendStart);
    const end = parseISO(trendEnd);
    while (cur <= end) {
      const key = toISO(cur);
      out.push({ label: formatBucketLabel(new Date(cur), 'day'), revenue: lookup(key) });
      cur.setDate(cur.getDate() + 1);
    }
  }
  return out;
}
