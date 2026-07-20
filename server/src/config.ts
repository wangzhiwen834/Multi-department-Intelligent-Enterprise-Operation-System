import 'dotenv/config';
import path from 'node:path';

const required = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env ${k}`);
  return v;
};

export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS ?? 10),
  doubaoApiKey: process.env.DOUBAO_API_KEY ?? '',
  doubaoModel: process.env.DOUBAO_MODEL ?? 'doubao-seed-2-1-pro-260628',
  doubaoBaseUrl: process.env.DOUBAO_BASE_URL ?? 'https://ark.cn-beijing.volces.com/api/v3',
  posterModel: process.env.POSTER_MODEL ?? 'doubao-seedream-4-0-250828',
  // 上传文件根目录(企业 logo 等);默认 server/uploads,可由 UPLOADS_DIR 覆盖
  uploadsDir: process.env.UPLOADS_DIR ?? path.resolve(process.cwd(), 'uploads'),
};
