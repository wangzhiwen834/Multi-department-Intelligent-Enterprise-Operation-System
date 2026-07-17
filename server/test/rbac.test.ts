import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { query } from '../src/db/pool.js';
import { hashPassword } from '../src/auth/password.js';

async function login(username: string) {
  const r = await request(app).post('/api/auth/login').send({ username, password: 'pw123' });
  return r.body.token as string;
}

async function mkUser(username: string, role: string, dept: string | null, createdBy: number | null) {
  await query(
    `INSERT INTO app_user (username,password_hash,name,role,department,created_by) VALUES ($1,$2,$3,$4,$5,$6)`,
    [username, await hashPassword('pw123'), username, role, dept, createdBy],
  );
}

beforeEach(async () => {
  await query('DELETE FROM app_user');
  await mkUser('boss', 'chairman', null, null);
  await mkUser('mgr1', 'manager', '财务部', null);
});

describe('rbac 用户管理', () => {
  it('员工不能管理用户', async () => {
    await mkUser('emp1', 'employee', '财务部', null);
    const t = await login('emp1');
    const r = await request(app).get('/api/users').set('Authorization', `Bearer ${t}`);
    expect(r.status).toBe(403);
  });

  it('经理能创建员工但不能创建经理', async () => {
    const t = await login('mgr1');
    const ok = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${t}`)
      .send({ username: 'e2', password: 'pw123', name: 'e2', role: 'employee', department: '财务部' });
    expect(ok.status).toBe(201);

    const bad = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${t}`)
      .send({ username: 'm2', password: 'pw123', name: 'm2', role: 'manager', department: '财务部' });
    expect(bad.status).toBe(403);
  });

  it('董事长能创建经理', async () => {
    const t = await login('boss');
    const r = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${t}`)
      .send({ username: 'm2', password: 'pw123', name: 'm2', role: 'manager', department: '运营部' });
    expect(r.status).toBe(201);
  });

  it('经理不能管别的部门的员工', async () => {
    // 董事长创建一个运营部员工
    const bossT = await login('boss');
    await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${bossT}`)
      .send({ username: 'ops1', password: 'pw123', name: 'ops1', role: 'employee', department: '运营部' });
    const { rows } = await query("SELECT id FROM app_user WHERE username='ops1'");
    const opsId = rows[0].id;
    // 经理(财务部)尝试改运营部员工 -> 403
    const mgrT = await login('mgr1');
    const r = await request(app).patch(`/api/users/${opsId}`).set('Authorization', `Bearer ${mgrT}`).send({ name: 'hacked' });
    expect(r.status).toBe(403);
  });

  it('经理能管自己创建的员工', async () => {
    const mgrT = await login('mgr1');
    const created = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${mgrT}`)
      .send({ username: 'e3', password: 'pw123', name: 'e3', role: 'employee', department: '财务部' });
    const r = await request(app)
      .patch(`/api/users/${created.body.id}`)
      .set('Authorization', `Bearer ${mgrT}`)
      .send({ phone: '13800000000' });
    expect(r.status).toBe(200);
    expect(r.body.phone).toBe('13800000000');
  });
});
