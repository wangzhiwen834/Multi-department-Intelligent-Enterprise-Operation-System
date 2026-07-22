import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { query } from '../src/db/pool.js';
import { hashPassword } from '../src/auth/password.js';
import { resetDb } from './helpers.js';
import { getFeatureModel } from '../src/settings/settings.service.js';

let chairT: string;
let mgrT: string;
let empT: string;

beforeEach(async () => {
  await resetDb();
  vi.unstubAllGlobals();
  await query("INSERT INTO app_user (username,password_hash,name,role) VALUES ('boss',$1,'董事长','chairman')", [await hashPassword('pw')]);
  await query("INSERT INTO app_user (username,password_hash,name,role) VALUES ('mgr',$1,'经理','manager')", [await hashPassword('pw')]);
  await query("INSERT INTO app_user (username,password_hash,name,role) VALUES ('emp',$1,'员工','employee')", [await hashPassword('pw')]);
  const login = (u: string) => request(app).post('/api/auth/login').send({ username: u, password: 'pw' });
  chairT = (await login('boss')).body.token;
  mgrT = (await login('mgr')).body.token;
  empT = (await login('emp')).body.token;
});
afterEach(() => vi.unstubAllGlobals());

async function addModel(token: string, model_id: string, kind = 'chat') {
  return request(app).post('/api/settings/ai/models').set('Authorization', `Bearer ${token}`)
    .send({ model_id, label: model_id, kind });
}

describe('GET /api/settings/ai', () => {
  it('员工可读(200)', async () => {
    const r = await request(app).get('/api/settings/ai').set('Authorization', `Bearer ${empT}`);
    expect(r.status).toBe(200);
    expect(r.body.models).toEqual([]);
    expect(r.body.features).toEqual({ chat: null, poster: null, extraction: null });
  });
});

describe('POST /api/settings/ai/models', () => {
  it('chairman 新增 -> 201', async () => {
    const r = await addModel(chairT, 'm1', 'chat');
    expect(r.status).toBe(201);
    const get = await request(app).get('/api/settings/ai').set('Authorization', `Bearer ${chairT}`);
    expect(get.body.models.length).toBe(1);
    expect(get.body.models[0].model_id).toBe('m1');
  });
  it('manager -> 403', async () => {
    const r = await addModel(mgrT, 'm1');
    expect(r.status).toBe(403);
  });
  it('employee -> 403', async () => {
    const r = await addModel(empT, 'm1');
    expect(r.status).toBe(403);
  });
});

describe('DELETE /api/settings/ai/models/:id', () => {
  it('被功能引用 -> 409', async () => {
    await addModel(chairT, 'm1');
    await request(app).put('/api/settings/ai/features/chat').set('Authorization', `Bearer ${chairT}`).send({ model_id: 'm1' });
    const id = (await query('SELECT id FROM ai_model WHERE model_id=$1', ['m1'])).rows[0].id;
    const r = await request(app).delete(`/api/settings/ai/models/${id}`).set('Authorization', `Bearer ${chairT}`);
    expect(r.status).toBe(409);
  });
  it('未被引用 -> 200 且删除', async () => {
    await addModel(chairT, 'm1');
    const id = (await query('SELECT id FROM ai_model WHERE model_id=$1', ['m1'])).rows[0].id;
    const r = await request(app).delete(`/api/settings/ai/models/${id}`).set('Authorization', `Bearer ${chairT}`);
    expect(r.status).toBe(200);
    const n = (await query('SELECT count(*)::int AS n FROM ai_model')).rows[0].n;
    expect(n).toBe(0);
  });
});

describe('PUT /api/settings/ai/features/:feature', () => {
  it('chairman 分配 -> 200,getFeatureModel 返新值', async () => {
    await addModel(chairT, 'm1', 'chat');
    const r = await request(app).put('/api/settings/ai/features/chat').set('Authorization', `Bearer ${chairT}`)
      .send({ model_id: 'm1' });
    expect(r.status).toBe(200);
    expect(await getFeatureModel('chat')).toBe('m1');
  });
  it('manager -> 403', async () => {
    await addModel(chairT, 'm1');
    const r = await request(app).put('/api/settings/ai/features/chat').set('Authorization', `Bearer ${mgrT}`)
      .send({ model_id: 'm1' });
    expect(r.status).toBe(403);
  });
  it('模型不存在 -> 404', async () => {
    const r = await request(app).put('/api/settings/ai/features/chat').set('Authorization', `Bearer ${chairT}`)
      .send({ model_id: 'nope' });
    expect(r.status).toBe(404);
  });
});

describe('POST /api/settings/ai/models/refresh', () => {
  it('chairman 拉取 -> 200 + fetched(mock fetch)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ data: [{ id: 'm1', name: 'M1', status: 'Active', task_type: ['TextGeneration'] }] }), text: async () => '',
    }));
    const r = await request(app).post('/api/settings/ai/models/refresh').set('Authorization', `Bearer ${chairT}`);
    expect(r.status).toBe(200);
    expect(r.body.fetched).toBe(1);
  });
  it('manager -> 403', async () => {
    const r = await request(app).post('/api/settings/ai/models/refresh').set('Authorization', `Bearer ${mgrT}`);
    expect(r.status).toBe(403);
  });
});

describe('GET /api/ai/info(随 DB 分配同步)', () => {
  it('无分配 -> env 兜底;分配后 -> DB 值', async () => {
    const r0 = await request(app).get('/api/ai/info').set('Authorization', `Bearer ${chairT}`);
    expect(r0.status).toBe(200);
    expect(r0.body.configured).toBe(true);
    expect(r0.body.chatModel).toBeTruthy();
    // 分配 chat -> m-chat
    await addModel(chairT, 'm-chat', 'chat');
    await request(app).put('/api/settings/ai/features/chat').set('Authorization', `Bearer ${chairT}`).send({ model_id: 'm-chat' });
    const r1 = await request(app).get('/api/ai/info').set('Authorization', `Bearer ${chairT}`);
    expect(r1.body.chatModel).toBe('m-chat');
    // poster 未分配仍 env 兜底
    expect(r1.body.posterModel).not.toBe('m-chat');
  });
});
