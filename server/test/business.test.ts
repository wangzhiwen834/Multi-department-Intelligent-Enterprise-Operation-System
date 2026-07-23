import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { query } from '../src/db/pool.js';
import { hashPassword } from '../src/auth/password.js';
import { resetDb } from './helpers.js';

let bossT: string;
let mgrT: string;
let businessId: number;

async function login(u: string) {
  return (await request(app).post('/api/auth/login').send({ username: u, password: 'pw123' })).body.token as string;
}

beforeEach(async () => {
  await resetDb();
  const b = (await query("INSERT INTO business (code,name,logo_path) VALUES ('footbath','静水楼台','/footbath-logo.png') RETURNING id")).rows[0];
  businessId = b.id;
  await query("INSERT INTO app_user (username,password_hash,name,role) VALUES ('boss',$1,'董事长','chairman')", [await hashPassword('pw123')]);
  await query("INSERT INTO app_user (username,password_hash,name,role,department) VALUES ('mgr',$1,'经理','manager','财务部')", [await hashPassword('pw123')]);
  bossT = await login('boss');
  mgrT = await login('mgr');
});

describe('GET /api/businesses', () => {
  it('返回全部业务,含 logo_path 与 shop_count(仅活跃门店)', async () => {
    await query("INSERT INTO shop (business_id, code, name) VALUES ($1,'dk','大河坎店')", [businessId]);
    await query("INSERT INTO shop (business_id, code, name, status) VALUES ($1,'jd','江北店','deleted')", [businessId]);
    const r = await request(app).get('/api/businesses').set('Authorization', `Bearer ${bossT}`);
    expect(r.status).toBe(200);
    expect(r.body).toHaveLength(1);
    expect(r.body[0]).toMatchObject({ code: 'footbath', name: '静水楼台', logo_path: '/footbath-logo.png', shop_count: 1 });
  });
});

describe('POST /api/businesses (创建,董事长)', () => {
  it('董事长可建业务,code 自动,logo_path=null,无模板', async () => {
    const r = await request(app).post('/api/businesses').set('Authorization', `Bearer ${bossT}`).send({ name: '汉庭酒店' });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ name: '汉庭酒店', logo_path: null, shop_count: 0 });
    expect(r.body.code).toMatch(/^b/);
    const tpl = (await query('SELECT 1 FROM template WHERE business_id=$1', [r.body.id])).rows;
    expect(tpl).toHaveLength(0);
  });

  it('经理建被拒 403', async () => {
    const r = await request(app).post('/api/businesses').set('Authorization', `Bearer ${mgrT}`).send({ name: 'X' });
    expect(r.status).toBe(403);
  });

  it('空名 400', async () => {
    const r = await request(app).post('/api/businesses').set('Authorization', `Bearer ${bossT}`).send({ name: '   ' });
    expect(r.status).toBe(400);
  });
});
