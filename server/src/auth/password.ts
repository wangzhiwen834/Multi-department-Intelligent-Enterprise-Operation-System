import bcrypt from 'bcrypt';
import { config } from '../config.js';

export const hashPassword = (pw: string) => bcrypt.hash(pw, config.bcryptRounds);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);
