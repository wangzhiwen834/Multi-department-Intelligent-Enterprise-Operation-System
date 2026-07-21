<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { api } from '../api';
import { setupUniver, buildFromTemplate } from '../univer';
import { exportWorkbookToXlsx, importXlsxToWorkbook } from '../sheet-io';
import type { Shop, Template, ExtractResult, User } from '../types';

const props = defineProps<{ shop: Shop; period: string }>();
const emit = defineEmits<{ (e: 'update:period', p: string): void; (e: 'back'): void }>();

const containerRef = ref<HTMLDivElement | null>(null);
let univerHandle: ReturnType<typeof setupUniver> | null = null;
let fwb: any = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let wbId = 0;
let tpl: Template | null = null;
const me = ref<User | null>(null);

// bootstrap 已带 lockStatus,onMounted 复用避免重复请求;mountUniver 每次重建时刷新
let bootLockStatus: any = null;

const editing = ref(false);
const holder = ref<string | null>(null);
const msg = ref('');
const extractResult = ref<ExtractResult | null>(null);

// AI 抽取进度可视化(SSE 事件驱动)
interface ProgressSheet { key: string; label: string; state: 'pending' | 'active' | 'done'; rowsOut?: number; errorCount?: number }
const extracting = ref(false);
const progress = ref<{ sheets: ProgressSheet[]; writing: boolean } | null>(null);
const onProgress = (e: any) => {
  if (e.stage === 'start') {
    progress.value = { sheets: (e.sheets as { key: string; label: string }[]).map(s => ({ key: s.key, label: s.label, state: 'pending' as const })), writing: false };
  } else if (e.stage === 'sheet_start' && progress.value) {
    const sh = progress.value.sheets.find(s => s.key === e.key);
    if (sh) sh.state = 'active';
  } else if (e.stage === 'sheet_done' && progress.value) {
    const sh = progress.value.sheets.find(s => s.key === e.key);
    if (sh) { sh.state = 'done'; sh.rowsOut = e.rowsOut; sh.errorCount = e.errorCount; }
  } else if (e.stage === 'write' && progress.value) {
    progress.value.writing = true;
  }
};
const busy = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);

const SHEET_KEY = 'daily_ops';

// Univer 表格是否可编辑(仅持有锁时可编辑,否则只读)
const setEditable = (v: boolean) => { try { (fwb as any)?.setEditable?.(v); } catch { /* ignore */ } };
// editing 变化时同步 Univer 可编辑态;并取消挂载时延迟设只读的定时器(避免与编辑冲突)
let initReadOnlyTimer: ReturnType<typeof setTimeout> | null = null;
watch(editing, (v) => {
  if (initReadOnlyTimer) { clearTimeout(initReadOnlyTimer); initReadOnlyTimer = null; }
  setEditable(v);
  if (v) stopStatusPoll(); else startStatusPoll();
});

const stopHeartbeat = () => { if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; } };
const releaseIfMine = async () => { stopHeartbeat(); try { await api.releaseLock(wbId, SHEET_KEY); } catch { /* ignore */ } };

const startHeartbeat = () => {
  stopHeartbeat();
  heartbeatTimer = setInterval(async () => {
    try {
      const h = await api.heartbeat(wbId, SHEET_KEY);
      if (!h.renewed) {
        const who = h.heldBy?.user_name ?? '他人';
        editing.value = false; holder.value = who; stopHeartbeat(); setEditable(false);
        msg.value = `被 ${who} 接管,你已失去编辑权`;
      } else if (h.takeoverRequest) {
        // 有人请求接管:先自动保存再让出(保存时仍持有锁,无竞态)
        stopHeartbeat();
        const who = h.takeoverRequest.user_name;
        msg.value = `${who} 请求接管,正在保存…`;
        try {
          await persistSnapshot();
          await api.yieldLock(wbId, SHEET_KEY);
          editing.value = false; holder.value = who; setEditable(false);
          msg.value = `已保存并让出编辑权,被 ${who} 接管`;
        } catch (e: any) {
          msg.value = `自动保存/让出失败:${e.message}`;
        }
      }
    } catch {
      stopHeartbeat(); editing.value = false; msg.value = '心跳失败,锁可能已失效';
    }
  }, 5000);
};

const startEdit = async () => {
  try {
    const r = await api.acquireLock(wbId, SHEET_KEY);
    if (r.acquired) { editing.value = true; holder.value = null; startHeartbeat(); setEditable(true); }
    else holder.value = r.heldBy?.user_name ?? '他人';
  } catch (e: any) { msg.value = e.message; }
};
const endEdit = async () => { await releaseIfMine(); editing.value = false; holder.value = null; setEditable(false); };
let takeoverPoll: ReturnType<typeof setInterval> | null = null;
const stopTakeoverPoll = () => { if (takeoverPoll) { clearInterval(takeoverPoll); takeoverPoll = null; } };
const startTakeoverPoll = () => {
  stopTakeoverPoll();
  takeoverPoll = setInterval(async () => {
    try {
      const st: any = await api.lockStatus(wbId, SHEET_KEY);
      if (st.user_name && st.user_name === me.value?.username) {
        stopTakeoverPoll();
        await mountUniver();  // 重载快照(含被接管者刚保存的数据)
        editing.value = true; holder.value = null; startHeartbeat(); setEditable(true);
        msg.value = '已接管,可编辑';
      } else if (st.held === false) {
        // 对方离线、锁已过期 -> 直接占取
        stopTakeoverPoll();
        const r = await api.acquireLock(wbId, SHEET_KEY);
        if (r.acquired) {
          await mountUniver();  // 重载快照
          editing.value = true; holder.value = null; startHeartbeat(); setEditable(true); msg.value = '已接管,可编辑';
        }
      }
    } catch { /* 继续轮询 */ }
  }, 3000);
};
// 查看态(未编辑)轮询锁状态,让旁观者及时看到"XXX 编辑中"
let statusPoll: ReturnType<typeof setInterval> | null = null;
const stopStatusPoll = () => { if (statusPoll) { clearInterval(statusPoll); statusPoll = null; } };
const startStatusPoll = () => {
  stopStatusPoll();
  statusPoll = setInterval(async () => {
    if (editing.value || takeoverPoll) return;
    try {
      const st: any = await api.lockStatus(wbId, SHEET_KEY);
      if (st.held === false) holder.value = null;
      else if (st.user_name && st.user_name !== me.value?.username) holder.value = st.user_name;
      else holder.value = null;
    } catch { /* ignore */ }
  }, 1000);
};
const takeover = async () => {
  try {
    const r = await api.takeoverLock(wbId, SHEET_KEY);
    if (r.acquired) { editing.value = true; holder.value = null; startHeartbeat(); msg.value = '已接管,可编辑'; }
    else if (r.pending) {
      holder.value = r.heldBy?.user_name ?? '他人';
      msg.value = `已请求接管,等待 ${holder.value} 保存…`;
      startTakeoverPoll();
    } else { holder.value = r.heldBy?.user_name ?? '他人'; msg.value = '对方仍持有,暂无法接管'; }
  } catch (e: any) { msg.value = e.message; }
};
// 仅存快照(接管自动保存用,不调 LLM,避免浪费)
const persistSnapshot = async () => {
  try { await (fwb as any)?.endEditingAsync?.(true); } catch { /* 提交当前单元格 */ }
  const snapshot = fwb.save();
  await api.putSnapshot(wbId, snapshot);
};
// 保存并 AI 抽取(编辑者持锁;保留 v1「保存即进大屏」即时性)
const save = async () => {
  if (!editing.value) { msg.value = '请先进入编辑(获取锁)'; return; }
  busy.value = true; msg.value = ''; progress.value = null; extracting.value = true;
  try {
    await persistSnapshot();
    const res = await api.extractWorkbookStream(wbId, 'save', onProgress);
    extractResult.value = res;
    msg.value = res.ok
      ? `已保存并抽取 ${res.extracted.dailyMetrics} 条日报、${res.extracted.expenses} 条费用${res.errors.length ? `,${res.errors.length} 项校验错误` : ''}`
      : (res.configured === false ? 'AI 未配置,请联系管理员' : `抽取失败:${res.error}`);
  } catch (e: any) { msg.value = e.message; } finally { busy.value = false; extracting.value = false; }
};
// 经理手动 AI 抽取(免锁,基于上次保存的快照刷新大屏)
const manualExtract = async () => {
  busy.value = true; msg.value = ''; progress.value = null; extracting.value = true;
  try {
    const res = await api.extractWorkbookStream(wbId, 'manual', onProgress);
    extractResult.value = res;
    msg.value = res.ok
      ? `AI 抽取完成:${res.extracted.dailyMetrics} 条日报、${res.extracted.expenses} 条费用${res.errors.length ? `,${res.errors.length} 项校验错误` : ''}`
      : (res.configured === false ? 'AI 未配置,请联系管理员' : `抽取失败:${res.error}`);
  } catch (e: any) { msg.value = e.message; } finally { busy.value = false; extracting.value = false; }
};

// 导出当前工作簿为 Excel(.xlsx,含样式),查看态也可用
const exportXlsx = async () => {
  if (!fwb) { msg.value = '工作簿未就绪'; return; }
  try {
    await exportWorkbookToXlsx(fwb, `${props.shop.name}_${props.period}.xlsx`);
    msg.value = '已导出 Excel 文件(含样式)';
  } catch (e: any) { msg.value = `导出失败:${e.message}`; }
};
// 导入 Excel:需编辑态(持锁);用导入内容构建新工作簿快照并重建(保留样式);导入后不自动保存,由用户检查后手动保存
const pickImport = () => {
  if (!editing.value) { msg.value = '请先进入编辑(获取锁)再导入'; return; }
  fileInputRef.value?.click();
};
const onImportFile = async (e: Event) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file || !tpl) return;
  busy.value = true; msg.value = '';
  try {
    const buf = await file.arrayBuffer();
    const snapshot = await importXlsxToWorkbook(buf, tpl!.definition, `${props.shop.name} ${props.period}`);
    mountWithSnapshot(snapshot);
    msg.value = `已导入,请检查后点「保存并同步」`;
  } catch (e: any) { msg.value = `导入失败:${e.message}`; } finally {
    busy.value = false;
    input.value = '';
  }
};

const mountUniver = async () => {
  const boot = await api.bootstrapWorkbook(props.shop.id, props.period);
  wbId = boot.wbId;
  tpl = boot.template;
  bootLockStatus = boot.lockStatus ?? null;
  if (univerHandle) univerHandle.dispose();
  const handle = setupUniver(containerRef.value!);
  univerHandle = handle;
  if (boot.snapshot?.data) {
    fwb = handle.univerAPI.createWorkbook(boot.snapshot.data as any);
  } else {
    fwb = buildFromTemplate(handle.univerAPI, tpl.definition, `${props.shop.name} ${props.period}`);
  }
  initReadOnlyTimer = setTimeout(() => { initReadOnlyTimer = null; setEditable(false); }, 150);
};
// 用指定快照重建工作簿(导入用):dispose 旧实例 -> createWorkbook(snapshot) -> 按当前编辑态设可编辑
const mountWithSnapshot = (snapshot: any) => {
  if (initReadOnlyTimer) { clearTimeout(initReadOnlyTimer); initReadOnlyTimer = null; }
  if (univerHandle) univerHandle.dispose();
  const handle = setupUniver(containerRef.value!);
  univerHandle = handle;
  fwb = handle.univerAPI.createWorkbook(snapshot);
  initReadOnlyTimer = setTimeout(() => { initReadOnlyTimer = null; setEditable(editing.value); }, 150);
};
onMounted(async () => {
  me.value = await api.me().catch(() => null);
  await mountUniver();
  // 复用 bootstrap 已返回的 lockStatus,避免 onMounted 再发一次 lockStatus 请求
  const st: any = bootLockStatus ?? { held: false };
  if (st.held === false) { holder.value = null; editing.value = false; }
  else if (st.user_name && st.user_name !== me.value?.username) holder.value = st.user_name;
  else holder.value = null;
  startStatusPoll();
});
onBeforeUnmount(() => { stopStatusPoll(); stopTakeoverPoll(); if (initReadOnlyTimer) clearTimeout(initReadOnlyTimer); void releaseIfMine(); univerHandle?.dispose(); });
</script>

<template>
  <div class="od-wb">
    <!-- 顶栏:结构取 workbook-shell.html -->
    <div class="od-wb-topbar">
      <div class="od-tb-left">
        <button class="od-icon-btn" @click="emit('back')" title="返回">←</button>
        <div class="od-store"><span class="od-store-sw">{{ shop.name.slice(0,1) }}</span>
          <div><div class="od-nm">{{ shop.name }}</div><div class="od-biz">{{ shop.business_name }}</div></div></div>
      </div>
      <div class="od-tb-right">
        <!-- 锁徽标两态,绑现有 editing/holder -->
        <span v-if="editing" class="od-lock-editable">● 编辑中</span>
        <span v-else-if="holder" class="od-lock-occupied"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg> {{ holder }} 编辑中</span>
        <span v-else class="od-lock-view">查看</span>
        <button v-if="!editing && !holder" class="od-btn-primary" @click="startEdit">编辑</button>
        <button v-if="editing" class="od-btn-ghost" @click="endEdit">退出编辑</button>
        <button v-if="holder" class="od-btn-takeover" @click="takeover">接管</button>
        <button class="od-btn-ghost" @click="exportXlsx" title="导出当前工作簿为 Excel 文件">导出</button>
        <button class="od-btn-ghost" @click="pickImport" :disabled="!editing || busy" title="从 Excel 导入,覆盖当前数据(需先编辑)">导入</button>
        <button class="od-btn-ghost" @click="save" :disabled="!editing || busy">保存并同步</button>
        <button v-if="me?.role === 'manager' || me?.role === 'chairman'" class="od-btn-ghost" @click="manualExtract" :disabled="busy" title="基于上次保存的快照 AI 抽取到大屏(经理以上,无需编辑)">AI 抽取</button>
        <input ref="fileInputRef" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" style="display:none" @change="onImportFile" />
      </div>
    </div>
    <div v-if="msg" class="od-wb-msg">{{ msg }}</div>
    <div v-if="extractResult?.errors.length" class="od-wb-err">
      校验错误:<span v-for="(e,i) in extractResult.errors" :key="i">{{ e.sheetKey }}/{{ e.date }} {{ e.key }}:{{ e.msg }}; </span>
    </div>
    <!-- AI 抽取进度可视化(SSE 事件驱动) -->
    <div v-if="progress" class="od-wb-progress">
      <div class="od-wb-progress-title">{{ extracting ? 'AI 抽取中…' : 'AI 抽取完成' }}</div>
      <div v-for="s in progress.sheets" :key="s.key" class="od-wb-step" :class="s.state">
        <span class="od-wb-step-icon">{{ s.state === 'done' ? '✓' : s.state === 'active' ? '⟳' : '·' }}</span>
        <span class="od-wb-step-label">{{ s.label }}</span>
        <span v-if="s.state === 'done'" class="od-wb-step-meta">{{ s.rowsOut }} 条{{ s.errorCount ? ` · ${s.errorCount} 项错误` : '' }}</span>
        <span v-else-if="s.state === 'active'" class="od-wb-step-meta">抽取中…</span>
      </div>
      <div v-if="progress.writing" class="od-wb-step" :class="extracting ? 'active' : 'done'">
        <span class="od-wb-step-icon">{{ extracting ? '⟳' : '✓' }}</span><span class="od-wb-step-label">写入数据库</span>
      </div>
    </div>
    <!-- Univer 挂载点:禁动 -->
    <div ref="containerRef" class="od-wb-grid"></div>
  </div>
</template>

<style scoped>
.od-wb *,
.od-wb *::before,
.od-wb *::after { box-sizing: border-box; }

/* 外壳容器:卡片化,填满内容区,flex 列让顶栏在上、表格填满剩余 */
.od-wb {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--od-surface);
  border: 1px solid var(--od-border);
  border-radius: var(--od-radius-lg);
  box-shadow: var(--od-shadow-sm);
  overflow: hidden;
  color: var(--od-text);
  font-family: var(--od-font-sans);
}

/* 顶栏 */
.od-wb-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px var(--od-space-4);
  border-bottom: 1px solid var(--od-border);
  background: var(--od-surface);
  gap: 12px;
  flex-wrap: wrap;
}
.od-tb-left { display: flex; align-items: center; gap: var(--od-space-3); }
.od-tb-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

.od-icon-btn {
  width: 34px; height: 34px;
  border-radius: var(--od-radius-md);
  display: grid; place-items: center;
  color: var(--od-text);
  border: 1px solid var(--od-border);
  background: var(--od-surface);
  transition: all .15s;
  font-size: var(--od-text-lg);
  line-height: 1;
  cursor: pointer;
}
.od-icon-btn:hover { background: var(--od-surface-2); border-color: color-mix(in oklab, var(--od-border), black 8%); }

.od-store { display: flex; align-items: center; gap: 8px; font-size: var(--od-text-base); }
.od-store-sw {
  width: 28px; height: 28px;
  border-radius: var(--od-radius-sm);
  background: var(--od-palette-1);
  display: grid; place-items: center;
  color: #fff; font-size: 13px; font-weight: var(--od-weight-semibold);
}
.od-nm { font-weight: var(--od-weight-semibold); }
.od-biz { font-size: var(--od-text-xs); color: var(--od-text-muted); }

/* 锁徽标 -- 编辑中 */
.od-lock-editable {
  display: inline-flex; align-items: center; gap: 6px;
  height: 34px; padding: 0 12px;
  border-radius: var(--od-radius-md);
  background: var(--od-primary-soft);
  color: var(--od-primary-hover);
  font-size: var(--od-text-sm);
  font-weight: var(--od-weight-medium);
}
/* 锁徽标 -- 被他人占用 */
.od-lock-occupied {
  display: inline-flex; align-items: center; gap: 6px;
  height: 34px; padding: 0 12px;
  border-radius: var(--od-radius-md);
  background: var(--od-surface-2);
  border: 1px solid var(--od-border);
  color: var(--od-warning);
  font-size: var(--od-text-sm);
  font-weight: var(--od-weight-medium);
}
/* 锁徽标 -- 查看 */
.od-lock-view {
  display: inline-flex; align-items: center; gap: 6px;
  height: 34px; padding: 0 12px;
  border-radius: var(--od-radius-md);
  background: var(--od-surface-2);
  border: 1px solid var(--od-border);
  color: var(--od-text-muted);
  font-size: var(--od-text-sm);
  font-weight: var(--od-weight-medium);
}

/* 按钮 */
.od-btn-primary {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: 34px; padding: 0 14px;
  border-radius: var(--od-radius-md);
  font-size: var(--od-text-sm); font-weight: var(--od-weight-medium);
  transition: all .15s;
  background: var(--od-primary); color: #fff; border: none; cursor: pointer;
}
.od-btn-primary:hover { background: var(--od-primary-hover); }

.od-btn-ghost {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: 34px; padding: 0 14px;
  border-radius: var(--od-radius-md);
  font-size: var(--od-text-sm); font-weight: var(--od-weight-medium);
  transition: all .15s;
  background: var(--od-surface); border: 1px solid var(--od-border); color: var(--od-text); cursor: pointer;
}
.od-btn-ghost:hover { background: var(--od-surface-2); border-color: color-mix(in oklab, var(--od-border), black 8%); }
.od-btn-ghost:disabled { opacity: .5; cursor: not-allowed; }

.od-btn-takeover {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: 34px; padding: 0 14px;
  border-radius: var(--od-radius-md);
  font-size: var(--od-text-sm); font-weight: var(--od-weight-medium);
  transition: all .15s;
  background: var(--od-warning); color: #fff; border: none; cursor: pointer;
}
.od-btn-takeover:hover { filter: brightness(.95); }

/* 消息 / 校验错误条 */
.od-wb-msg {
  padding: 6px var(--od-space-4);
  background: var(--od-primary-soft);
  color: var(--od-primary-hover);
  font-size: var(--od-text-sm);
  border-bottom: 1px solid var(--od-border);
}
.od-wb-err {
  padding: 6px var(--od-space-4);
  background: var(--od-danger-soft);
  color: var(--od-danger);
  font-size: var(--od-text-xs);
  border-bottom: 1px solid var(--od-border);
}

/* AI 抽取进度面板 */
.od-wb-progress {
  padding: 8px var(--od-space-4);
  background: var(--od-surface-2);
  border-bottom: 1px solid var(--od-border);
  font-size: var(--od-text-sm);
}
.od-wb-progress-title { font-weight: var(--od-weight-medium); margin-bottom: 6px; color: var(--od-primary-hover); }
.od-wb-step { display: flex; align-items: center; gap: 8px; padding: 2px 0; color: var(--od-text-muted); }
.od-wb-step.active { color: var(--od-primary-hover); }
.od-wb-step.done { color: var(--od-text); }
.od-wb-step-icon { width: 16px; text-align: center; font-weight: var(--od-weight-semibold); }
.od-wb-step.active .od-wb-step-icon { display: inline-block; animation: od-spin 1s linear infinite; }
.od-wb-step-label { flex: 1; }
.od-wb-step-meta { font-size: var(--od-text-xs); color: var(--od-text-muted); }
@keyframes od-spin { to { transform: rotate(360deg); } }

/* Univer 挂载点:填满剩余空间(禁动容器,仅类名) */
.od-wb-grid { flex: 1; min-height: 0; }

@media (max-width: 760px) {
  .od-biz { display: none; }
}
</style>
