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
  (e: 'poster'): void;
  (e: 'logout'): void;
}>();

const shops = ref<Shop[]>([]);
const err = ref('');
onMounted(() => { api.shops().then(r => shops.value = r).catch(e => err.value = e.message); });
</script>

<template>
  <div class="h-full bg-slate-100 text-slate-900">
    <header class="flex items-center justify-between border-b border-slate-200 bg-white p-5">
      <div>
        <h1 class="text-xl font-semibold">店铺列表</h1>
        <p class="text-sm text-slate-500">选择门店进入当月工作簿</p>
      </div>
      <div class="flex items-center gap-3 text-sm">
        <button @click="emit('dashboard')" class="rounded-lg bg-gradient-to-r from-sky-500 to-blue-500 px-4 py-2 font-medium text-white shadow transition hover:from-sky-400 hover:to-blue-400">📊 数据大屏</button>
        <button @click="emit('chat')" class="rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 font-medium text-white shadow transition hover:from-violet-400 hover:to-fuchsia-400">🤖 AI 助手</button>
        <button @click="emit('poster')" class="rounded-lg bg-gradient-to-r from-fuchsia-500 to-rose-500 px-4 py-2 font-medium text-white shadow transition hover:from-fuchsia-400 hover:to-rose-400">🎨 海报</button>
        <input type="month" :value="period" @change="emit('update:period', ($event.target as HTMLInputElement).value)" class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" />
        <span class="text-slate-600">{{ user?.name }}</span>
        <button @click="emit('logout')" class="text-sky-600 hover:text-sky-500">退出</button>
      </div>
    </header>
    <main class="grid grid-cols-1 gap-5 p-6 md:grid-cols-2 lg:grid-cols-3">
      <div v-if="err" class="text-red-500">{{ err }}</div>
      <button v-for="s in shops" :key="s.id" @click="emit('pick', s)" class="group rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:border-sky-400 hover:shadow-lg">
        <div class="flex items-center justify-between">
          <div class="text-lg font-medium text-slate-900">{{ s.name }}</div>
          <div class="text-slate-400 transition group-hover:text-sky-500">-></div>
        </div>
        <div class="mt-1 text-xs text-slate-500">{{ s.business_name }}</div>
      </button>
    </main>
  </div>
</template>
