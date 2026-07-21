import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { authRequired } from '../auth/auth.middleware.js';
import { isLockHolder, getLockStatus } from '../lock/lock.service.js';
import { auditLog } from '../audit/audit.middleware.js';

export const workbookRouter = Router();
workbookRouter.use(authRequired);

const CreateBody = z.object({ shopId: z.number().int(), period: z.string().regex(/^\d{4}-\d{2}$/) });

// 复制上月快照:每表只保留第 0 行(表头)cellData,清空其余行;保留 styles/sheetOrder/列宽/行高/合并
const headersOnlySnapshot = (snap: any): any => {
  const sheets: Record<string, any> = {};
  for (const sid of Object.keys(snap.sheets || {})) {
    const sh = snap.sheets[sid];
    const cellData = sh.cellData || {};
    const kept: Record<string, any> = cellData['0'] ? { 0: cellData['0'] } : {};
    sheets[sid] = { ...sh, cellData: kept };
  }
  return { ...snap, sheets };
};

// 引导加载:仅保留活动表(sheetOrder[0])的 cellData,其余表 cellData 置空;全量 styles/元信息保留
const activeOnlySnapshot = (snap: any): any => {
  const order: string[] = snap.sheetOrder || Object.keys(snap.sheets || {});
  const activeId = order[0];
  const sheets: Record<string, any> = {};
  for (const sid of order) {
    const sh = snap.sheets[sid];
    sheets[sid] = sid === activeId ? sh : { ...sh, cellData: {} };
  }
  return { ...snap, sheets };
};

// upsert 工作簿(shopId+period),返回完整行;POST /workbooks 与 bootstrap 共用,避免重复(预检决定)
const upsertWorkbook = async (shopId: number, period: string, templateVersion: number) => {
  const ins = await query(
    `INSERT INTO workbook (shop_id, period, template_version) VALUES ($1,$2,$3)
     ON CONFLICT (shop_id, period) DO UPDATE SET updated_at=now()
     RETURNING id, shop_id, period, template_version, status, created_at`,
    [shopId, period, templateVersion],
  );
  return ins.rows[0];
};

// 创建(或返回已存在)工作簿
workbookRouter.post('/workbooks', async (req, res, next) => {
  try {
    const { shopId, period } = CreateBody.parse(req.body);
    const shop = (await query<{ business_id: number }>('SELECT business_id FROM shop WHERE id=$1', [shopId])).rows[0];
    if (!shop) return res.status(404).json({ error: 'shop not found' });
    const tpl = (await query<{ version: number }>(
      'SELECT version FROM template WHERE business_id=$1 ORDER BY version DESC LIMIT 1', [shop.business_id],
    )).rows[0];
    if (!tpl) return res.status(400).json({ error: 'no template for business' });
    const wb = await upsertWorkbook(shopId, period, tpl.version);
    res.status(201).json(wb);
  } catch (e) { next(e); }
});

workbookRouter.get('/workbooks', async (req, res, next) => {
  try {
    const { shopId, period } = req.query as { shopId?: string; period?: string };
    const { rows } = await query(
      'SELECT id, shop_id, period, template_version, status, created_at, updated_at FROM workbook WHERE shop_id=$1 AND period=$2',
      [shopId, period],
    );
    res.json(rows[0] ?? null);
  } catch (e) { next(e); }
});

// 列出某店全部工作簿(按 period 倒序,排除软删除),LATERAL 取一条活跃锁持有者避免行膨胀
workbookRouter.get('/shops/:shopId/workbooks', async (req, res, next) => {
  try {
    const shopId = Number(req.params.shopId);
    const { rows } = await query(
      `SELECT w.id, w.shop_id, w.period, w.template_version, w.status, w.updated_at,
              sl.user_name AS "lockedBy"
       FROM workbook w
       LEFT JOIN LATERAL (
         SELECT user_name FROM sheet_lock WHERE workbook_id = w.id AND expires_at > now() LIMIT 1
       ) sl ON true
       WHERE w.shop_id=$1 AND w.deleted_at IS NULL
       ORDER BY w.period DESC`,
      [shopId],
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// 软删除工作簿(有活跃锁拒绝;保留 snapshot 与已同步 metric,大屏数据不受影响)
workbookRouter.delete('/workbooks/:id', auditLog('workbook.delete'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const lock = (await query('SELECT 1 FROM sheet_lock WHERE workbook_id=$1 AND expires_at > now() LIMIT 1', [id])).rows[0];
    if (lock) return res.status(409).json({ error: '工作簿正在被编辑,无法删除' });
    const r = await query('UPDATE workbook SET deleted_at=now() WHERE id=$1 AND deleted_at IS NULL RETURNING id', [id]);
    if (!r.rows.length) return res.status(404).json({ error: '工作簿不存在或已删除' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// 从上月复制新建(只复制表头/结构,清空数据,不结转期初)
workbookRouter.post('/workbooks/:id/copy-from', auditLog('workbook.copy'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { fromPeriod } = z.object({ fromPeriod: z.string().regex(/^\d{4}-\d{2}$/) }).parse(req.body);
    const target = (await query<{ shop_id: number; period: string; deleted_at: string | null }>(
      'SELECT shop_id, period, deleted_at FROM workbook WHERE id=$1', [id],
    )).rows[0];
    if (!target || target.deleted_at) return res.status(404).json({ error: '目标工作簿不存在' });
    if (fromPeriod === target.period) return res.status(400).json({ error: '源月份与目标月份相同' });
    const src = (await query<{ id: number }>(
      'SELECT id FROM workbook WHERE shop_id=$1 AND period=$2 AND deleted_at IS NULL', [target.shop_id, fromPeriod],
    )).rows[0];
    if (!src) return res.status(404).json({ error: '上月工作簿不存在' });
    const srcSnap = (await query<{ data: any }>('SELECT data FROM workbook_snapshot WHERE workbook_id=$1', [src.id])).rows[0];
    if (!srcSnap) return res.status(400).json({ error: '上月工作簿无快照' });
    const transformed = headersOnlySnapshot(srcSnap.data);
    await query(
      `INSERT INTO workbook_snapshot (workbook_id, data, updated_at) VALUES ($1,$2,now())
       ON CONFLICT (workbook_id) DO UPDATE SET data=EXCLUDED.data, updated_at=now()`,
      [id, JSON.stringify(transformed)],
    );
    await query('UPDATE workbook SET updated_at=now() WHERE id=$1', [id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// 引导加载:一次返回 wbId + template + 活动表快照 + 锁状态(把多次往返压成一次)
const BootstrapBody = z.object({ shopId: z.number().int(), period: z.string().regex(/^\d{4}-\d{2}$/) });

workbookRouter.post('/workbooks/bootstrap', async (req, res, next) => {
  try {
    const { shopId, period } = BootstrapBody.parse(req.body);
    const shop = (await query<{ business_id: number }>('SELECT business_id FROM shop WHERE id=$1', [shopId])).rows[0];
    if (!shop) return res.status(404).json({ error: 'shop not found' });
    const tpl = (await query<{ id: number; code: string; version: number; definition: any }>(
      `SELECT t.id, b.code, t.version, t.definition FROM template t JOIN business b ON b.id=t.business_id
       WHERE t.business_id=$1 ORDER BY t.version DESC LIMIT 1`, [shop.business_id],
    )).rows[0];
    if (!tpl) return res.status(400).json({ error: 'no template for business' });
    const wbId = (await upsertWorkbook(shopId, period, tpl.version)).id;
    const snap = (await query<{ data: any; updated_at: string }>('SELECT data, updated_at FROM workbook_snapshot WHERE workbook_id=$1', [wbId])).rows[0];
    const snapshot = snap ? { data: activeOnlySnapshot(snap.data), updated_at: snap.updated_at } : null;
    const lockRow = await getLockStatus(wbId, 'daily_ops');
    res.json({
      wbId,
      template: { id: tpl.id, business_code: tpl.code, version: tpl.version, definition: tpl.definition },
      snapshot,
      lockStatus: lockRow ?? { held: false },
    });
  } catch (e) { next(e); }
});

// 按需加载:返回指定工作表 cellData + 全量 styles
workbookRouter.get('/workbooks/:id/sheets/:sheetKey/celldata', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const r = (await query<{ data: any }>('SELECT data FROM workbook_snapshot WHERE workbook_id=$1', [id])).rows[0];
    if (!r) return res.status(404).json({ error: '无快照' });
    const sheet = r.data?.sheets?.[req.params.sheetKey];
    if (!sheet) return res.status(404).json({ error: '工作表不存在' });
    res.set('Cache-Control', 'no-store');
    res.json({ cellData: sheet.cellData || {}, styles: r.data?.styles || {} });
  } catch (e) { next(e); }
});

// 存快照(表格编辑保存)
workbookRouter.put('/workbooks/:id/snapshot', auditLog('workbook.save'), async (req, res, next) => {
  try {
    if (!await isLockHolder(Number(req.params.id), req.user!.id))
      return res.status(409).json({ error: '锁已丢失(被他人接管或过期),保存被拒绝,请重载工作簿' });
    const { data } = req.body as { data: unknown };
    await query(
      `INSERT INTO workbook_snapshot (workbook_id, data, updated_at) VALUES ($1,$2,now())
       ON CONFLICT (workbook_id) DO UPDATE SET data=EXCLUDED.data, updated_at=now()`,
      [req.params.id, JSON.stringify(data)],
    );
    await query('UPDATE workbook SET updated_at=now() WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// 取快照
workbookRouter.get('/workbooks/:id/snapshot', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT data, updated_at FROM workbook_snapshot WHERE workbook_id=$1', [req.params.id]);
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.json(rows[0] ?? null);
  } catch (e) { next(e); }
});
