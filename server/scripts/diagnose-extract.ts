// 诊断 AI 抽取:读 dev 库真实快照 -> parseTransposed 直接验证 + extractWorkbook 全流程。会写 daily_metric(幂等)。
// 用法:npx tsx scripts/diagnose-extract.ts [wbId]
import 'dotenv/config';
import { pool, query } from '../src/db/pool.js';
import { extractWorkbook, parseTransposed } from '../src/extraction/extraction.service.js';

const log = (...a: unknown[]) => process.stderr.write(a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ') + '\n');

async function main() {
  const wbId = Number(process.argv[2]) || (await query(
    `SELECT w.id FROM workbook w JOIN workbook_snapshot s ON s.workbook_id=w.id WHERE w.deleted_at IS NULL ORDER BY w.id LIMIT 1`,
  )).rows[0]?.id;
  if (!wbId) { log('DB 里无工作簿快照'); await pool.end(); return; }

  const wb = (await query<{ shop_id: number }>('SELECT shop_id FROM workbook WHERE id=$1', [wbId])).rows[0];
  const shopBiz = (await query<{ bid: number }>('SELECT s.business_id AS bid FROM shop s WHERE s.id=$1', [wb.shop_id])).rows[0];
  const tplRow = (await query<{ definition: any }>('SELECT definition FROM template WHERE business_id=$1 ORDER BY version DESC LIMIT 1', [shopBiz.bid])).rows[0];
  const snap = (await query<{ data: any }>('SELECT data FROM workbook_snapshot WHERE workbook_id=$1', [wbId])).rows[0];
  log(`wbId=${wbId} shop_id=${wb.shop_id}`);
  const dailyOpsTpl = (tplRow.definition.sheets as any[]).find(s => s.key === 'daily_ops');
  const sheet = snap.data?.sheets?.daily_ops;

  log('\n=== parseTransposed 直接验证 ===');
  const parsed = parseTransposed(sheet, dailyOpsTpl);
  log(`解析出 ${parsed.rows.length} 个日期,${parsed.errors.length} 项错误`);
  for (const r of parsed.rows.slice(0, 3)) {
    log(`  ${r.date}:`, Object.keys(r.metrics).join(','), '示例 revenue=', r.metrics.revenue, 'customers_total=', r.metrics.customers_total);
  }
  if (parsed.errors.length) log('errors:', parsed.errors.slice(0, 5));

  log('\n=== extractWorkbook 全流程(会写 daily_metric)===');
  const result = await extractWorkbook(wbId, { source: 'manual', userId: null, onProgress: e => log('  [progress]', JSON.stringify(e)) });
  log('结果:', JSON.stringify(result, null, 2));

  // 抽查 daily_metric
  const dm = (await query('SELECT date, metrics FROM daily_metric WHERE source_workbook_id=$1 ORDER BY date LIMIT 3', [wbId])).rows;
  log('\n=== daily_metric 抽查 ===');
  for (const d of dm) log(`  ${d.date}:`, JSON.stringify(d.metrics));

  await pool.end();
}

main().catch(e => { log('FAIL:', e); process.exit(1); });
