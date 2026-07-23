import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { authRequired } from '../auth/auth.middleware.js';
import { requireRole } from '../rbac/rbac.middleware.js';
import { auditLog } from '../audit/audit.middleware.js';

export const shopRouter = Router();
shopRouter.use(authRequired);

// 足浴业务 code(与 template/seed 约定)。新增门店默认挂到该业务下。
const FOOTBATH_BUSINESS_CODE = 'footbath';

// 列出所有活跃门店(软删 status='deleted' 不返回)。含地址 / 电话(海报预设用)。
shopRouter.get('/shops', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT s.id, s.code, s.name, s.status, s.address, s.phone,
              b.code AS business_code, b.name AS business_name
       FROM shop s JOIN business b ON b.id=s.business_id
       WHERE s.status='active'
       ORDER BY s.id`,
    );
    res.json(rows);
  } catch (e) { next(e); }
});

const PatchBody = z.object({
  address: z.string().max(255),
  phone: z.string().max(50),
});

// PATCH /api/shops/:id -> 更新门店联系信息(地址 / 电话),用于海报预设。空串存为 NULL。
shopRouter.patch('/shops/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: '无效 id' });
    const b = PatchBody.parse(req.body);
    const address = b.address.trim() || null;
    const phone = b.phone.trim() || null;
    const { rows } = await query(
      `UPDATE shop SET address = $2, phone = $3 WHERE id = $1
       RETURNING id, code, name, status, address, phone`,
      [id, address, phone],
    );
    if (!rows.length) return res.status(404).json({ error: '门店不存在' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// 新增门店:仅董事长。body { name }。code 自动生成(唯一);业务挂足浴。
// 注:code 仅作 DB 唯一键(种子幂等用),业务/工作簿均按 shop.id 关联,故无需用户指定。
const CreateBody = z.object({ name: z.string().trim().min(1).max(80) });

shopRouter.post('/shops', requireRole('chairman'), auditLog('shop.create'), async (req, res, next) => {
  try {
    const { name } = CreateBody.parse(req.body);
    const b = (await query<{ id: number }>(
      'SELECT id FROM business WHERE code=$1', [FOOTBATH_BUSINESS_CODE],
    )).rows[0];
    if (!b) return res.status(400).json({ error: '业务不存在,请先运行 seed' });
    // code 不暴露给用户,用时间戳生成保证唯一(足浴店编号体系后续如需可再改)
    const code = `s${Date.now().toString(36)}`;
    const { rows } = await query(
      `INSERT INTO shop (business_id, code, name, monthly_target)
       VALUES ($1, $2, $3, 0)
       RETURNING id, code, name, status, address, phone`,
      [b.id, code, name],
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

// 重命名门店:仅董事长。body { name }。
const RenameBody = z.object({ name: z.string().trim().min(1).max(80) });

shopRouter.patch('/shops/:id/rename', requireRole('chairman'), auditLog('shop.rename'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: '无效 id' });
    const { name } = RenameBody.parse(req.body);
    const { rows } = await query(
      `UPDATE shop SET name=$2 WHERE id=$1 AND status='active'
       RETURNING id, code, name, status, address, phone`,
      [id, name],
    );
    if (!rows.length) return res.status(404).json({ error: '门店不存在' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// 删除门店:仅董事长,软删(status='deleted')。
// 软删原因:workbook / daily_metric / expense 均以 shop_id 外键关联且无级联,
// 硬删会因历史数据触发外键约束失败;软删既可从列表隐藏,又保留历史用于大屏累计 KPI。
shopRouter.delete('/shops/:id', requireRole('chairman'), auditLog('shop.delete'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: '无效 id' });
    const { rows } = await query(
      `UPDATE shop SET status='deleted' WHERE id=$1 AND status='active' RETURNING id`,
      [id],
    );
    if (!rows.length) return res.status(404).json({ error: '门店不存在' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});
