import express, { type Request, type Response, type NextFunction } from 'express';
import compression from 'compression';
import fs from 'node:fs';
import path from 'node:path';
import { ZodError } from 'zod';
import { config } from './config.js';
import { authRouter } from './auth/auth.routes.js';
import { userRouter } from './rbac/user.routes.js';
import { templateRouter } from './template/template.routes.js';
import { workbookRouter } from './workbook/workbook.routes.js';
import { lockRouter } from './lock/lock.routes.js';
import { extractRouter } from './extraction/extraction.routes.js';
import { startScheduler } from './extraction/extraction.scheduler.js';
import { reportRouter } from './report/report.routes.js';
import { shopRouter } from './shop/shop.routes.js';
import { dashboardRouter } from './dashboard/dashboard.routes.js';
import { aiRouter } from './ai/ai.routes.js';
import { posterRouter } from './poster/poster.routes.js';
import { auditRouter } from './audit/audit.routes.js';

export const app = express();
// SSE(text/event-stream)不压缩:compression 会缓冲流破坏实时进度推送
app.use(compression({
  filter: (_req, res) => {
    if (String(res.getHeader('Content-Type') || '').includes('text/event-stream')) return false;
    return compression.filter(_req, res);
  },
}));
app.use(express.json({ limit: '10mb' }));

// 企业 logo 静态资源:<img src> 不携带 Bearer token,故不走 authRequired;logo 为公开展示的企业标识。
// 路径 /api/uploads/logos 自动走 vite proxy(开发)与 Nginx /api 反代(生产),无需改部署。
const logosDir = path.join(config.uploadsDir, 'logos');
fs.mkdirSync(logosDir, { recursive: true });
app.use('/api/uploads/logos', express.static(logosDir));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api', templateRouter);   // /api/templates
app.use('/api', workbookRouter);   // /api/workbooks
app.use('/api', lockRouter);       // /api/workbooks/:id/locks/:sheetKey
app.use('/api', extractRouter);    // /api/workbooks/:id/extract
app.use('/api', reportRouter);     // /api/shops/:id/ledger
app.use('/api', shopRouter);       // /api/shops
app.use('/api', dashboardRouter);  // /api/dashboard/overview
app.use('/api', aiRouter);         // /api/ai/chat
app.use('/api', posterRouter);     // /api/poster/generate, /api/poster/logos
app.use('/api/audit', auditRouter); // /api/audit/logs (董事长/经理)

// 统一错误处理
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'validation', issues: err.issues });
  }
  console.error(err);
  res.status(500).json({ error: 'internal' });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => {
    console.log(`server on :${config.port}`);
    startScheduler(); // 定时 AI 抽取(node-cron,当期每日;test 环境不启动)
  });
}
