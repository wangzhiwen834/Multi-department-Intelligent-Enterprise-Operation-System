<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { api } from '../api';
import type { Shop, WorkbookListItem } from '../types';

const props = defineProps<{ shop: Shop }>();
const emit = defineEmits<{ (e: 'open', period: string): void; (e: 'back'): void }>();

const items = ref<WorkbookListItem[]>([]);
const err = ref('');
const msg = ref('');
const busy = ref(false);
const selectedPeriod = ref<string | null>(null);
const lockHolder = ref<string | null>(null);
const curPeriod = new Date().toISOString().slice(0, 7);
const showCreate = ref(false);
const newPeriod = ref(curPeriod);

async function load() {
  err.value = '';
  try { items.value = await api.listWorkbooks(props.shop.id); }
  catch (e: any) { err.value = e.message; }
}

onMounted(load);

// 按年分组,年倒序;每年内月倒序
const byYear = computed(() => {
  const m = new Map<string, WorkbookListItem[]>();
  for (const w of items.value) {
    const y = w.period.slice(0, 4);
    if (!m.has(y)) m.set(y, []);
    m.get(y)!.push(w);
  }
  return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([year, list]) => ({
    year,
    months: list.sort((a, b) => b.period.localeCompare(a.period)),
  }));
});
const expanded = ref<Set<string>>(new Set([curPeriod.slice(0, 4)]));
const toggleYear = (y: string) => { expanded.value.has(y) ? expanded.value.delete(y) : expanded.value.add(y); };

const selected = computed(() => items.value.find(w => w.period === selectedPeriod.value) ?? null);
const prevPeriod = computed(() => {
  if (!selectedPeriod.value) return null;
  const [y, m] = selectedPeriod.value.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
});
const hasPrev = computed(() => prevPeriod.value ? items.value.some(w => w.period === prevPeriod.value) : false);

function pick(period: string) {
  selectedPeriod.value = period;
  lockHolder.value = items.value.find(x => x.period === period)?.lockedBy ?? null;
}

function toggleCreate() {
  showCreate.value = !showCreate.value;
  if (showCreate.value) newPeriod.value = curPeriod;
}

async function createNew() {
  if (items.value.some(w => w.period === newPeriod.value)) {
    msg.value = `${newPeriod.value} 工作簿已存在`;
    return;
  }
  busy.value = true; msg.value = '';
  try {
    await api.createWorkbook(props.shop.id, newPeriod.value);
    await load();
    pick(newPeriod.value);
    showCreate.value = false;
    msg.value = `已创建 ${newPeriod.value} 工作簿`;
  } catch (e: any) { msg.value = e.message; } finally { busy.value = false; }
}

function cancelCreate() { showCreate.value = false; }

async function copyFromPrev() {
  if (!selected.value || !prevPeriod.value) return;
  const period = selectedPeriod.value;
  busy.value = true; msg.value = '';
  try { await api.copyFromWorkbook(selected.value.id, prevPeriod.value); await load(); if (period) pick(period); msg.value = '已从上月复制表头新建'; }
  catch (e: any) { msg.value = e.message; } finally { busy.value = false; }
}

async function remove() {
  if (!selected.value) return;
  if (!confirm(`确认删除 ${selected.value.period} 工作簿？(软删除,大屏历史数据保留)`)) return;
  busy.value = true; msg.value = '';
  try { await api.deleteWorkbook(selected.value.id); selectedPeriod.value = null; await load(); msg.value = '已删除'; }
  catch (e: any) { msg.value = e.message; } finally { busy.value = false; }
}
</script>

<template>
  <div class="wm">
    <nav class="wm-crumb"><a href="#" @click.prevent="emit('back')">公司经营</a><span class="sep">/</span><b>{{ shop.name }}</b></nav>
    <div v-if="err" class="wm-err">{{ err }}</div>
    <div class="wm-body">
      <aside class="wm-tree">
        <div class="wm-tree-head">
          <span>{{ shop.name }}</span>
          <button class="wm-btn-primary" @click="toggleCreate" title="新建工作簿">+ 新建工作簿</button>
        </div>
        <div v-if="showCreate" class="wm-create">
          <input type="month" v-model="newPeriod" class="wm-month" />
          <div class="wm-create-btns">
            <button class="wm-btn-primary" :disabled="busy" @click="createNew">创建</button>
            <button class="wm-btn-ghost" @click="cancelCreate">取消</button>
          </div>
        </div>
        <div v-if="!byYear.length && !err" class="wm-empty">该店还没有工作簿,点「新建工作簿」开始</div>
        <div v-for="g in byYear" :key="g.year" class="wm-year">
          <button class="wm-year-btn" @click="toggleYear(g.year)">
            <span class="wm-tri">{{ expanded.has(g.year) ? '▼' : '▶' }}</span>{{ g.year }} 年
          </button>
          <div v-show="expanded.has(g.year)" class="wm-months">
            <button v-for="w in g.months" :key="w.period"
              class="wm-month" :class="{ active: w.period === selectedPeriod, cur: w.period === curPeriod }"
              @click="pick(w.period)">
              <span class="wm-m-name">{{ Number(w.period.slice(5, 7)) }} 月</span>
              <span v-if="w.lockedBy" class="wm-lock" :title="`${w.lockedBy} 编辑中`">●</span>
              <span v-if="w.period === curPeriod" class="wm-cur-tag">当前</span>
            </button>
          </div>
        </div>
      </aside>

      <section class="wm-detail">
        <template v-if="selected">
          <div class="wm-d-head">
            <h3>{{ Number(selected.period.slice(5, 7)) }} 月工作簿</h3>
            <span v-if="lockHolder" class="wm-lock-badge">{{ lockHolder }} 编辑中</span>
            <span v-else class="wm-view-badge">查看</span>
          </div>
          <div class="wm-d-meta">最近保存：{{ selected.updated_at?.slice(0, 16).replace('T', ' ') || '-' }}</div>
          <div class="wm-d-actions">
            <button class="wm-btn-primary" @click="emit('open', selected.period)">打开工作簿</button>
            <button class="wm-btn-ghost" :disabled="!hasPrev || busy" @click="copyFromPrev" :title="hasPrev ? `从 ${prevPeriod} 复制表头` : '无上月工作簿'">从上月复制表头</button>
            <button class="wm-btn-danger" :disabled="busy" @click="remove">删除</button>
          </div>
          <div v-if="msg" class="wm-msg">{{ msg }}</div>
        </template>
        <div v-else class="wm-detail-empty">从左侧选择一个月份</div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.wm { font-family: var(--od-font-sans); color: var(--od-text); height: 100%; display: flex; flex-direction: column; }
.wm-crumb { display: flex; align-items: center; gap: 8px; font-size: var(--od-text-sm); margin-bottom: var(--od-space-4); color: var(--od-text-muted); }
.wm-crumb a { color: var(--od-text-muted); text-decoration: none; }
.wm-crumb a:hover { color: var(--od-primary); }
.wm-crumb b { color: var(--od-text); font-weight: var(--od-weight-semibold); }
.wm-crumb .sep { color: var(--od-border); }
.wm-err { color: var(--od-danger); background: var(--od-danger-soft); padding: 10px 14px; border-radius: var(--od-radius-md); margin-bottom: var(--od-space-4); font-size: var(--od-text-sm); }
.wm-body { flex: 1; min-height: 0; display: grid; grid-template-columns: 280px 1fr; gap: var(--od-space-5); }
.wm-tree { background: var(--od-surface); border: 1px solid var(--od-border); border-radius: var(--od-radius-lg); padding: var(--od-space-4); overflow-y: auto; }
.wm-tree-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--od-space-3); font-weight: var(--od-weight-semibold); gap: 8px; }
.wm-empty { color: var(--od-text-muted); font-size: var(--od-text-sm); padding: var(--od-space-4) 0; }
.wm-year { margin-bottom: var(--od-space-2); }
.wm-year-btn { display: flex; align-items: center; gap: 6px; width: 100%; background: none; border: none; color: var(--od-text); font-weight: var(--od-weight-semibold); font-family: inherit; font-size: var(--od-text-base); padding: 6px 4px; cursor: pointer; }
.wm-tri { font-size: 10px; color: var(--od-text-muted); }
.wm-months { padding-left: 16px; }
.wm-month { display: flex; align-items: center; gap: 8px; width: 100%; background: none; border: none; font-family: inherit; color: var(--od-text); font-size: var(--od-text-sm); padding: 7px 8px; border-radius: var(--od-radius-md); cursor: pointer; }
.wm-month:hover { background: var(--od-surface-2); }
.wm-month.active { background: var(--od-primary-soft); color: var(--od-primary); font-weight: var(--od-weight-semibold); }
.wm-m-name { flex: 1; text-align: left; }
.wm-lock { color: var(--od-warning); font-size: 10px; }
.wm-cur-tag { font-size: 10px; color: var(--od-primary); border: 1px solid var(--od-primary); border-radius: 4px; padding: 0 4px; }
.wm-detail { background: var(--od-surface); border: 1px solid var(--od-border); border-radius: var(--od-radius-lg); padding: var(--od-space-6); display: flex; flex-direction: column; gap: var(--od-space-4); }
.wm-d-head { display: flex; align-items: center; gap: 10px; }
.wm-d-head h3 { margin: 0; font-size: var(--od-text-lg); }
.wm-lock-badge { background: var(--od-surface-2); border: 1px solid var(--od-border); color: var(--od-warning); font-size: var(--od-text-sm); padding: 2px 10px; border-radius: var(--od-radius-md); }
.wm-view-badge { color: var(--od-text-muted); font-size: var(--od-text-sm); }
.wm-d-meta { color: var(--od-text-muted); font-size: var(--od-text-sm); }
.wm-d-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.wm-detail-empty { color: var(--od-text-muted); display: grid; place-items: center; flex: 1; }
.wm-msg { color: var(--od-primary-hover); background: var(--od-primary-soft); padding: 8px 12px; border-radius: var(--od-radius-md); font-size: var(--od-text-sm); }
.wm-btn-primary, .wm-btn-ghost, .wm-btn-danger { height: 34px; padding: 0 14px; border-radius: var(--od-radius-md); font-family: inherit; font-size: var(--od-text-sm); font-weight: var(--od-weight-medium); cursor: pointer; transition: all .15s; }
.wm-btn-primary { background: var(--od-primary); color: #fff; border: none; }
.wm-btn-primary:hover { background: var(--od-primary-hover); }
.wm-btn-ghost { background: var(--od-surface); color: var(--od-text); border: 1px solid var(--od-border); }
.wm-btn-ghost:hover { background: var(--od-surface-2); }
.wm-btn-danger { background: var(--od-surface); color: var(--od-danger); border: 1px solid var(--od-border); }
.wm-btn-danger:hover { background: var(--od-danger-soft); border-color: var(--od-danger); }
.wm-btn-primary:disabled, .wm-btn-ghost:disabled, .wm-btn-danger:disabled { opacity: .5; cursor: not-allowed; }
.wm-create { display: flex; flex-direction: column; gap: 8px; margin-bottom: var(--od-space-3); padding: var(--od-space-3); background: var(--od-surface-2); border-radius: var(--od-radius-md); }
.wm-create-btns { display: flex; gap: 8px; }
.wm-create-btns .wm-btn-primary, .wm-create-btns .wm-btn-ghost { height: 30px; padding: 0 10px; }
input.wm-month { display: inline-flex; align-items: center; height: 34px; padding: 0 12px; border: 1px solid var(--od-border); border-radius: var(--od-radius-md); background: var(--od-surface); font-family: inherit; font-size: var(--od-text-sm); font-weight: var(--od-weight-medium); color: var(--od-text); cursor: pointer; transition: border-color .15s ease; }
input.wm-month:hover { border-color: var(--od-primary); }
@media (max-width: 760px) { .wm-body { grid-template-columns: 1fr; } }
</style>
