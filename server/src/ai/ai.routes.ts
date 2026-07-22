import { Router } from 'express';
import { z } from 'zod';
import { authRequired } from '../auth/auth.middleware.js';
import { auditLog } from '../audit/audit.middleware.js';
import { chat } from './ai.gateway.js';
import { config } from '../config.js';
import { getFeatureModel } from '../settings/settings.service.js';

export const aiRouter = Router();
aiRouter.use(authRequired);

// 当前 AI 配置信息:各功能实际使用的模型(读 DB 分配,无则 env 兜底)+ 是否已配 key。
// 供前端 AI 分析/海报界面显示"当前模型",设置页改分配后此处同步。
aiRouter.get('/ai/info', async (_req, res) => {
  const [chatModel, posterModel, extractionModel] = await Promise.all([
    getFeatureModel('chat'), getFeatureModel('poster'), getFeatureModel('extraction'),
  ]);
  res.json({ chatModel, posterModel, extractionModel, configured: !!config.doubaoApiKey });
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
