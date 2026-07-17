<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api, getToken, setToken, clearToken } from './api';
import type { Shop, User } from './types';
import Login from './views/Login.vue';
import ShopList from './views/ShopList.vue';
import Workbook from './views/Workbook.vue';
import Dashboard from './views/Dashboard.vue';
import Chat from './views/Chat.vue';
import Poster from './views/Poster.vue';

const user = ref<User | null>(null);
const view = ref<'loading' | 'login' | 'shops' | 'workbook' | 'dashboard' | 'chat' | 'poster'>('loading');
const shop = ref<Shop | null>(null);
const period = ref(new Date().toISOString().slice(0, 7));

onMounted(() => {
  if (getToken()) {
    api.me().then(u => { user.value = u; view.value = 'shops'; }).catch(() => { clearToken(); view.value = 'login'; });
  } else {
    view.value = 'login';
  }
});

const onLogin = (u: User, t: string) => { setToken(t); user.value = u; view.value = 'shops'; };
const onLogout = () => { clearToken(); user.value = null; view.value = 'login'; };
const onPick = (s: Shop) => { shop.value = s; view.value = 'workbook'; };
</script>

<template>
  <div v-if="view === 'loading'" class="p-8 text-slate-200">加载中…</div>
  <Login v-else-if="view === 'login'" @login="onLogin" />
  <Workbook v-else-if="view === 'workbook' && shop" :shop="shop" v-model:period="period" @back="view = 'shops'" />
  <Dashboard v-else-if="view === 'dashboard'" v-model:period="period" @back="view = 'shops'" />
  <Chat v-else-if="view === 'chat'" v-model:period="period" @back="view = 'shops'" />
  <Poster v-else-if="view === 'poster'" @back="view = 'shops'" />
  <ShopList v-else :user="user" v-model:period="period" @pick="onPick" @dashboard="view = 'dashboard'" @chat="view = 'chat'" @poster="view = 'poster'" @logout="onLogout" />
</template>
