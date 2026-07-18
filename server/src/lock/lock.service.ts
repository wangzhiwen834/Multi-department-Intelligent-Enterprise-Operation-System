import { query } from '../db/pool.js';
import type { TokenPayload } from '../auth/jwt.js';

// 锁 TTL 60s,前端每 15s 心跳续约;断线后约 60s 自动过期可被接管
const TTL_MS = 60_000;

/** 占锁:先清过期,再尝试插入;被占则返回当前持有者 */
export const acquireLock = async (wbId: number, sheetKey: string, user: TokenPayload) => {
  await query('DELETE FROM sheet_lock WHERE workbook_id=$1 AND sheet_key=$2 AND expires_at < now()', [wbId, sheetKey]);
  const expires = new Date(Date.now() + TTL_MS);
  const ins = await query(
    `INSERT INTO sheet_lock (workbook_id, sheet_key, user_id, user_name, expires_at)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (workbook_id, sheet_key) DO NOTHING
     RETURNING *`,
    [wbId, sheetKey, user.id, user.username, expires],
  );
  if (ins.rows.length) return { acquired: true, lock: ins.rows[0] };
  const cur = await query(
    'SELECT user_id, user_name, expires_at FROM sheet_lock WHERE workbook_id=$1 AND sheet_key=$2',
    [wbId, sheetKey],
  );
  return { acquired: false, heldBy: cur.rows[0] ?? null };
};

/** 心跳续约:仅持有者可续 */
export const heartbeat = async (wbId: number, sheetKey: string, user: TokenPayload) => {
  const expires = new Date(Date.now() + TTL_MS);
  const r = await query(
    `UPDATE sheet_lock SET expires_at=$4 WHERE workbook_id=$1 AND sheet_key=$2 AND user_id=$3 RETURNING *`,
    [wbId, sheetKey, user.id, expires],
  );
  if (r.rows.length) return { renewed: true, lock: r.rows[0] };
  const cur = await query('SELECT user_id, user_name FROM sheet_lock WHERE workbook_id=$1 AND sheet_key=$2', [wbId, sheetKey]);
  return { renewed: false, heldBy: cur.rows[0] ?? null };
};

/** 释放:仅持有者可删(幂等) */
export const releaseLock = async (wbId: number, sheetKey: string, user: TokenPayload) => {
  const r = await query(
    'DELETE FROM sheet_lock WHERE workbook_id=$1 AND sheet_key=$2 AND user_id=$3 RETURNING user_id',
    [wbId, sheetKey, user.id],
  );
  return { released: r.rows.length > 0 };
};

/** 强制接管:无条件夺取锁(即使原持有者仍在线);原持有者下次心跳会收到 heldBy=接管者。
 *  无锁则直接占取。保存(putSnapshot/sync)会校验持有权,故被接管者无法覆盖数据。 */
export const takeoverLock = async (wbId: number, sheetKey: string, user: TokenPayload) => {
  const expires = new Date(Date.now() + TTL_MS);
  const upd = await query(
    `UPDATE sheet_lock SET user_id=$3, user_name=$4, expires_at=$5, acquired_at=now()
     WHERE workbook_id=$1 AND sheet_key=$2 RETURNING *`,
    [wbId, sheetKey, user.id, user.username, expires],
  );
  if (upd.rows.length) return { acquired: true, lock: upd.rows[0] };
  const ins = await query(
    `INSERT INTO sheet_lock (workbook_id, sheet_key, user_id, user_name, expires_at)
     VALUES ($1,$2,$3,$4,$5) ON CONFLICT (workbook_id, sheet_key) DO NOTHING RETURNING *`,
    [wbId, sheetKey, user.id, user.username, expires],
  );
  if (ins.rows.length) return { acquired: true, lock: ins.rows[0] };
  const cur = await query('SELECT user_id, user_name, expires_at FROM sheet_lock WHERE workbook_id=$1 AND sheet_key=$2', [wbId, sheetKey]);
  return { acquired: false, heldBy: cur.rows[0] ?? null };
};

/** 是否当前锁持有者(未过期)--保存/同步前校验,防被接管者覆盖数据 */
export const isLockHolder = async (wbId: number, userId: number) => {
  const r = await query('SELECT 1 FROM sheet_lock WHERE workbook_id=$1 AND user_id=$2 AND expires_at > now()', [wbId, userId]);
  return r.rows.length > 0;
};

/** 状态:清理过期后返回当前持有者 */
export const getLockStatus = async (wbId: number, sheetKey: string) => {
  await query('DELETE FROM sheet_lock WHERE workbook_id=$1 AND sheet_key=$2 AND expires_at < now()', [wbId, sheetKey]);
  const cur = await query('SELECT user_id, user_name, expires_at, acquired_at FROM sheet_lock WHERE workbook_id=$1 AND sheet_key=$2', [wbId, sheetKey]);
  return cur.rows[0] ?? null;
};
