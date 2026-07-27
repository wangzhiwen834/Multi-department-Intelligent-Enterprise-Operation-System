// 清理误建的重复 大河坎店(code=dahekan, shop 162, wb 259)+ 清空 shop1 旧 daily_metric 以便干净重抽
import 'dotenv/config';
import { pool, query } from '../src/db/pool.js';
(async () => {
  const before = (await query('SELECT count(*)::int n FROM daily_metric WHERE shop_id=1')).rows[0].n;
  console.log('shop1 daily_metric before:', before);
  await query('DELETE FROM daily_metric WHERE shop_id=1');
  await query('DELETE FROM daily_metric WHERE source_workbook_id=259');
  await query('DELETE FROM expense WHERE source_workbook_id IN (1,259)');
  await query('DELETE FROM workbook_snapshot WHERE workbook_id=259');
  await query('DELETE FROM workbook WHERE id=259');
  await query("DELETE FROM shop WHERE code='dahekan'");
  console.log('cleaned. footbath shops now:', JSON.stringify((await query('SELECT id,name,code FROM shop WHERE business_id=1 ORDER BY id')).rows));
  await pool.end();
})();
