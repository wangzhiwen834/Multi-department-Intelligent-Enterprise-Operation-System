// 初始化种子:足浴业务 + 5 家店 + 模板 v1
import 'dotenv/config';
import { pool } from '../src/db/pool.js';
import { FOOTBATH_BUSINESS_CODE, FOOTBATH_SHOPS, footbathTemplate } from '../src/template/footbath.template.js';

async function main() {
  // business
  let b = (await pool.query("SELECT id FROM business WHERE code=$1", [FOOTBATH_BUSINESS_CODE])).rows[0];
  if (!b) {
    b = (await pool.query("INSERT INTO business (code,name) VALUES ($1,'足浴') RETURNING id", [FOOTBATH_BUSINESS_CODE])).rows[0];
  }
  // shops
  for (const s of FOOTBATH_SHOPS) {
    await pool.query(
      "INSERT INTO shop (business_id, code, name) VALUES ($1,$2,$3) ON CONFLICT (code) DO NOTHING",
      [b.id, s.code, s.name],
    );
  }
  // template v1
  const exists = (await pool.query("SELECT 1 FROM template WHERE business_id=$1 AND version=1", [b.id])).rows[0];
  if (!exists) {
    await pool.query("INSERT INTO template (business_id, version, definition) VALUES ($1,1,$2)", [b.id, JSON.stringify(footbathTemplate)]);
  }
  console.log('seed done: footbath business + 5 shops + template v1');
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
