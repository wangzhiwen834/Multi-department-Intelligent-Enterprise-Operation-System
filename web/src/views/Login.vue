<script setup lang="ts">
import { ref } from 'vue';
import { api } from '../api';
import type { User } from '../types';

const emit = defineEmits<{ (e: 'login', u: User, t: string): void }>();
const username = ref('');
const password = ref('');
const err = ref('');

const submit = async () => {
  try {
    const r = await api.login(username.value, password.value);
    emit('login', r.user, r.token);
  } catch (e: any) {
    err.value = e.message;
  }
};
</script>

<template>
  <div class="flex h-full items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900">
    <form @submit.prevent="submit" class="w-96 rounded-2xl border border-cyan-500/20 bg-slate-800/70 p-8 shadow-2xl backdrop-blur">
      <div class="mb-6 text-center">
        <div class="text-4xl">🦶</div>
        <h1 class="mt-2 text-xl font-semibold text-slate-100">足浴经营系统</h1>
        <p class="text-sm text-slate-400">多部门智能经营平台</p>
      </div>
      <input v-model="username" class="mb-3 w-full rounded-lg bg-slate-700/60 px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-cyan-500" placeholder="账号" />
      <input v-model="password" type="password" class="mb-3 w-full rounded-lg bg-slate-700/60 px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-cyan-500" placeholder="密码" />
      <div v-if="err" class="mb-3 text-sm text-red-400">{{ err }}</div>
      <button class="w-full rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 py-3 font-medium text-white shadow-lg transition hover:from-cyan-400 hover:to-blue-400">登录</button>
      <p class="mt-4 text-center text-xs text-slate-500">默认账号 boss/boss123 · mgr/mgr123</p>
    </form>
  </div>
</template>
