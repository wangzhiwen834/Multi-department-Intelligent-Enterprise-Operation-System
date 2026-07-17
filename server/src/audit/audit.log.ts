import { query } from '../db/pool.js';

export interface LogEntry {
  userId: number | null;
  userName: string | null;
  ip: string;
  action: string;
  target?: string;
  detail?: Record<string, unknown>;
  result?: 'success' | 'failed';
}

export const logOperation = async (e: LogEntry) => {
  await query(
    `INSERT INTO operation_log (user_id,user_name,ip,action,target,detail,result)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      e.userId,
      e.userName,
      e.ip,
      e.action,
      e.target ?? null,
      JSON.stringify(e.detail ?? {}),
      e.result ?? 'success',
    ],
  );
};
