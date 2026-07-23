import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { pool, query } from '../db/pool.js';
import { authRequired } from '../auth/auth.middleware.js';
import { requireRole } from '../rbac/rbac.middleware.js';
import { auditLog } from '../audit/audit.middleware.js';

export const businessRouter = Router();
businessRouter.use(authRequired);

const bizLogosDir = path.join(config.uploadsDir, 'business-logos');
const ALLOWED_MIME: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const MAX_BIZ_LOGO_BYTES = 2 * 1024 * 1024;
const LOGO_PREFIX = '/api/uploads/business-logos/';

// 删旧上传 logo 磁盘文件(仓库静态资源如 /footbath-logo.png 不删)
const cleanupLogoFile = async (logoPath: string | null) => {
  if (logoPath && logoPath.startsWith(LOGO_PREFIX)) {
    await unlink(path.join(bizLogosDir, logoPath.slice(LOGO_PREFIX.length))).catch(() => {});
  }
};

// GET /api/businesses -> 全部业务(硬删=物理删,无需 status 过滤),带活跃门店数
businessRouter.get('/businesses', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT b.id, b.code, b.name, b.logo_path,
              (SELECT COUNT(*) FROM shop s WHERE s.business_id=b.id AND s.status='active')::int AS shop_count
       FROM business b ORDER BY b.id`,
    );
    res.json(rows);
  } catch (e) { next(e); }
});

const NameBody = z.object({ name: z.string().trim().min(1).max(80) });

// POST /api/businesses -> 董事长新建业务。code 自动(用户只填名);不建模板(子项目2 再定制)。
businessRouter.post('/businesses', requireRole('chairman'), auditLog('business.create'), async (req, res, next) => {
  try {
    const { name } = NameBody.parse(req.body);
    const code = `b${Date.now().toString(36)}`;
    const { rows } = await query(
      `INSERT INTO business (code, name) VALUES ($1, $2) RETURNING id, code, name, logo_path`,
      [code, name],
    );
    res.status(201).json({ ...rows[0], shop_count: 0 });
  } catch (e) { next(e); }
});

// PATCH /api/businesses/:id/rename -> 董事长改名
businessRouter.patch('/businesses/:id/rename', requireRole('chairman'), auditLog('business.rename'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: '无效 id' });
    const { name } = NameBody.parse(req.body);
    const { rows } = await query(
      `UPDATE business SET name=$2 WHERE id=$1 RETURNING id, code, name, logo_path`,
      [id, name],
    );
    if (!rows.length) return res.status(404).json({ error: '业务不存在' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// DELETE /api/businesses/:id -> 董事长硬删级联。单连接事务:workbook(带 snapshot/lock)→ daily_metric → expense → shop → template → business。
// 不改各表外键为 CASCADE(避免影响门店日常软删),显式按序删。删后清上传 logo 文件。
businessRouter.delete('/businesses/:id', requireRole('chairman'), auditLog('business.delete'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: '无效 id' });
    const found = (await query<{ logo_path: string | null }>('SELECT logo_path FROM business WHERE id=$1', [id])).rows[0];
    if (!found) return res.status(404).json({ error: '业务不存在' });
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query(`DELETE FROM workbook WHERE shop_id IN (SELECT id FROM shop WHERE business_id=$1)`, [id]);
      await c.query(`DELETE FROM daily_metric WHERE shop_id IN (SELECT id FROM shop WHERE business_id=$1)`, [id]);
      await c.query(`DELETE FROM expense WHERE shop_id IN (SELECT id FROM shop WHERE business_id=$1)`, [id]);
      await c.query(`DELETE FROM shop WHERE business_id=$1`, [id]);
      await c.query(`DELETE FROM template WHERE business_id=$1`, [id]);
      await c.query(`DELETE FROM business WHERE id=$1`, [id]);
      await c.query('COMMIT');
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      c.release();
    }
    await cleanupLogoFile(found.logo_path);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

const LogoBody = z.object({
  image: z.string().min(1).max(5 * 1024 * 1024), // dataUrl 字符串
  originalName: z.string().min(1).max(255),
});

// POST /api/businesses/:id/logo -> 董事长上传 logo(base64 dataURL → 磁盘文件,旧上传文件清理)
businessRouter.post('/businesses/:id/logo', requireRole('chairman'), auditLog('business.logo.upload'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: '无效 id' });
    const { image, originalName } = LogoBody.parse(req.body);
    const m = image.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return res.status(400).json({ error: '图片格式不正确(需 data URL)' });
    const mime = m[1].toLowerCase();
    const ext = ALLOWED_MIME[mime];
    if (!ext) return res.status(400).json({ error: '仅支持 PNG / JPEG / WebP 格式' });
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > MAX_BIZ_LOGO_BYTES) return res.status(413).json({ error: 'logo 过大,请压缩到 2MB 以内' });
    const old = (await query<{ logo_path: string | null }>('SELECT logo_path FROM business WHERE id=$1', [id])).rows[0];
    if (!old) return res.status(404).json({ error: '业务不存在' });
    await mkdir(bizLogosDir, { recursive: true });
    const filename = `${randomUUID()}.${ext}`;
    await writeFile(path.join(bizLogosDir, filename), buf);
    const logoPath = `${LOGO_PREFIX}${filename}`;
    const { rows } = await query(
      `UPDATE business SET logo_path=$2 WHERE id=$1 RETURNING id, code, name, logo_path`,
      [id, logoPath],
    );
    await cleanupLogoFile(old.logo_path); // 删旧上传文件(足浴仓库资源不删)
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// DELETE /api/businesses/:id/logo -> 董事长删 logo(清 logo_path + 删磁盘文件)
businessRouter.delete('/businesses/:id/logo', requireRole('chairman'), auditLog('business.logo.delete'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: '无效 id' });
    const old = (await query<{ logo_path: string | null }>('SELECT logo_path FROM business WHERE id=$1', [id])).rows[0];
    if (!old) return res.status(404).json({ error: '业务不存在' });
    const { rows } = await query(
      `UPDATE business SET logo_path=NULL WHERE id=$1 RETURNING id, code, name, logo_path`,
      [id],
    );
    await cleanupLogoFile(old.logo_path);
    res.json(rows[0]);
  } catch (e) { next(e); }
});
