// 创建主库与测试库(若不存在)。读取 .env 的 DATABASE_URL 取连接参数。
import 'dotenv/config';
import pg from 'pg';

const url = new URL(process.env.DATABASE_URL);
const client = new pg.Client({
  host: url.hostname,
  port: Number(url.port),
  user: url.username,
  password: url.password,
  database: 'postgres',
});

await client.connect();
for (const db of ['enterprise_ops', 'enterprise_ops_test']) {
  try {
    await client.query(`CREATE DATABASE ${db}`);
    console.log('created', db);
  } catch (e) {
    console.log(db, ':', e.message);
  }
}
await client.end();
