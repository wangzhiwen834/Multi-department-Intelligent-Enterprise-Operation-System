// 导出 16 天真实 daily_metric 供绘图(非可视化数据转换,不涉图形设备)
import 'dotenv/config';
import { pool, query } from '../src/db/pool.js';
import { writeFileSync } from 'fs';
(async () => {
  const rows = (await query("SELECT to_char(date,'YYYY-MM-DD') AS date, metrics FROM daily_metric WHERE shop_id=1 ORDER BY date")).rows;
  writeFileSync('../docs/fig2-data.json', JSON.stringify(rows));
  console.log('wrote', rows.length, 'rows -> docs/fig2-data.json');
  console.log('dates:', rows.map((r:any)=>r.date).join(', '));
  console.log('metric keys:', Object.keys(rows[0].metrics || {}).join(', '));
  await pool.end();
})();
