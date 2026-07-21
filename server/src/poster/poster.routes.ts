import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { getFeatureModel } from '../settings/settings.service.js';
import { query } from '../db/pool.js';
import { authRequired } from '../auth/auth.middleware.js';
import { auditLog } from '../audit/audit.middleware.js';

export const posterRouter = Router();
posterRouter.use(authRequired);

const Body = z.object({ prompt: z.string().min(1).max(1000), size: z.string().optional() });

// POST /api/poster/generate { prompt, size? } -> { image: dataUrl }
// 文生图生成背景,返回 base64 dataUrl(避免前端跨域 Canvas 污染)。文字层由前端 Canvas 叠加。
posterRouter.post('/poster/generate', auditLog('poster.generate'), async (req, res, next) => {
  try {
    const { prompt, size } = Body.parse(req.body);
    if (!config.doubaoApiKey) return res.status(400).json({ error: '未配置 DOUBAO_API_KEY' });
    const model = await getFeatureModel('poster');
    const r = await fetch(`${config.doubaoBaseUrl}/images/generations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.doubaoApiKey}` },
      body: JSON.stringify({ model, prompt, response_format: 'url', size: size || '1024x1536', watermark: false }),
    });
    if (!r.ok) return res.status(502).json({ error: `文生图失败:${(await r.text()).slice(0, 300)}` });
    const data: any = await r.json();
    const url = data.data?.[0]?.url;
    if (!url) return res.status(502).json({ error: '文生图未返回图片' });
    // 取回图片转 base64
    const imgResp = await fetch(url);
    const buf = Buffer.from(await imgResp.arrayBuffer());
    const mime = imgResp.headers.get('content-type') || 'image/jpeg';
    res.json({ image: `data:${mime};base64,${buf.toString('base64')}` });
  } catch (e) { next(e); }
});

// ---------- 企业 logo(全局共享) ----------
// 上传走 base64 dataUrl(与 /poster/generate 一致,不加 multer 依赖)。
// 文件存 server/uploads/logos,经 /api/uploads/logos 静态服务对外(同源,避免 Canvas 跨域污染)。
const logosDir = path.join(config.uploadsDir, 'logos');
const ALLOWED_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};
const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2MB

const LogoBody = z.object({
  image: z.string().min(1).max(5 * 1024 * 1024), // dataUrl 字符串,放宽到 5MB(解码后约 2MB 内)
  originalName: z.string().min(1).max(255),
});

const logoUrl = (filename: string) => `/api/uploads/logos/${filename}`;

// GET /api/poster/logos -> 列出全部 logo(按上传时间倒序)
posterRouter.get('/poster/logos', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, filename, original_name, mime, size, created_at FROM poster_logo ORDER BY id DESC`,
    );
    res.json(rows.map(r => ({ ...r, url: logoUrl(r.filename) })));
  } catch (e) { next(e); }
});

// POST /api/poster/logos { image: dataUrl, originalName } -> 存磁盘 + 库,返回新 logo
posterRouter.post('/poster/logos', auditLog('poster.logo.upload'), async (req, res, next) => {
  try {
    const { image, originalName } = LogoBody.parse(req.body);
    const m = image.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return res.status(400).json({ error: '图片格式不正确(需 data URL)' });
    const mime = m[1].toLowerCase();
    const ext = ALLOWED_MIME[mime];
    if (!ext) return res.status(400).json({ error: '仅支持 PNG / JPEG / WebP 格式' });
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > MAX_LOGO_BYTES) return res.status(413).json({ error: 'logo 过大,请压缩到 2MB 以内' });

    await mkdir(logosDir, { recursive: true });
    const filename = `${randomUUID()}.${ext}`;
    await writeFile(path.join(logosDir, filename), buf);

    const { rows } = await query(
      `INSERT INTO poster_logo (filename, original_name, mime, size) VALUES ($1, $2, $3, $4)
       RETURNING id, filename, original_name, mime, size, created_at`,
      [filename, originalName, mime, buf.length],
    );
    res.json({ ...rows[0], url: logoUrl(rows[0].filename) });
  } catch (e) { next(e); }
});

// DELETE /api/poster/logos/:id -> 删磁盘文件 + 库记录
posterRouter.delete('/poster/logos/:id', auditLog('poster.logo.delete'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: '无效 id' });
    const { rows } = await query(`SELECT filename FROM poster_logo WHERE id = $1`, [id]);
    if (!rows.length) return res.status(404).json({ error: 'logo 不存在' });
    const filename = rows[0].filename;
    await query(`DELETE FROM poster_logo WHERE id = $1`, [id]);
    await unlink(path.join(logosDir, filename)).catch(() => {}); // 文件不存在则忽略
    res.json({ ok: true });
  } catch (e) { next(e); }
});
