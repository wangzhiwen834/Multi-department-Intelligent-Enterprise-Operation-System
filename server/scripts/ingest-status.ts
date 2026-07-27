// 摄入前置状态探查(只读):DB 连通 + 业务/门店/模板/工作簿/快照/daily_metric 现状
import 'dotenv/config';
import { pool, query } from '../src/db/pool.js';
(async () => {
  const q = async (sql: string) => (await query(sql)).rows;
  try {
    console.log('biz   ', JSON.stringify(await q('SELECT id,code,name FROM business ORDER BY id')));
    console.log('shops ', JSON.stringify(await q('SELECT id,business_id,name,status FROM shop ORDER BY id')));
    console.log('tpls  ', JSON.stringify(await q('SELECT business_id,version FROM template ORDER BY business_id,version')));
    console.log('wb    ', JSON.stringify(await q('SELECT id,shop_id,period,(deleted_at IS NULL) AS live FROM workbook ORDER BY id')));
    console.log('snaps ', JSON.stringify(await q('SELECT workbook_id FROM workbook_snapshot ORDER BY workbook_id')));
    console.log('dm    ', JSON.stringify(await q('SELECT count(*)::int n, count(distinct source_workbook_id)::int wb FROM daily_metric')));
  } catch (e) { console.error('FAIL:', (e as Error).message); process.exit(1); }
  await pool.end();
})();
