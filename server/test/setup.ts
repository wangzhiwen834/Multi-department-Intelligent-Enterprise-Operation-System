import 'dotenv/config';

process.env.NODE_ENV = 'test';
// 测试会清空 app_user / operation_log,建议用独立测试库
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
