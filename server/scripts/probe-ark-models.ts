// 探测火山方舟 Ark 是否支持 GET /models 列模型。只读,用 .env 的 DOUBAO_API_KEY。
import 'dotenv/config';
import { config } from '../src/config.js';

async function main() {
  const url = `${config.doubaoBaseUrl}/models`;
  const log = (...a: unknown[]) => process.stderr.write(a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ') + '\n');
  log('GET', url);
  log('key 前 8 位:', (config.doubaoApiKey || '').slice(0, 8) + '…');
  try {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${config.doubaoApiKey}` } });
    log('status:', r.status, r.statusText);
    const text = await r.text();
    log('body(前 3000 字):', text.slice(0, 3000));
    // 尝试解析出 model id 列表
    try {
      const j = JSON.parse(text);
      const all = (j.data || j.models || []) as any[];
      log('\n总模型数:', all.length);
      const byStatus: Record<string, number> = {};
      for (const m of all) byStatus[m.status] = (byStatus[m.status] || 0) + 1;
      log('按 status 分布:', byStatus);
      const usable = all.filter(m => m.status !== 'Shutdown' && m.status !== 'Retiring');
      log('\n可用(非 Shutdown/Retiring)模型', usable.length, '个:');
      for (const m of usable) log(`  ${m.id}  [${m.status}]  ${m.task_type ? JSON.stringify(m.task_type) : ''}`);
      // 当前在用的两个是否在列表
      const ids = all.map(m => m.id);
      log('\n当前 chat/extract 模型 doubao-seed-2-1-pro-260628 在列表?', ids.includes('doubao-seed-2-1-pro-260628'));
      log('当前 poster 模型 doubao-seedream-4-0-250828 在列表?', ids.includes('doubao-seedream-4-0-250828'));
    } catch { /* 非 JSON */ }
  } catch (e: any) {
    log('请求失败:', e.message);
  }
}
main();
