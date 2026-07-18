<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { api } from '../api';
import type { User } from '../types';

const props = defineProps<{ user: User | null }>();

const users = ref<User[]>([]);
const loading = ref(false);
const err = ref('');
const showCreate = ref(false);
const form = ref({ username: '', password: '', name: '', role: 'employee' as 'manager' | 'employee', department: '', phone: '' });
const creating = ref(false);

const isChairman = computed(() => props.user?.role === 'chairman');
const createableRoles = computed(() => isChairman.value ? ['manager', 'employee'] : ['employee']);

const refresh = async () => {
  loading.value = true; err.value = '';
  try { users.value = await api.listUsers(); } catch (e: any) { err.value = e.message; } finally { loading.value = false; }
};
onMounted(refresh);

const openCreate = () => {
  form.value = { username: '', password: '', name: '', role: 'employee', department: props.user?.department ?? '', phone: '' };
  showCreate.value = true;
};
const create = async () => {
  creating.value = true; err.value = '';
  try {
    await api.createUser({
      username: form.value.username, password: form.value.password, name: form.value.name,
      role: form.value.role, department: form.value.department || null, phone: form.value.phone,
    });
    showCreate.value = false; await refresh();
  } catch (e: any) { err.value = e.message; } finally { creating.value = false; }
};
const toggleStatus = async (u: User) => {
  try { await api.updateUser(u.id, { status: u.status === 'disabled' ? 'active' : 'disabled' }); await refresh(); }
  catch (e: any) { err.value = e.message; }
};
const remove = async (u: User) => {
  if (!confirm(`确认禁用账号 ${u.username}?`)) return;
  try { await api.disableUser(u.id); await refresh(); } catch (e: any) { err.value = e.message; }
};

const roleLabel = (r: string) => r === 'chairman' ? '董事长' : r === 'manager' ? '经理' : '员工';
</script>

<template>
  <div class="od-employees">
    <div class="od-card">
      <div class="od-toolbar">
        <div class="od-toolbar-left">
          <div class="od-tb-title">员工管理</div>
          <div class="od-tb-meta">当前登录:<b>{{ user?.name ?? '-' }}</b> · {{ roleLabel(user?.role ?? '') }}</div>
        </div>
        <div class="od-toolbar-right">
          <span class="od-scope">{{ isChairman ? '全员(含经理)' : '本部门员工' }}</span>
          <button class="od-btn-primary" @click="openCreate">+ 新建{{ isChairman ? '经理/员工' : '员工' }}</button>
        </div>
      </div>

      <div v-if="err" class="od-err">{{ err }}</div>

      <div class="od-table-wrap">
        <table class="od-table">
          <thead>
            <tr><th>姓名</th><th>账号</th><th>角色</th><th>部门</th><th>手机</th><th>状态</th><th>操作</th></tr>
          </thead>
          <tbody>
            <tr v-if="loading"><td colspan="7" class="od-empty">加载中…</td></tr>
            <tr v-else-if="!users.length"><td colspan="7" class="od-empty">暂无员工</td></tr>
            <tr v-for="(u, i) in users" :key="u.id">
              <td>
                <div class="od-user-cell">
                  <div class="od-av" :class="'p' + ((i % 5) + 1)">{{ u.name?.charAt(0) ?? '?' }}</div>
                  <div class="od-u-name">{{ u.name }}</div>
                </div>
              </td>
              <td class="num">{{ u.username }}</td>
              <td>
                <span class="od-role-tag" :class="u.role === 'chairman' ? 'boss' : u.role === 'manager' ? 'mgr' : 'staff'">{{ roleLabel(u.role) }}</span>
              </td>
              <td><span class="od-dept-dot"></span>{{ u.department ?? '-' }}</td>
              <td class="num">{{ u.phone ?? '-' }}</td>
              <td>
                <span class="od-badge" :class="u.status === 'disabled' ? 'danger' : 'success'">
                  <span class="d"></span>{{ u.status === 'disabled' ? '禁用' : '启用' }}
                </span>
              </td>
              <td>
                <div class="od-ops">
                  <button class="od-btn-ghost" @click="toggleStatus(u)">{{ u.status === 'disabled' ? '启用' : '禁用' }}</button>
                  <button class="od-btn-ghost danger" @click="remove(u)">删除</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 新建弹窗:结构取 employees.html 的弹窗 -->
    <div v-if="showCreate" class="od-modal-mask" @click.self="showCreate = false">
      <div class="od-modal">
        <div class="od-modal-h">
          <h3>新建{{ isChairman ? '经理/员工' : '员工' }}</h3>
          <button class="od-modal-x" @click="showCreate = false" aria-label="关闭">✕</button>
        </div>
        <div class="od-modal-b">
          <div class="od-modal-grid">
            <div class="od-field"><label>姓名</label><input v-model="form.name" class="od-input" /></div>
            <div class="od-field"><label>账号</label><input v-model="form.username" class="od-input" /></div>
            <div class="od-field"><label>密码</label><input v-model="form.password" type="password" class="od-input" /></div>
            <div class="od-field">
              <label>角色</label>
              <select v-model="form.role" class="od-input">
                <option v-for="r in createableRoles" :key="r" :value="r">{{ roleLabel(r) }}</option>
              </select>
            </div>
            <div class="od-field"><label>部门</label><input v-model="form.department" class="od-input" /></div>
            <div class="od-field"><label>手机</label><input v-model="form.phone" class="od-input" /></div>
          </div>
          <div class="od-role-note">董事长可创建 <b>经理 / 员工</b>;经理仅可创建 <b>员工</b>,默认归属本部门。</div>
          <div v-if="err" class="od-err">{{ err }}</div>
        </div>
        <div class="od-modal-foot">
          <button class="od-btn-ghost" @click="showCreate = false">取消</button>
          <button class="od-btn-primary" :disabled="creating" @click="create">创建</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.od-employees {
  height: 100%;
  overflow: auto;
  padding: var(--od-space-6);
  background: var(--od-bg);
  color: var(--od-text);
  font-family: var(--od-font-sans);
  font-size: var(--od-text-base);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}
.od-employees * { box-sizing: border-box; }
.num { font-family: var(--od-font-mono); font-variant-numeric: tabular-nums; }

.od-card {
  background: var(--od-surface);
  border: 1px solid var(--od-border);
  border-radius: var(--od-radius-lg);
  box-shadow: var(--od-shadow-sm);
  overflow: hidden;
}

.od-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--od-space-4) var(--od-space-5);
  border-bottom: 1px solid var(--od-border);
  flex-wrap: wrap; gap: 10px;
}
.od-toolbar-left { display: flex; flex-direction: column; gap: 2px; }
.od-tb-title { font-size: var(--od-text-lg); font-weight: var(--od-weight-semibold); }
.od-tb-meta { font-size: var(--od-text-sm); color: var(--od-text-muted); }
.od-tb-meta b { color: var(--od-text); font-weight: var(--od-weight-medium); }
.od-toolbar-right { display: flex; align-items: center; gap: 10px; }
.od-scope {
  display: inline-flex; align-items: center;
  font-size: var(--od-text-xs); font-weight: var(--od-weight-semibold);
  letter-spacing: .04em; color: var(--od-primary);
  background: var(--od-primary-soft);
  padding: 5px 12px; border-radius: var(--od-radius-full);
}

.od-btn-primary, .od-btn-ghost {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: 36px; padding: 0 14px; border: none;
  border-radius: var(--od-radius-md);
  font-size: var(--od-text-sm); font-weight: var(--od-weight-medium);
  font-family: inherit; cursor: pointer; transition: all .15s;
}
.od-btn-primary { background: var(--od-primary); color: #fff; }
.od-btn-primary:hover { background: var(--od-primary-hover); }
.od-btn-primary:disabled { opacity: .5; cursor: not-allowed; }
.od-btn-ghost { background: var(--od-surface); border: 1px solid var(--od-border); color: var(--od-text); }
.od-btn-ghost:hover { background: var(--od-surface-2); }
.od-btn-ghost.danger { color: var(--od-danger); border-color: var(--od-danger-soft); }
.od-btn-ghost.danger:hover { background: var(--od-danger-soft); }

.od-table-wrap { overflow-x: auto; }
.od-table { width: 100%; border-collapse: collapse; font-size: var(--od-text-sm); }
.od-table thead th {
  text-align: left; font-weight: var(--od-weight-medium); color: var(--od-text-muted);
  font-size: var(--od-text-xs); padding: 11px var(--od-space-5);
  background: var(--od-surface-2); border-bottom: 1px solid var(--od-border); white-space: nowrap;
}
.od-table tbody td { padding: 12px var(--od-space-5); border-bottom: 1px solid var(--od-border); vertical-align: middle; }
.od-table tbody tr:last-child td { border-bottom: none; }
.od-table tbody tr:hover { background: var(--od-surface-2); }
.od-empty { text-align: center; color: var(--od-text-muted); padding: var(--od-space-6) !important; }

.od-user-cell { display: flex; align-items: center; gap: 10px; }
.od-av {
  width: 32px; height: 32px; border-radius: var(--od-radius-full);
  display: grid; place-items: center; color: #fff;
  font-size: 12px; font-weight: var(--od-weight-semibold); flex-shrink: 0;
}
.od-av.p1 { background: linear-gradient(135deg, var(--od-palette-1), color-mix(in oklab, var(--od-palette-1), black 20%)); }
.od-av.p2 { background: linear-gradient(135deg, var(--od-palette-2), var(--od-primary-hover)); }
.od-av.p3 { background: linear-gradient(135deg, var(--od-palette-3), color-mix(in oklab, var(--od-palette-3), black 20%)); }
.od-av.p4 { background: linear-gradient(135deg, var(--od-palette-4), color-mix(in oklab, var(--od-palette-4), black 20%)); }
.od-av.p5 { background: linear-gradient(135deg, var(--od-palette-5), color-mix(in oklab, var(--od-warning), black 25%)); }
.od-u-name { font-weight: var(--od-weight-medium); }

.od-role-tag {
  display: inline-flex; align-items: center; height: 22px; padding: 0 9px;
  border-radius: var(--od-radius-full); font-size: var(--od-text-xs); font-weight: var(--od-weight-medium);
}
.od-role-tag.boss { background: var(--od-gold-soft); color: color-mix(in oklab, var(--od-warning), black 25%); }
.od-role-tag.mgr { background: var(--od-primary-soft); color: var(--od-primary-hover); }
.od-role-tag.staff { background: var(--od-surface-2); color: var(--od-text-muted); }

.od-dept-dot {
  display: inline-block; width: 8px; height: 8px; border-radius: 2px;
  margin-right: 6px; vertical-align: middle; background: var(--od-text-muted);
}

.od-badge {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: var(--od-text-xs); font-weight: var(--od-weight-medium);
  padding: 3px 9px; border-radius: var(--od-radius-full);
}
.od-badge .d { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.od-badge.success { color: color-mix(in oklab, var(--od-success), black 20%); background: var(--od-success-soft); }
.od-badge.danger { color: color-mix(in oklab, var(--od-danger), black 20%); background: var(--od-danger-soft); }

.od-ops { display: flex; gap: 6px; white-space: nowrap; }
.od-ops .od-btn-ghost { height: 30px; padding: 0 10px; }

.od-err {
  color: var(--od-danger); background: var(--od-danger-soft);
  font-size: var(--od-text-sm); padding: 10px 14px;
  border-radius: var(--od-radius-md);
  margin: var(--od-space-3) var(--od-space-5) 0;
}
.od-modal-b .od-err { margin: var(--od-space-3) 0 0; }

.od-modal-mask {
  position: fixed; inset: 0; z-index: 50;
  background: rgba(15, 23, 42, .45); backdrop-filter: blur(1px);
  display: flex; align-items: center; justify-content: center; padding: var(--od-space-5);
}
.od-modal {
  width: 460px; max-width: 100%; background: var(--od-surface);
  border-radius: var(--od-radius-xl); box-shadow: var(--od-shadow-lg); overflow: hidden;
}
.od-modal-h {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--od-space-5) var(--od-space-6); border-bottom: 1px solid var(--od-border);
}
.od-modal-h h3 { font-size: var(--od-text-lg); font-weight: var(--od-weight-semibold); }
.od-modal-x {
  width: 30px; height: 30px; border: none; background: none; cursor: pointer;
  border-radius: var(--od-radius-sm); color: var(--od-text-muted);
  display: grid; place-items: center; font-size: 14px; line-height: 1;
}
.od-modal-x:hover { background: var(--od-surface-2); color: var(--od-text); }
.od-modal-b { padding: var(--od-space-5) var(--od-space-6); }
.od-modal-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--od-space-3) var(--od-space-4); }
.od-field { margin-bottom: var(--od-space-3); }
.od-field label { display: block; font-size: var(--od-text-sm); font-weight: var(--od-weight-medium); margin-bottom: 6px; }
.od-input {
  width: 100%; height: 38px; padding: 0 11px;
  background: var(--od-surface); border: 1px solid var(--od-border);
  border-radius: var(--od-radius-md); font-size: var(--od-text-sm);
  color: var(--od-text); font-family: inherit; transition: all .15s;
}
.od-input:focus { outline: none; border-color: var(--od-primary); box-shadow: 0 0 0 3px var(--od-primary-soft); }
select.od-input {
  appearance: none; padding-right: 30px;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.4'><path d='M6 9l6 6 6-6'/></svg>");
  background-repeat: no-repeat; background-position: right 10px center;
}
.od-role-note {
  font-size: var(--od-text-xs); color: var(--od-text-muted);
  background: var(--od-warning-soft); border-radius: var(--od-radius-sm);
  padding: 8px 10px; margin-top: 4px; display: flex; gap: 6px; align-items: flex-start;
}
.od-role-note b { color: var(--od-text); }
.od-modal-foot {
  display: flex; justify-content: flex-end; gap: 10px;
  padding: var(--od-space-4) var(--od-space-6);
  border-top: 1px solid var(--od-border); background: var(--od-surface-2);
}
</style>
