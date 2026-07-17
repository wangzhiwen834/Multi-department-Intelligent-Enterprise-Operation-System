import express, { type Request, type Response, type NextFunction } from 'express';
import { ZodError } from 'zod';
import { config } from './config.js';
import { authRouter } from './auth/auth.routes.js';
import { userRouter } from './rbac/user.routes.js';

export const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);

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
