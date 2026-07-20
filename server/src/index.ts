import express, { type Request, type Response, type NextFunction } from 'express';
import { ZodError } from 'zod';
import { config } from './config.js';
import { authRouter } from './auth/auth.routes.js';
import { userRouter } from './rbac/user.routes.js';
import { templateRouter } from './template/template.routes.js';
import { workbookRouter } from './workbook/workbook.routes.js';
import { lockRouter } from './lock/lock.routes.js';
import { syncRouter } from './sync/sync.routes.js';
import { reportRouter } from './report/report.routes.js';
import { shopRouter } from './shop/shop.routes.js';
import { dashboardRouter } from './dashboard/dashboard.routes.js';
import { aiRouter } from './ai/ai.routes.js';
import { posterRouter } from './poster/poster.routes.js';
import { auditRouter } from './audit/audit.routes.js';

export const app = express();
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api', templateRouter);   // /api/templates
app.use('/api', workbookRouter);   // /api/workbooks
app.use('/api', lockRouter);       // /api/workbooks/:id/locks/:sheetKey
app.use('/api', syncRouter);       // /api/workbooks/:id/sync
app.use('/api', reportRouter);     // /api/shops/:id/ledger
app.use('/api', shopRouter);       // /api/shops
app.use('/api', dashboardRouter);  // /api/dashboard/overview
app.use('/api', aiRouter);         // /api/ai/chat
app.use('/api', posterRouter);     // /api/poster/generate
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
  app.listen(config.port, () => console.log(`server on :${config.port}`));
}
