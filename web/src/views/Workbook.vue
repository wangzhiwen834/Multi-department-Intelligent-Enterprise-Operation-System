<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { api } from '../api';
import { setupUniver, buildFromTemplate, extractForSync } from '../univer';
import type { Shop, Template, SyncResult, User } from '../types';

const props = defineProps<{ shop: Shop; period: string }>();
const emit = defineEmits<{ (e: 'update:period', p: string): void; (e: 'back'): void }>();

const containerRef = ref<HTMLDivElement | null>(null);
let univerHandle: ReturnType<typeof setupUniver> | null = null;
let fwb: any = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let wbId = 0;
let tpl: Template | null = null;
let me: User | null = null;

const editing = ref(false);
const holder = ref<string | null>(null);
const msg = ref('');
const syncResult = ref<SyncResult | null>(null);
const busy = ref(false);

const SHEET_KEY = 'daily_ops';

const stopHeartbeat = () => { if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; } };
const releaseIfMine = async () => { stopHeartbeat(); try { await api.releaseLock(wbId, SHEET_KEY); } catch { /* ignore */ } };

const startHeartbeat = () => {
  stopHeartbeat();
  heartbeatTimer = setInterval(async () => {
    try {
      const h = await api.heartbeat(wbId, SHEET_KEY);
      if (!h.renewed) { editing.value = false; holder.value = '他人'; stopHeartbeat(); msg.value = '锁已失效,请重新获取'; }
    } catch {
      stopHeartbeat(); editing.value = false; msg.value = '心跳失败,锁可能已失效';
    }
  }, 15000);
};

const startEdit = async () => {
  try {
    const r = await api.acquireLock(wbId, SHEET_KEY);
    if (r.acquired) { editing.value = true; holder.value = null; startHeartbeat(); }
    else holder.value = r.heldBy?.user_name ?? '他人';
  } catch (e: any) { msg.value = e.message; }
};
const endEdit = async () => { await releaseIfMine(); editing.value = false; holder.value = null; };
const takeover = async () => {
  try {
    const r = await api.takeoverLock(wbId, SHEET_KEY);
    if (r.acquired) { editing.value = true; holder.value = null; startHeartbeat(); }
    else holder.value = r.heldBy?.user_name ?? '他人';
  } catch (e: any) { msg.value = e.message; }
};
const save = async () => {
  if (!editing.value) { msg.value = '请先进入编辑(获取锁)'; return; }
  busy.value = true; msg.value = '';
  try {
    const snapshot = fwb.save();
    await api.putSnapshot(wbId, snapshot);
    const { dailyMetrics, expenses } = extractForSync(fwb, tpl!.definition);
    const res = await api.sync(wbId, { dailyMetrics, expenses });
    syncResult.value = res;
    msg.value = `已保存并同步${res.errors.length ? `,${res.errors.length} 项校验错误` : ''}`;
  } catch (e: any) { msg.value = e.message; } finally { busy.value = false; }
};

onMounted(async () => {
  me = await api.me().catch(() => null);
  const wb = await api.createWorkbook(props.shop.id, props.period);
  wbId = wb.id;
  tpl = await api.template(props.shop.business_code);
  const snap = await api.getSnapshot(wb.id);
  const handle = setupUniver(containerRef.value!);
  univerHandle = handle;
  fwb = snap?.data ? handle.univerAPI.createWorkbook(snap.data as any) : buildFromTemplate(handle.univerAPI, tpl.definition, `${props.shop.name} ${props.period}`);
  const st = await api.lockStatus(wb.id, SHEET_KEY);
  if ((st as any).held === false) { holder.value = null; editing.value = false; }
  else if ((st as any).user_name && (st as any).user_name !== me?.username) holder.value = (st as any).user_name;
  else holder.value = null;
});
onBeforeUnmount(() => { void releaseIfMine(); univerHandle?.dispose(); });
</script>

<template>
  <div class="flex h-full flex-col bg-slate-900 text-slate-100">
    <header class="flex flex-wrap items-center gap-3 border-b border-slate-700/50 p-3 text-sm">
      <button @click="emit('back')" class="text-cyan-400 hover:text-cyan-300">← 返回</button>
      <input type="month" :value="period" @change="emit('update:period', ($event.target as HTMLInputElement).value)" class="rounded-lg bg-slate-800 px-3 py-1.5" />
      <span class="font-medium">{{ shop.name }}</span>
      <span v-if="editing" class="rounded bg-green-500/20 px-2 py-0.5 text-xs text-green-400">编辑中</span>
      <span v-else-if="holder" class="rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400">只读 · {{ holder }} 正在编辑</span>
      <span v-else class="rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-300">查看</span>
      <div class="flex-1"></div>
      <button v-if="!editing && !holder" @click="startEdit" class="rounded-lg bg-cyan-500 px-4 py-1.5 font-medium text-white hover:bg-cyan-400">编辑</button>
      <button v-if="editing" @click="endEdit" class="rounded-lg bg-slate-700 px-4 py-1.5 hover:bg-slate-600">退出编辑</button>
      <button v-if="holder" @click="takeover" class="rounded-lg bg-amber-500 px-4 py-1.5 font-medium text-white hover:bg-amber-400">接管</button>
      <button @click="save" :disabled="!editing || busy" class="rounded-lg bg-green-500 px-4 py-1.5 font-medium text-white hover:bg-green-400 disabled:opacity-40">保存并同步</button>
    </header>
    <div v-if="msg" class="bg-slate-800/60 px-4 py-1.5 text-sm text-cyan-300">{{ msg }}</div>
    <div v-if="syncResult?.errors.length" class="bg-red-900/30 px-4 py-2 text-xs text-red-300">
      校验错误:<span v-for="(e, i) in syncResult.errors" :key="i" class="mr-3">{{ e.sheetKey }}/{{ e.date }} {{ e.key }}:{{ e.msg }}</span>
    </div>
    <div ref="containerRef" class="flex-1"></div>
  </div>
</template>
