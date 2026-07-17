// 初始化种子:足浴业务 + 5 家店 + 模板 v1
import 'dotenv/config';
import { pool } from '../src/db/pool.js';
import { FOOTBATH_BUSINESS_CODE, FOOTBATH_SHOPS, footbathTemplate } from '../src/template/footbath.template.js';
import { hashPassword } from '../src/auth/password.js';

async function main() {
  // business
  let b = (await pool.query("SELECT id FROM business WHERE code=$1", [FOOTBATH_BUSINESS_CODE])).rows[0];
  if (!b) {
    b = (await pool.query("INSERT INTO business (code,name) VALUES ($1,'足浴') RETURNING id", [FOOTBATH_BUSINESS_CODE])).rows[0];
  }
  // shops
  for (const s of FOOTBATH_SHOPS) {
    await pool.query(
      "INSERT INTO shop (business_id, code, name, monthly_target) VALUES ($1,$2,$3,150000) ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, monthly_target=EXCLUDED.monthly_target",
      [b.id, s.code, s.name],
    );
  }
  // template v1
  const exists = (await pool.query("SELECT 1 FROM template WHERE business_id=$1 AND version=1", [b.id])).rows[0];
  if (!exists) {
    await pool.query("INSERT INTO template (business_id, version, definition) VALUES ($1,1,$2)", [b.id, JSON.stringify(footbathTemplate)]);
  }
  // 默认账号:董事长 boss/boss123,经理 mgr/mgr123(由董事长创建)
  const bossRow = (await pool.query(
    `INSERT INTO app_user (username,password_hash,name,role,department)
     VALUES ('boss',$1,'董事长','chairman',NULL)
     ON CONFLICT (username) DO NOTHING RETURNING id`,
    [await hashPassword('boss123')],
  )).rows[0];
  const bossId = bossRow?.id ?? (await pool.query("SELECT id FROM app_user WHERE username='boss'")).rows[0].id;
  await pool.query(
    `INSERT INTO app_user (username,password_hash,name,role,department,created_by)
     VALUES ('mgr',$1,'经理','manager','财务部',$2)
     ON CONFLICT (username) DO NOTHING`,
    [await hashPassword('mgr123'), bossId],
  );

  console.log('seed done: footbath + 5 shops + template v1 + 默认账号(boss/boss123 董事长, mgr/mgr123 经理)');
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
