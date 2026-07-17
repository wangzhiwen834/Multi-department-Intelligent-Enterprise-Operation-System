import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export interface TokenPayload {
  id: number;
  username: string;
  role: 'chairman' | 'manager' | 'employee';
  department: string | null;
}

export const signToken = (p: TokenPayload) =>
  jwt.sign(p, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

export const verifyToken = (token: string): TokenPayload =>
  jwt.verify(token, config.jwtSecret) as TokenPayload;
