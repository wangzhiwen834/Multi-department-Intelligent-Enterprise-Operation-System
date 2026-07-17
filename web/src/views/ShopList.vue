<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../api';
import type { Shop, User } from '../types';

defineProps<{ user: User | null; period: string }>();
const emit = defineEmits<{
  (e: 'update:period', p: string): void;
  (e: 'pick', s: Shop): void;
  (e: 'dashboard'): void;
  (e: 'chat'): void;
  (e: 'logout'): void;
}>();

const shops = ref<Shop[]>([]);
const err = ref('');
onMounted(() => { api.shops().then(r => shops.value = r).catch(e => err.value = e.message); });
</script>

<template>
  <div class="h-full bg-gradient-to-b from-slate-900 to-slate-950 text-slate-100">
    <header class="flex items-center justify-between border-b border-slate-700/50 p-5">
      <div>
        <h1 class="text-xl font-semibold">店铺列表</h1>
        <p class="text-sm text-slate-400">选择门店进入当月工作簿</p>
      </div>
      <div class="flex items-center gap-3 text-sm">
        <button @click="emit('dashboard')" class="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2 font-medium text-white shadow transition hover:from-cyan-400 hover:to-blue-400">📊 数据大屏</button>
        <button @click="emit('chat')" class="rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 font-medium text-white shadow transition hover:from-violet-400 hover:to-fuchsia-400">🤖 AI 助手</button>
        <input type="month" :value="period" @change="emit('update:period', ($event.target as HTMLInputElement).value)" class="rounded-lg bg-slate-800 px-3 py-2" />
        <span class="text-slate-300">{{ user?.name }}</span>
        <button @click="emit('logout')" class="text-cyan-400 hover:text-cyan-300">退出</button>
      </div>
    </header>
    <main class="grid grid-cols-1 gap-5 p-6 md:grid-cols-2 lg:grid-cols-3">
      <div v-if="err" class="text-red-400">{{ err }}</div>
      <button v-for="s in shops" :key="s.id" @click="emit('pick', s)" class="group rounded-2xl border border-slate-700/50 bg-slate-800/50 p-6 text-left transition hover:-translate-y-1 hover:border-cyan-500/50 hover:shadow-xl hover:shadow-cyan-500/10">
        <div class="flex items-center justify-between">
          <div class="text-lg font-medium">{{ s.name }}</div>
          <div class="text-slate-500 transition group-hover:text-cyan-400">→</div>
        </div>
        <div class="mt-1 text-xs text-slate-400">{{ s.business_name }}</div>
      </button>
    </main>
  </div>
</template>
