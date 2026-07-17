import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
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
    const r = await fetch(`${config.doubaoBaseUrl}/images/generations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.doubaoApiKey}` },
      body: JSON.stringify({ model: config.posterModel, prompt, response_format: 'url', size: size || '1024x1536' }),
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
