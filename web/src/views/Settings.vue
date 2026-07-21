<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { api } from '../api';
import type { AiSettings, AiModel, AiModelKind } from '../types';

const settings = ref<AiSettings | null>(null);
const msg = ref('');
const busy = ref(false);
const newModel = ref({ model_id: '', label: '', kind: 'chat' as AiModelKind });

const load = async () => {
  try { settings.value = await api.getAiSettings(); } catch (e: any) { msg.value = e.message; }
};
onMounted(load);

const refresh = async () => {
  busy.value = true; msg.value = '';
  try {
    const r = await api.refreshAiModels();
    msg.value = `已拉取 ${r.fetched} 个可用模型`;
    await load();
  } catch (e: any) { msg.value = e.message; } finally { busy.value = false; }
};

const addModel = async () => {
  if (!newModel.value.model_id || !newModel.value.label) { msg.value = 'model_id 和显示名必填'; return; }
  busy.value = true; msg.value = '';
  try {
    await api.addAiModel(newModel.value);
    newModel.value = { model_id: '', label: '', kind: 'chat' };
    await load();
    msg.value = '已添加';
  } catch (e: any) { msg.value = e.message; } finally { busy.value = false; }
};

const delModel = async (m: AiModel) => {
  if (!confirm(`删除模型「${m.label}」?`)) return;
  try { await api.delAiModel(m.id); await load(); msg.value = '已删除'; }
  catch (e: any) { msg.value = e.message; }
};

const assign = async (feature: 'chat' | 'poster' | 'extraction', model_id: string) => {
  try {
    await api.assignAiFeature(feature, model_id);
    await load();
    msg.value = `已分配 ${feature} 模型`;
  } catch (e: any) { msg.value = e.message; }
};

const features = computed(() => [
  { key: 'chat' as const, label: 'AI 分析(对话)', kind: 'chat' as const },
  { key: 'poster' as const, label: 'AI 海报(文生图)', kind: 'image' as const },
  { key: 'extraction' as const, label: 'AI 抽取', kind: 'chat' as const },
]);
const modelsForKind = (kind: AiModelKind) => (settings.value?.models || []).filter(m => m.kind === kind);
const fetchedAt = computed(() => {
  const fa = (settings.value?.models || []).map(m => m.fetched_at).filter(Boolean).sort().reverse()[0];
  return fa ? new Date(fa).toLocaleString('zh-CN') : '未拉取';
});
</script>

<template>
  <div class="settings-page">
    <div class="card">
      <div class="card-head">
        <h3>AI 模型管理</h3>
        <div class="head-right">
          <span class="meta">上次拉取:{{ fetchedAt }}</span>
          <button class="btn-primary" :disabled="busy" @click="refresh">刷新模型列表</button>
        </div>
      </div>
      <p v-if="msg" class="msg">{{ msg }}</p>

      <h4 class="sec-title">功能分配</h4>
      <div class="feature-rows">
        <div v-for="f in features" :key="f.key" class="feature-row">
          <span class="f-label">{{ f.label }}</span>
          <select class="f-select" :value="settings?.features[f.key] ?? ''"
                  @change="assign(f.key, ($event.target as HTMLSelectElement).value)">
            <option value="">未分配(用 env 默认)</option>
            <option v-for="m in modelsForKind(f.kind)" :key="m.model_id" :value="m.model_id">
              {{ m.label }} ({{ m.model_id }})
            </option>
          </select>
        </div>
      </div>

      <h4 class="sec-title">模型列表({{ settings?.models.length ?? 0 }})</h4>
      <table class="model-table">
        <thead><tr><th>model_id</th><th>显示名</th><th>类型</th><th>状态</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="m in settings?.models" :key="m.id">
            <td class="mono">{{ m.model_id }}</td>
            <td>{{ m.label }}</td>
            <td><span class="kind-tag" :class="m.kind">{{ m.kind }}</span></td>
            <td>{{ m.status || '-' }}</td>
            <td><button class="btn-del" @click="delModel(m)">删除</button></td>
          </tr>
          <tr v-if="!settings?.models.length"><td colspan="5" class="empty">尚无模型,点「刷新模型列表」从火山方舟拉取</td></tr>
        </tbody>
      </table>

      <details class="add-details">
        <summary>手动添加模型(列表没有时兜底)</summary>
        <div class="add-form">
          <input v-model="newModel.model_id" placeholder="model_id,如 doubao-seed-2-1-pro-260628" class="inp" />
          <input v-model="newModel.label" placeholder="显示名" class="inp" />
          <select v-model="newModel.kind" class="inp">
            <option value="chat">chat(文本)</option>
            <option value="image">image(文生图)</option>
            <option value="other">other</option>
          </select>
          <button class="btn-primary" @click="addModel">添加</button>
        </div>
      </details>
    </div>
  </div>
</template>

<style scoped>
.settings-page { max-width: 960px; }
.card { background: var(--od-surface); border: 1px solid var(--od-border); border-radius: var(--od-radius-lg); box-shadow: var(--od-shadow-sm); padding: var(--od-space-6); }
.card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--od-space-4); flex-wrap: wrap; gap: 12px; }
.card-head h3 { margin: 0; font-size: var(--od-text-xl); font-weight: var(--od-weight-semibold); }
.head-right { display: flex; align-items: center; gap: 12px; }
.meta { font-size: var(--od-text-sm); color: var(--od-text-muted); }
.msg { padding: 8px 12px; background: var(--od-primary-soft); color: var(--od-primary-hover); border-radius: var(--od-radius-md); font-size: var(--od-text-sm); margin-bottom: var(--od-space-4); }
.sec-title { font-size: var(--od-text-base); font-weight: var(--od-weight-semibold); margin: var(--od-space-5) 0 var(--od-space-3); color: var(--od-text); }
.feature-rows { display: flex; flex-direction: column; gap: 10px; max-width: 560px; }
.feature-row { display: flex; align-items: center; gap: 12px; }
.f-label { width: 160px; font-size: var(--od-text-sm); color: var(--od-text-muted); flex-shrink: 0; }
.f-select { flex: 1; height: 36px; padding: 0 10px; border: 1px solid var(--od-border); border-radius: var(--od-radius-md); background: var(--od-surface); color: var(--od-text); font-family: inherit; font-size: var(--od-text-sm); }
.f-select:focus { outline: none; border-color: var(--od-primary); }
.model-table { width: 100%; border-collapse: collapse; font-size: var(--od-text-sm); }
.model-table th { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--od-border); color: var(--od-text-muted); font-weight: var(--od-weight-medium); }
.model-table td { padding: 8px 10px; border-bottom: 1px solid var(--od-border); color: var(--od-text); }
.mono { font-family: var(--od-font-mono); font-size: var(--od-text-xs); }
.kind-tag { display: inline-block; padding: 2px 8px; border-radius: var(--od-radius-full); font-size: var(--od-text-xs); font-weight: var(--od-weight-medium); }
.kind-tag.chat { background: var(--od-primary-soft); color: var(--od-primary); }
.kind-tag.image { background: var(--od-success-soft); color: var(--od-success); }
.kind-tag.other { background: var(--od-surface-2); color: var(--od-text-muted); }
.empty { text-align: center; color: var(--od-text-muted); padding: 20px; }
.btn-del { height: 28px; padding: 0 10px; border: 1px solid var(--od-border); border-radius: var(--od-radius-sm); background: var(--od-surface); color: var(--od-danger); font-size: var(--od-text-xs); cursor: pointer; }
.btn-del:hover { border-color: var(--od-danger); background: var(--od-danger-soft); }
.add-details { margin-top: var(--od-space-5); }
.add-details summary { cursor: pointer; font-size: var(--od-text-sm); color: var(--od-text-muted); }
.add-form { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
.inp { height: 36px; padding: 0 10px; border: 1px solid var(--od-border); border-radius: var(--od-radius-md); background: var(--od-surface); color: var(--od-text); font-family: inherit; font-size: var(--od-text-sm); }
.inp:focus { outline: none; border-color: var(--od-primary); }
.btn-primary { height: 36px; padding: 0 16px; border: none; border-radius: var(--od-radius-md); background: var(--od-primary); color: #fff; font-size: var(--od-text-sm); font-weight: var(--od-weight-medium); cursor: pointer; }
.btn-primary:hover { background: var(--od-primary-hover); }
.btn-primary:disabled { opacity: .5; cursor: not-allowed; }
</style>
