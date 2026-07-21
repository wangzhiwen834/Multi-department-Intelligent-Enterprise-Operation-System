// 定时抽取调度(node-cron 进程内,单实例)。test 环境不启动。
import cron from 'node-cron';
import { config } from '../config.js';
import { query } from '../db/pool.js';
import { extractWorkbook, type ExtractResult } from './extraction.service.js';

export interface DueCandidate { id: number; updated_at: string | null; last_extracted_at: string | null }

// 纯函数:从候选工作簿筛出需要抽取的(从未抽取 OR 上次抽取后有更新)。可单测。
export function selectDueWorkbooks(workbooks: DueCandidate[]): number[] {
  return workbooks
    .filter(w => !w.last_extracted_at || !w.updated_at || w.updated_at > w.last_extracted_at)
    .map(w => w.id);
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`抽取超时 ${ms}ms`)), ms)),
  ]);
}

function periodOf(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${m}`;
}

// 定时抽取:当期未软删工作簿,经 selectDueWorkbooks 筛"需抽取"的,单并发逐个跑,失败/超时不阻塞下一个。
export async function runScheduledExtraction(): Promise<void> {
  const period = periodOf(new Date());
  const { rows } = await query<DueCandidate>(
    `SELECT id, updated_at, last_extracted_at FROM workbook
     WHERE period=$1 AND deleted_at IS NULL`, [period]);
  const due = selectDueWorkbooks(rows);
  for (const id of due) {
    try {
      const r: ExtractResult = await withTimeout(extractWorkbook(id, { source: 'scheduled', userId: null }), config.extractTimeoutMs);
      if (!r.ok) console.error('[extraction] scheduled wb=%s:', id, r.error || 'failed');
    } catch (e: any) {
      console.error('[extraction] scheduled wb=%s:', id, e.message);
    }
  }
}

// 进程启动时调。test 环境直接 return(不注册 cron,避免测试触发真实 LLM)。
export function startScheduler(): void {
  if (process.env.NODE_ENV === 'test') return;
  cron.schedule(config.extractCron, () => {
    runScheduledExtraction().catch(e => console.error('[extraction] cron:', e));
  });
}
