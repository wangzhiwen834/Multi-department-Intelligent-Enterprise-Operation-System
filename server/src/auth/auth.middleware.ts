import type { Request, Response, NextFunction } from 'express';
import { verifyToken, type TokenPayload } from './jwt.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: TokenPayload;
  }
}

export const authRequired = (req: Request, res: Response, next: NextFunction) => {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    req.user = verifyToken(h.slice(7));
    next();
  } catch {
    res.status(401).json({ error: 'unauthorized' });
  }
};
