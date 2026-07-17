import 'dotenv/config';

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
  doubaoModel: process.env.DOUBAO_MODEL ?? 'doubao-1.5-pro-32k-250115',
  doubaoBaseUrl: process.env.DOUBAO_BASE_URL ?? 'https://ark.cn-beijing.volces.com/api/v3',
};
