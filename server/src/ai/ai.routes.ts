import { Router } from 'express';
import { z } from 'zod';
import { authRequired } from '../auth/auth.middleware.js';
import { auditLog } from '../audit/audit.middleware.js';
import { chat } from './ai.gateway.js';
import { config } from '../config.js';

export const aiRouter = Router();
aiRouter.use(authRequired);

// 当前 AI 配置信息(对话模型 + 文生图模型 + 是否已配 key)
aiRouter.get('/ai/info', (_req, res) => {
  res.json({ chatModel: config.doubaoModel, posterModel: config.posterModel, configured: !!config.doubaoApiKey });
});

const Body = z.object({
  message: z.string().min(1),
  shopId: z.number().int().nullable().optional(),
  period: z.string().optional(),
});

aiRouter.post('/ai/chat', auditLog('ai.chat'), async (req, res, next) => {
  try {
    const b = Body.parse(req.body);
    const period = b.period ?? new Date().toISOString().slice(0, 7);
    const r = await chat(b.message, { shopId: b.shopId ?? null, period });
    res.json(r);
  } catch (e) { next(e); }
});
