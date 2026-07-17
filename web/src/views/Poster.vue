<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { api } from '../api';
import type { Shop } from '../types';

const emit = defineEmits<{ (e: 'back'): void }>();

const shops = ref<Shop[]>([]);
const shopId = ref<number | null>(null);
const prompt = ref('足浴店周末养生特惠,温馨暖色调,顶部底部留白');
const date = ref(new Date().toISOString().slice(0, 10));
const caption = ref('健康养生 · 舒缓身心');
const loading = ref(false);
const err = ref('');
const bgImage = ref('');
const posterDataUrl = ref('');

const shopName = computed(() => shops.value.find(s => s.id === shopId.value)?.name ?? '');
onMounted(() => { api.shops().then(r => { shops.value = r; if (r[0]) shopId.value = r[0].id; }); });

const compose = () => {
  if (!bgImage.value) return;
  const img = new Image();
  img.onload = () => {
    const W = 1024, H = 1536;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0, W, H);
    // 顶部:遮罩 + 店名 + 日期
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, W, 220);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 72px sans-serif';
    ctx.fillText(shopName.value || '足浴店', W / 2, 110);
    ctx.font = '36px sans-serif';
    ctx.fillText(date.value, W / 2, 175);
    // 底部:遮罩 + 文案
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, H - 180, W, 180);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 52px sans-serif';
    ctx.fillText(caption.value || '', W / 2, H - 90);
    posterDataUrl.value = c.toDataURL('image/jpeg', 0.92);
  };
  img.src = bgImage.value;
};

const generate = async () => {
  loading.value = true; err.value = '';
  try {
    const r = await api.posterGenerate(prompt.value);
    bgImage.value = r.image;
    compose();
  } catch (e: any) { err.value = e.message; } finally { loading.value = false; }
};

// 店名/日期/文案变化时,已有底图则重新合成
watch([shopName, date, caption], () => { if (bgImage.value) compose(); });

const download = () => {
  if (!posterDataUrl.value) return;
  const a = document.createElement('a');
  a.href = posterDataUrl.value;
  a.download = `海报_${shopName.value}_${date.value}.jpg`;
  a.click();
};
</script>

<template>
  <div class="h-full overflow-auto bg-gradient-to-b from-slate-900 to-slate-950 text-slate-100">
    <header class="flex items-center gap-3 border-b border-slate-700/50 p-4">
      <button @click="emit('back')" class="text-cyan-400 hover:text-cyan-300">← 返回</button>
      <h1 class="text-lg font-medium">🎨 文生图海报</h1>
    </header>
    <div class="flex flex-col gap-6 p-6 md:flex-row">
      <div class="w-full space-y-3 md:w-80">
        <div>
          <label class="text-sm text-slate-400">店铺</label>
          <select v-model="shopId" class="mt-1 w-full rounded-lg bg-slate-800 px-3 py-2">
            <option v-for="s in shops" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </div>
        <div>
          <label class="text-sm text-slate-400">日期(手动)</label>
          <input v-model="date" type="date" class="mt-1 w-full rounded-lg bg-slate-800 px-3 py-2" />
        </div>
        <div>
          <label class="text-sm text-slate-400">提示词(生成背景主视觉)</label>
          <textarea v-model="prompt" rows="4" class="mt-1 w-full rounded-lg bg-slate-800 px-3 py-2"></textarea>
        </div>
        <div>
          <label class="text-sm text-slate-400">文案(底部)</label>
          <input v-model="caption" class="mt-1 w-full rounded-lg bg-slate-800 px-3 py-2" />
        </div>
        <button @click="generate" :disabled="loading" class="w-full rounded-lg bg-gradient-to-r from-fuchsia-500 to-rose-500 py-2.5 font-medium text-white disabled:opacity-40">
          {{ loading ? '生成中…(约20秒)' : '生成海报' }}
        </button>
        <div v-if="err" class="text-sm text-red-400">{{ err }}</div>
        <button v-if="posterDataUrl" @click="download" class="w-full rounded-lg bg-cyan-500 py-2.5 font-medium text-white hover:bg-cyan-400">⬇ 下载海报</button>
        <p class="text-xs text-slate-500">文生图作背景,店名/日期/文案由 Canvas 叠加,文字清晰可编辑。内容提示词驱动,不取财务数据。</p>
      </div>
      <div class="flex-1">
        <div v-if="!posterDataUrl" class="flex h-96 items-center justify-center rounded-xl border border-dashed border-slate-700 text-slate-500">填写左侧并点"生成海报"</div>
        <img v-else :src="posterDataUrl" class="mx-auto max-h-[80vh] rounded-xl shadow-2xl" />
      </div>
    </div>
  </div>
</template>
