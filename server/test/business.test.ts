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

describe('PATCH /api/businesses/:id/rename', () => {
  it('董事长可改名', async () => {
    const r = await request(app).patch(`/api/businesses/${businessId}/rename`).set('Authorization', `Bearer ${bossT}`).send({ name: '静水楼台足浴' });
    expect(r.status).toBe(200);
    expect(r.body.name).toBe('静水楼台足浴');
  });

  it('经理 403', async () => {
    const r = await request(app).patch(`/api/businesses/${businessId}/rename`).set('Authorization', `Bearer ${mgrT}`).send({ name: 'X' });
    expect(r.status).toBe(403);
  });

  it('不存在 404', async () => {
    const r = await request(app).patch('/api/businesses/9999/rename').set('Authorization', `Bearer ${bossT}`).send({ name: 'X' });
    expect(r.status).toBe(404);
  });
});

describe('DELETE /api/businesses/:id (硬删级联,董事长)', () => {
  it('级联删 business/shop/workbook/daily_metric/expense/template', async () => {
    // 建临时业务 + 模板 + 2 店 + 工作簿/指标/费用
    const b = (await query("INSERT INTO business (code,name) VALUES ('tmp','临时业务') RETURNING id")).rows[0];
    await query('INSERT INTO template (business_id, version, definition) VALUES ($1,1,$2)', [b.id, JSON.stringify({ sheets: [] })]);
    const s1 = (await query("INSERT INTO shop (business_id, code, name) VALUES ($1,'s1','A店') RETURNING id", [b.id])).rows[0];
    const s2 = (await query("INSERT INTO shop (business_id, code, name) VALUES ($1,'s2','B店') RETURNING id", [b.id])).rows[0];
    await query("INSERT INTO workbook (shop_id, period, template_version) VALUES ($1,'2026-07',1)", [s1.id]);
    await query("INSERT INTO workbook (shop_id, period, template_version) VALUES ($1,'2026-07',1)", [s2.id]);
    await query("INSERT INTO daily_metric (shop_id, date, business_code, metrics) VALUES ($1,'2026-07-01','tmp','{}')", [s1.id]);
    await query("INSERT INTO expense (shop_id, amount) VALUES ($1,100)", [s1.id]);

    const r = await request(app).delete(`/api/businesses/${b.id}`).set('Authorization', `Bearer ${bossT}`);
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);

    // business/shop/template 删除后为 0(business 表无 business_id 列,按 id 查)
    const cBiz = (await query('SELECT COUNT(*)::int AS c FROM business WHERE id=$1', [b.id])).rows[0].c;
    expect(cBiz).toBe(0);
    for (const t of ['shop', 'template']) {
      const c = (await query(`SELECT COUNT(*)::int AS c FROM ${t} WHERE business_id=$1`, [b.id])).rows[0].c;
      expect(c).toBe(0);
    }
    // workbook/daily_metric/expense 全表为 0(resetDb 已清空,本用例只插了这些)
    for (const t of ['workbook', 'daily_metric', 'expense']) {
      const c = (await query(`SELECT COUNT(*)::int AS c FROM ${t}`)).rows[0].c;
      expect(c).toBe(0);
    }
  });

  it('经理删 403 且数据不动', async () => {
    const b = (await query("INSERT INTO business (code,name) VALUES ('tmp','临时业务') RETURNING id")).rows[0];
    const r = await request(app).delete(`/api/businesses/${b.id}`).set('Authorization', `Bearer ${mgrT}`);
    expect(r.status).toBe(403);
    const c = (await query('SELECT COUNT(*)::int AS c FROM business WHERE id=$1', [b.id])).rows[0].c;
    expect(c).toBe(1);
  });

  it('不存在 404', async () => {
    const r = await request(app).delete('/api/businesses/9999').set('Authorization', `Bearer ${bossT}`);
    expect(r.status).toBe(404);
  });
});

const PNG_1x1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1QwAAAAC0lEQVR42mNkYAAAAAYAAjCB0N8AAAAASUVORK5CYII=';

describe('business logo 上传/删除', () => {
  it('上传 -> 文件落盘 + logo_path 指向 + GET 取到', async () => {
    const r = await request(app).post(`/api/businesses/${businessId}/logo`).set('Authorization', `Bearer ${bossT}`).send({ image: PNG_1x1, originalName: 't.png' });
    expect(r.status).toBe(200);
    expect(r.body.logo_path).toMatch(/^\/api\/uploads\/business-logos\/.+\.png$/);
    const row = (await query('SELECT logo_path FROM business WHERE id=$1', [businessId])).rows[0];
    expect(row.logo_path).toBe(r.body.logo_path);
    const g = await request(app).get(r.body.logo_path);
    expect(g.status).toBe(200);
  });

  it('删 logo -> logo_path=null + 磁盘文件删', async () => {
    const up = (await request(app).post(`/api/businesses/${businessId}/logo`).set('Authorization', `Bearer ${bossT}`).send({ image: PNG_1x1, originalName: 't.png' })).body;
    const r = await request(app).delete(`/api/businesses/${businessId}/logo`).set('Authorization', `Bearer ${bossT}`);
    expect(r.status).toBe(200);
    expect(r.body.logo_path).toBeNull();
    const g = await request(app).get(up.logo_path);
    expect(g.status).toBe(404);
  });

  it('经理上传 403', async () => {
    const r = await request(app).post(`/api/businesses/${businessId}/logo`).set('Authorization', `Bearer ${mgrT}`).send({ image: PNG_1x1, originalName: 't.png' });
    expect(r.status).toBe(403);
  });

  it('非 data URL 400', async () => {
    const r = await request(app).post(`/api/businesses/${businessId}/logo`).set('Authorization', `Bearer ${bossT}`).send({ image: 'not-a-data-url', originalName: 't.png' });
    expect(r.status).toBe(400);
  });
});

describe('新业务门店开工作簿(无模板)', () => {
  it('建后开工作簿 -> 400 模板待定义', async () => {
    const b = (await request(app).post('/api/businesses').set('Authorization', `Bearer ${bossT}`).send({ name: '汉庭酒店' })).body;
    const s = (await query("INSERT INTO shop (business_id, code, name) VALUES ($1,'h1','酒店A店') RETURNING id", [b.id])).rows[0];
    const r = await request(app).post('/api/workbooks').set('Authorization', `Bearer ${bossT}`).send({ shopId: s.id, period: '2026-07' });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('模板待定义');
  });
});
