<script setup lang="ts">
import { ref, nextTick } from 'vue';
import { api } from '../api';

const props = defineProps<{ period: string }>();
const emit = defineEmits<{ (e: 'back'): void }>();

interface Msg { role: 'user' | 'assistant'; content: string }
const messages = ref<Msg[]>([
  { role: 'assistant', content: '你好,我是经营分析助手。可以问我:本月总营收多少?任务完成进度如何?哪家店客流最高?7 月维修费有哪些?……' },
]);
const input = ref('');
const loading = ref(false);
const listRef = ref<HTMLDivElement | null>(null);

const scroll = () => nextTick(() => listRef.value?.scrollTo({ top: listRef.value.scrollHeight }));

const send = async () => {
  const m = input.value.trim();
  if (!m || loading.value) return;
  input.value = '';
  messages.value.push({ role: 'user', content: m });
  loading.value = true;
  await scroll();
  try {
    const r = await api.aiChat(m, props.period);
    messages.value.push({ role: 'assistant', content: r.answer });
  } catch (e: any) {
    messages.value.push({ role: 'assistant', content: `出错:${e.message}` });
  } finally {
    loading.value = false;
    await scroll();
  }
};

const suggestions = ['本月总营收多少?任务完成进度如何?', '5 家店营收排名怎样?', '本月维修费有哪些?'];
const ask = (s: string) => { input.value = s; send(); };
</script>

<template>
  <div class="flex h-full flex-col bg-gradient-to-b from-slate-900 to-slate-950 text-slate-100">
    <header class="flex items-center gap-3 border-b border-slate-700/50 p-4">
      <button @click="emit('back')" class="text-cyan-400 hover:text-cyan-300">← 返回</button>
      <h1 class="text-lg font-medium">🤖 AI 经营助手</h1>
      <span class="text-sm text-slate-400">上下文月份:{{ period }}</span>
    </header>
    <div ref="listRef" class="flex-1 space-y-4 overflow-auto p-4">
      <div v-for="(m, i) in messages" :key="i" class="flex" :class="m.role === 'user' ? 'justify-end' : 'justify-start'">
        <div class="max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5"
          :class="m.role === 'user' ? 'bg-cyan-500 text-white' : 'bg-slate-800 text-slate-100'">{{ m.content }}</div>
      </div>
      <div v-if="loading" class="flex justify-start"><div class="rounded-2xl bg-slate-800 px-4 py-2.5 text-slate-400">思考中…</div></div>
    </div>
    <div class="border-t border-slate-700/50 p-3">
      <div class="mb-2 flex flex-wrap gap-2">
        <button v-for="s in suggestions" :key="s" @click="ask(s)" class="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300 hover:bg-slate-700">{{ s }}</button>
      </div>
      <form @submit.prevent="send" class="flex gap-2">
        <input v-model="input" class="flex-1 rounded-lg bg-slate-800 px-4 py-2.5 outline-none focus:ring-2 focus:ring-cyan-500" placeholder="问点什么,如:本月客单价多少?" />
        <button :disabled="loading" class="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-2.5 font-medium text-white disabled:opacity-40">发送</button>
      </form>
    </div>
  </div>
</template>
