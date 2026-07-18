import { query } from '../db/pool.js';
import type { TokenPayload } from '../auth/jwt.js';

// 锁 TTL 60s,前端每 5s 心跳续约;断线后约 60s 自动过期可被接管
const TTL_MS = 60_000;

/** 占锁:先清过期,再尝试插入;被占则返回当前持有者。
 *  若持有者是自己(如刷新后旧会话锁仍在),直接续期接管,避免自己挡自己。 */
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
  const holder = cur.rows[0];
  if (holder && holder.user_id === user.id) {
    const upd = await query(
      `UPDATE sheet_lock SET expires_at=$3, acquired_at=now(), request_user_id=NULL, request_user_name=NULL
       WHERE workbook_id=$1 AND sheet_key=$2 AND user_id=$4 RETURNING *`,
      [wbId, sheetKey, expires, user.id],
    );
    if (upd.rows.length) return { acquired: true, lock: upd.rows[0] };
  }
  return { acquired: false, heldBy: holder ?? null };
};

/** 心跳续约:仅持有者可续;返回 takeoverRequest(有人请求接管) */
export const heartbeat = async (wbId: number, sheetKey: string, user: TokenPayload) => {
  const expires = new Date(Date.now() + TTL_MS);
  const r = await query(
    `UPDATE sheet_lock SET expires_at=$4 WHERE workbook_id=$1 AND sheet_key=$2 AND user_id=$3 RETURNING *`,
    [wbId, sheetKey, user.id, expires],
  );
  if (r.rows.length) {
    const row = r.rows[0];
    return {
      renewed: true, lock: row,
      takeoverRequest: row.request_user_name ? { user_name: row.request_user_name } : null,
    };
  }
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

/** 请求接管(两阶段):若有锁且非自己持有,登记接管请求(不夺权);原持有者下次心跳
 *  保存后调用 yieldLock 让出。无锁/已过期/自己已持有 -> 直接占取。 */
export const requestTakeover = async (wbId: number, sheetKey: string, user: TokenPayload) => {
  await query('DELETE FROM sheet_lock WHERE workbook_id=$1 AND sheet_key=$2 AND expires_at < now()', [wbId, sheetKey]);
  const expires = new Date(Date.now() + TTL_MS);
  const ins = await query(
    `INSERT INTO sheet_lock (workbook_id, sheet_key, user_id, user_name, expires_at)
     VALUES ($1,$2,$3,$4,$5) ON CONFLICT (workbook_id, sheet_key) DO NOTHING RETURNING *`,
    [wbId, sheetKey, user.id, user.username, expires],
  );
  if (ins.rows.length) return { acquired: true, lock: ins.rows[0] };
  const cur = await query('SELECT user_id, user_name FROM sheet_lock WHERE workbook_id=$1 AND sheet_key=$2', [wbId, sheetKey]);
  const holder = cur.rows[0];
  if (!holder) return { acquired: false, heldBy: null };
  if (holder.user_id === user.id) return { acquired: true, lock: holder };
  await query(
    `UPDATE sheet_lock SET request_user_id=$3, request_user_name=$4 WHERE workbook_id=$1 AND sheet_key=$2`,
    [wbId, sheetKey, user.id, user.username],
  );
  return { acquired: false, pending: true, heldBy: { user_name: holder.user_name } };
};

/** 持有者让出锁给接管请求者(自动保存后调用) */
export const yieldLock = async (wbId: number, sheetKey: string, user: TokenPayload) => {
  const expires = new Date(Date.now() + TTL_MS);
  const r = await query(
    `UPDATE sheet_lock
       SET user_id = request_user_id,
           user_name = request_user_name,
           expires_at = $3,
           acquired_at = now(),
           request_user_id = NULL,
           request_user_name = NULL
     WHERE workbook_id=$1 AND sheet_key=$2 AND user_id=$4 AND request_user_id IS NOT NULL
     RETURNING *`,
    [wbId, sheetKey, expires, user.id],
  );
  if (r.rows.length) return { yielded: true, lock: r.rows[0] };
  return { yielded: false };
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
