// 酒店大屏处理器:按酒店指标 key 聚合。KPI hardcode(② 线性成本:加业态各写一个)。
import { query } from '../db/pool.js';
import { buildTrendSeries } from './dashboard.helpers.js';

export interface HotelParams {
  businessId: number;
  rangeStart: string; rangeEnd: string;
  trendStart: string; trendEnd: string; trendUnit: 'day' | 'month';
  shopId: number | null;
}

const num = (key: string, prefix = 'metrics') =>
  `CASE WHEN ${prefix}->>'${key}' ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (${prefix}->>'${key}')::numeric ELSE 0 END`;
// 日均:仅对有数据且非 0 的天求 AVG(CASE 返 NULL 则 AVG 忽略)
const avg = (key: string) =>
  `AVG(CASE WHEN metrics->>'${key}' ~ '^-?[0-9]+(\\.[0-9]+)?$' AND (metrics->>'${key}')::numeric <> 0 THEN (metrics->>'${key}')::numeric END)`;

const SUM_KEYS = ['hotel_revenue','daily_cash_total','room_revenue','breakfast_revenue','member_benefit','overnight_rooms','cleaned_rooms'];
const AVG_KEYS = ['adr','occupancy','revpar'];

export async function computeHotelOverview({ businessId, rangeStart, rangeEnd, trendStart, trendEnd, trendUnit, shopId }: HotelParams) {
  const rangeBiz = (start: string, end: string): { sql: string; params: unknown[] } =>
    shopId
      ? { sql: 'AND shop_id IN (SELECT id FROM shop WHERE business_id=$3) AND shop_id=$4', params: [start, end, businessId, shopId] }
      : { sql: 'AND shop_id IN (SELECT id FROM shop WHERE business_id=$3)', params: [start, end, businessId] };

  // 1. KPI(SUM + 日均,同一行)
  const k = rangeBiz(rangeStart, rangeEnd);
  const sumSelect = SUM_KEYS.map(key => `COALESCE(SUM(${num(key)}),0) AS ${key}`).join(',\n         ');
  const avgSelect = AVG_KEYS.map(key => `COALESCE(${avg(key)},0) AS ${key}`).join(',\n         ');
  const kpiRow = (await query(
    `SELECT ${sumSelect}, ${avgSelect} FROM daily_metric WHERE date BETWEEN $1 AND $2 ${k.sql}`,
    k.params,
  )).rows[0];

  // 2. 收入结构(各 key SUM)
  const revKeys = ['room_revenue','breakfast_revenue','guest_damage_revenue','member_benefit','other_revenue','offline_room_revenue'];
  const revSelect = revKeys.map(key => `COALESCE(SUM(${num(key)}),0) AS ${key}`).join(',\n         ');
  const revRow = (await query(`SELECT ${revSelect} FROM daily_metric WHERE date BETWEEN $1 AND $2 ${k.sql}`, k.params)).rows[0];

  // 3. 房型结构(各 key SUM)
  const roomKeys = ['big_bed_rooms','suite_rooms','family_rooms','superior_big_bed_rooms','business_big_bed_rooms','superior_twin_rooms','business_twin_rooms'];
  const roomSelect = roomKeys.map(key => `COALESCE(SUM(${num(key)}),0) AS ${key}`).join(',\n         ');
  const roomRow = (await query(`SELECT ${roomSelect} FROM daily_metric WHERE date BETWEEN $1 AND $2 ${k.sql}`, k.params)).rows[0];

  // 4. 渠道结构(各 key SUM)
  const chanKeys = ['meituan_rooms','ctrip_rooms','huazhu_rooms','selfuse_rooms','walkin_guests'];
  const chanSelect = chanKeys.map(key => `COALESCE(SUM(${num(key)}),0) AS ${key}`).join(',\n         ');
  const chanRow = (await query(`SELECT ${chanSelect} FROM daily_metric WHERE date BETWEEN $1 AND $2 ${k.sql}`, k.params)).rows[0];

  // 5. 费用科目 Top10
  const e = rangeBiz(rangeStart, rangeEnd);
  const expenseBySubject = (await query(
    `SELECT COALESCE(NULLIF(subject,''),'(未分类)') AS subject, SUM(amount)::numeric AS amount
     FROM expense WHERE pay_date BETWEEN $1 AND $2 ${e.sql}
     GROUP BY COALESCE(NULLIF(subject,''),'(未分类)') ORDER BY amount DESC LIMIT 10`,
    e.params,
  )).rows.map((r: any) => ({ subject: r.subject, amount: Number(r.amount) }));

  // 6. 门店排名(按 hotel_revenue)
  const shopRanking = (await query(
    `SELECT s.id, s.name,
       COALESCE(SUM(${num('hotel_revenue', 'd.metrics')}),0) AS revenue
     FROM shop s LEFT JOIN daily_metric d ON d.shop_id=s.id AND d.date BETWEEN $1 AND $2
     WHERE s.status='active' AND s.business_id=$3
     GROUP BY s.id, s.name ORDER BY revenue DESC, s.name ASC`,
    [rangeStart, rangeEnd, businessId],
  )).rows.map((r: any) => ({ shopId: r.id, shopName: r.name, revenue: Number(r.revenue) }));

  // 7. 营收趋势(按 hotel_revenue)
  const tParams: unknown[] = shopId ? [trendUnit, trendStart, trendEnd, businessId, shopId] : [trendUnit, trendStart, trendEnd, businessId];
  const tSql = shopId
    ? 'AND shop_id IN (SELECT id FROM shop WHERE business_id=$4) AND shop_id=$5'
    : 'AND shop_id IN (SELECT id FROM shop WHERE business_id=$4)';
  const trendRows = (await query(
    `SELECT to_char(date_trunc($1, date), 'YYYY-MM-DD') AS bucket,
       COALESCE(SUM(${num('hotel_revenue')}),0) AS revenue
     FROM daily_metric WHERE date BETWEEN $2 AND $3 ${tSql}
     GROUP BY bucket ORDER BY bucket`,
    tParams,
  )).rows;
  const revenueTrend = buildTrendSeries(trendStart, trendEnd, trendUnit, trendRows as { bucket: string; revenue: string | number }[]);

  return {
    kpis: {
      hotelRevenue: Number(kpiRow.hotel_revenue),
      dailyCashTotal: Number(kpiRow.daily_cash_total),
      roomRevenue: Number(kpiRow.room_revenue),
      breakfastRevenue: Number(kpiRow.breakfast_revenue),
      memberBenefit: Number(kpiRow.member_benefit),
      overnightRooms: Number(kpiRow.overnight_rooms),
      cleanedRooms: Number(kpiRow.cleaned_rooms),
      adr: Number(Number(kpiRow.adr).toFixed(2)),
      occupancy: Number(Number(kpiRow.occupancy).toFixed(4)),
      revpar: Number(Number(kpiRow.revpar).toFixed(2)),
    },
    revenueTrend,
    revenueStructure: {
      room: Number(revRow.room_revenue), breakfast: Number(revRow.breakfast_revenue),
      guestDamage: Number(revRow.guest_damage_revenue), member: Number(revRow.member_benefit),
      other: Number(revRow.other_revenue), offlineRoom: Number(revRow.offline_room_revenue),
    },
    roomTypeStructure: {
      bigBed: Number(roomRow.big_bed_rooms), suite: Number(roomRow.suite_rooms), family: Number(roomRow.family_rooms),
      superiorBigBed: Number(roomRow.superior_big_bed_rooms), businessBigBed: Number(roomRow.business_big_bed_rooms),
      superiorTwin: Number(roomRow.superior_twin_rooms), businessTwin: Number(roomRow.business_twin_rooms),
    },
    channelStructure: {
      meituan: Number(chanRow.meituan_rooms), ctrip: Number(chanRow.ctrip_rooms), huazhu: Number(chanRow.huazhu_rooms),
      selfuse: Number(chanRow.selfuse_rooms), walkin: Number(chanRow.walkin_guests),
    },
    expenseBySubject,
    shopRanking,
  };
}
