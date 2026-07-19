<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { api } from '../api';
import type { AuditLogEntry } from '../types';

const ACTION_LABELS: Record<string, string> = {
  'login': '登录',
  'workbook.save': '保存表格',
  'workbook.sync': '数据同步',
  'ai.chat': 'AI 对话',
  'user.create': '新建用户',
  'user.update': '更新用户',
  'user.delete': '禁用用户',
  'poster.generate': '生成海报',
};
const actionLabel = (a: string) => ACTION_LABELS[a] ?? a;

const items = ref<AuditLogEntry[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(50);
const loading = ref(false);
const err = ref('');

const fAction = ref('');
const fResult = ref('');
const fq = ref('');
const fFrom = ref('');
const fTo = ref('');

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)));
const fromIdx = computed(() => total.value === 0 ? 0 : (page.value - 1) * pageSize.value + 1);
const toIdx = computed(() => Math.min(total.value, page.value * pageSize.value));

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

const load = async () => {
  loading.value = true; err.value = '';
  try {
    const r = await api.auditLogs({ page: page.value, pageSize: pageSize.value, action: fAction.value, result: fResult.value, q: fq.value, from: fFrom.value, to: fTo.value });
    items.value = r.items; total.value = r.total;
  } catch (e: any) { err.value = e.message; } finally { loading.value = false; }
};
const search = () => { page.value = 1; load(); };
const reset = () => { fAction.value = ''; fResult.value = ''; fq.value = ''; fFrom.value = ''; fTo.value = ''; page.value = 1; load(); };
const goPage = (p: number) => { if (p < 1 || p > totalPages.value || p === page.value) return; page.value = p; load(); };
onMounted(load);
</script>

<template>
  <div class="od-audit">
    <div class="card">
      <div class="card-h">
        <div>
          <div class="title">操作日志</div>
          <div class="sub">记录用户在系统中的关键操作;仅董事长 / 经理可见。</div>
        </div>
        <button class="btn-ghost" @click="load" :disabled="loading">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6"/></svg>
          刷新
        </button>
      </div>

      <!-- 过滤 -->
      <div class="filters">
        <select v-model="fAction" class="sel" @change="search">
          <option value="">全部操作</option>
          <option v-for="(lbl, key) in ACTION_LABELS" :key="key" :value="key">{{ lbl }}</option>
        </select>
        <select v-model="fResult" class="sel" @change="search">
          <option value="">全部结果</option>
          <option value="success">成功</option>
          <option value="failed">失败</option>
        </select>
        <input v-model="fq" class="inp" placeholder="搜索 用户 / IP / 对象 / 操作" @keyup.enter="search" />
        <input v-model="fFrom" type="date" class="inp dt" title="起始日期" />
        <span class="dash">~</span>
        <input v-model="fTo" type="date" class="inp dt" title="截止日期" />
        <button class="btn-primary" @click="search">查询</button>
        <button class="btn-ghost" @click="reset">重置</button>
      </div>

      <div v-if="err" class="err-box">{{ err }}</div>

      <!-- 表格 -->
      <div class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr><th class="c-time">时间</th><th class="c-user">用户</th><th class="c-ip">IP</th><th class="c-act">操作</th><th>对象</th><th class="c-res">结果</th></tr>
          </thead>
          <tbody>
            <tr v-if="loading"><td colspan="6" class="empty">加载中…</td></tr>
            <tr v-else-if="!items.length"><td colspan="6" class="empty">暂无日志记录</td></tr>
            <tr v-for="row in items" :key="row.id">
              <td class="c-time mono">{{ fmtTime(row.created_at) }}</td>
              <td class="c-user">{{ row.user_name || '-' }}</td>
              <td class="c-ip mono">{{ row.ip || '-' }}</td>
              <td class="c-act"><span class="act-tag">{{ actionLabel(row.action) }}</span></td>
              <td class="c-target" :title="row.target ?? ''">{{ row.target || '-' }}</td>
              <td class="c-res"><span class="badge" :class="row.result">{{ row.result === 'failed' ? '失败' : '成功' }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 分页 -->
      <div class="pager">
        <span class="pg-info">共 <b>{{ total }}</b> 条 · 第 {{ fromIdx }}-{{ toIdx }} 条</span>
        <div class="pg-btns">
          <button class="pg-btn" :disabled="page <= 1" @click="goPage(page - 1)">上一页</button>
          <span class="pg-num">{{ page }} / {{ totalPages }}</span>
          <button class="pg-btn" :disabled="page >= totalPages" @click="goPage(page + 1)">下一页</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.od-audit, .od-audit * { box-sizing: border-box; }
.od-audit { font-family: var(--od-font-sans); color: var(--od-text); }
.card { background: var(--od-surface); border: 1px solid var(--od-border); border-radius: var(--od-radius-lg); box-shadow: var(--od-shadow-sm); padding: var(--od-space-5); }
.card-h { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--od-space-4); margin-bottom: var(--od-space-4); }
.title { font-size: var(--od-text-xl); font-weight: var(--od-weight-semibold); }
.sub { font-size: var(--od-text-sm); color: var(--od-text-muted); margin-top: 2px; }

.filters { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: var(--od-space-4); }
.sel, .inp { height: 38px; padding: 0 12px; background: var(--od-surface); border: 1px solid var(--od-border); border-radius: var(--od-radius-md); font-size: var(--od-text-sm); color: var(--od-text); font-family: inherit; }
.inp { min-width: 220px; flex: 1; }
.inp.dt { min-width: 140px; flex: 0 0 140px; }
.dash { color: var(--od-text-muted); }
.sel:focus, .inp:focus { outline: none; border-color: var(--od-primary); box-shadow: 0 0 0 3px var(--od-primary-soft); }
.btn-primary, .btn-ghost { height: 38px; padding: 0 14px; border-radius: var(--od-radius-md); font-size: var(--od-text-sm); font-weight: var(--od-weight-semibold); cursor: pointer; border: 1px solid var(--od-border); }
.btn-primary { background: var(--od-primary); color: #fff; border-color: var(--od-primary); }
.btn-primary:hover { background: var(--od-primary-hover); }
.btn-ghost { background: var(--od-surface); color: var(--od-text); }
.btn-ghost:hover:not(:disabled) { background: var(--od-surface-2); }
.btn-ghost:disabled { opacity: .5; cursor: not-allowed; }

.err-box { font-size: var(--od-text-sm); color: var(--od-danger); background: var(--od-danger-soft); border: 1px solid color-mix(in oklab, var(--od-danger), white 35%); border-radius: var(--od-radius-md); padding: 8px 12px; margin-bottom: var(--od-space-4); }

.tbl-wrap { overflow-x: auto; border: 1px solid var(--od-border); border-radius: var(--od-radius-md); }
.tbl { width: 100%; border-collapse: collapse; font-size: var(--od-text-sm); }
.tbl thead th { background: var(--od-surface-2); color: var(--od-text-muted); font-weight: var(--od-weight-medium); text-align: left; padding: 10px 12px; white-space: nowrap; border-bottom: 1px solid var(--od-border); }
.tbl tbody td { padding: 9px 12px; border-bottom: 1px solid var(--od-border); vertical-align: middle; }
.tbl tbody tr:last-child td { border-bottom: none; }
.tbl tbody tr:hover { background: var(--od-surface-2); }
.c-time { white-space: nowrap; } .c-user { white-space: nowrap; } .c-ip { white-space: nowrap; color: var(--od-text-muted); } .c-act { white-space: nowrap; } .c-res { white-space: nowrap; }
.c-target { max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--od-text-muted); }
.mono { font-family: var(--od-font-mono); }
.empty { text-align: center; color: var(--od-text-muted); padding: 28px 0; }
.act-tag { display: inline-block; padding: 2px 8px; border-radius: var(--od-radius-full); background: var(--od-primary-soft); color: var(--od-primary-hover); font-size: var(--od-text-xs); font-weight: var(--od-weight-medium); }
.badge { display: inline-block; padding: 2px 9px; border-radius: var(--od-radius-full); font-size: var(--od-text-xs); font-weight: var(--od-weight-medium); }
.badge.success { background: var(--od-success-soft); color: var(--od-success); }
.badge.failed { background: var(--od-danger-soft); color: var(--od-danger); }

.pager { display: flex; align-items: center; justify-content: space-between; gap: var(--od-space-3); margin-top: var(--od-space-4); flex-wrap: wrap; }
.pg-info { font-size: var(--od-text-sm); color: var(--od-text-muted); }
.pg-info b { color: var(--od-text); }
.pg-btns { display: flex; align-items: center; gap: 8px; }
.pg-btn { height: 34px; padding: 0 12px; border: 1px solid var(--od-border); border-radius: var(--od-radius-md); background: var(--od-surface); color: var(--od-text); font-size: var(--od-text-sm); cursor: pointer; }
.pg-btn:hover:not(:disabled) { background: var(--od-surface-2); }
.pg-btn:disabled { opacity: .5; cursor: not-allowed; }
.pg-num { font-size: var(--od-text-sm); color: var(--od-text-muted); font-family: var(--od-font-mono); min-width: 56px; text-align: center; }
</style>
