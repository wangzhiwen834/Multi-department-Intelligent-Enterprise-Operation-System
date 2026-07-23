// 初始化种子:足浴业务(品牌=静水楼台) + 4 家店 + 模板 v1
import 'dotenv/config';
import { pool } from '../src/db/pool.js';
import { FOOTBATH_BUSINESS_CODE, FOOTBATH_SHOPS, footbathTemplate } from '../src/template/footbath.template.js';
import { hashPassword } from '../src/auth/password.js';

async function main() {
  // business:品牌名=静水楼台(原 '足浴' 一次性改名;ON CONFLICT 仅在新建时生效,故单独 UPDATE 兜底)
  let b = (await pool.query("SELECT id FROM business WHERE code=$1", [FOOTBATH_BUSINESS_CODE])).rows[0];
  if (!b) {
    b = (await pool.query("INSERT INTO business (code,name) VALUES ($1,'静水楼台') RETURNING id", [FOOTBATH_BUSINESS_CODE])).rows[0];
  } else {
    await pool.query("UPDATE business SET name='静水楼台' WHERE code=$1", [FOOTBATH_BUSINESS_CODE]);
  }

  // 一次性数据迁移:剥离既有店名中的「静水楼台」前缀(历史种子/手录可能带前缀)。
  // 幂等:无前缀时 REPLACE 不变。同时清理可能残留的首尾空格。
  await pool.query(
    "UPDATE shop SET name = BTRIM(REPLACE(name, '静水楼台', '')) WHERE name LIKE '%静水楼台%'",
  );

  // 一次性数据迁移:把旧 5 店种子(江北/汉台/南郑/城固)收敛到当前 4 店命名。
  // 幂等:名字已是新值时 WHERE 不命中,无操作。仅按 name 匹配,与 id 无关。
  //   江北店 -> 竹园店 / 汉台店 -> 水调歌头店 / 南郑店 -> 吾悦店
  //   城固店 -> 软删(历史无数据则从列表移除,保留行)
  const remap: Array<[string, string]> = [
    ['江北店', '竹园店'],
    ['汉台店', '水调歌头店'],
    ['南郑店', '吾悦店'],
  ];
  for (const [from, to] of remap) {
    await pool.query('UPDATE shop SET name=$1 WHERE name=$2', [to, from]);
  }
  await pool.query("UPDATE shop SET status='deleted' WHERE name='城固店' AND status='active'");

  // shops:仅在该业务尚无任何门店时插入种子店(避免给已有门店的库重复插 4 家)。
  const hasShops = (await pool.query('SELECT 1 FROM shop WHERE business_id=$1 LIMIT 1', [b.id])).rows[0];
  if (!hasShops) {
    for (const s of FOOTBATH_SHOPS) {
      await pool.query(
        "INSERT INTO shop (business_id, code, name, monthly_target) VALUES ($1,$2,$3,150000) ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, monthly_target=EXCLUDED.monthly_target",
        [b.id, s.code, s.name],
      );
    }
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

  console.log('seed done: 静水楼台(足浴) + 4 shops + template v1 + 默认账号(boss/boss123 董事长, mgr/mgr123 经理)');
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
