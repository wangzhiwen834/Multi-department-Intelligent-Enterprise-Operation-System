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
