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
const model = ref('');

const shopName = computed(() => shops.value.find(s => s.id === shopId.value)?.name ?? '');
onMounted(() => {
  api.shops().then(r => { shops.value = r; if (r[0]) shopId.value = r[0].id; });
  api.aiInfo().then(i => model.value = i.posterModel);
});

const compose = () => {
  if (!bgImage.value) return;
  const img = new Image();
  img.onload = () => {
    const W = 1024, H = 1536;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, W, 220);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 72px sans-serif';
    ctx.fillText(shopName.value || '足浴店', W / 2, 110);
    ctx.font = '36px sans-serif';
    ctx.fillText(date.value, W / 2, 175);
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
  <div class="od-poster">
    <div class="page-head">
      <div>
        <h1 class="page-title">AI 每日海报</h1>
        <p class="page-sub">选择店铺与日期,AI 生成文生图背景,Canvas 叠加店名 / 日期 / 文案。</p>
      </div>
      <div class="model-tag"><span class="model-dot"></span>模型 <b>{{ model || '加载中…' }}</b></div>
    </div>

    <div class="layout">
      <!-- 左:配置区 -->
      <div class="card">
        <div class="card-h">海报配置</div>
        <div class="card-desc">提示词驱动文生图背景,店名 / 日期 / 文案由 Canvas 叠加,文字清晰可编辑。</div>

        <div class="field">
          <label>店铺</label>
          <select v-model="shopId" class="select">
            <option v-for="s in shops" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </div>

        <div class="field">
          <label>日期</label>
          <input v-model="date" type="date" class="input" />
        </div>

        <div class="field">
          <label>风格 <span class="opt-tag">视觉参考</span></label>
          <div class="style-grid">
            <div class="style-opt active"><span class="style-sw" style="background:linear-gradient(135deg,var(--od-palette-1),color-mix(in oklab,var(--od-palette-1),black 20%))"></span>商务蓝</div>
            <div class="style-opt"><span class="style-sw" style="background:linear-gradient(135deg,var(--od-warning),var(--od-gold))"></span>暖金</div>
            <div class="style-opt"><span class="style-sw" style="background:linear-gradient(135deg,var(--od-text),color-mix(in oklab,var(--od-text),white 25%))"></span>极简黑</div>
            <div class="style-opt"><span class="style-sw" style="background:linear-gradient(135deg,color-mix(in oklab,var(--od-danger),black 12%),var(--od-warning))"></span>喜庆红</div>
          </div>
          <div class="hint-txt">风格仅作视觉参考,实际背景由提示词驱动。</div>
        </div>

        <div class="field">
          <label>提示词</label>
          <textarea v-model="prompt" class="input" rows="4" placeholder="补充背景主视觉重点,如:温馨暖色调、顶部底部留白…"></textarea>
          <div class="hint-txt">留空则使用默认提示词。</div>
        </div>

        <div class="field">
          <label>底部文案</label>
          <input v-model="caption" class="input" placeholder="如:健康养生 · 舒缓身心" />
        </div>

        <div v-if="err" class="err-box">{{ err }}</div>

        <div class="divider"></div>

        <button class="btn btn-primary" :disabled="loading" @click="generate">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M5 20l.7-2M19 20l-.7-2M12 19v.01"/></svg>
          {{ loading ? '生成中…' : '生成海报' }}
        </button>
        <div class="hint-txt" style="text-align:center;margin-top:8px">预计耗时 8-15 秒 · 消耗 1 次生成额度</div>
      </div>

      <!-- 右:预览区 -->
      <div class="preview-area">
        <div class="preview-block">
          <span class="preview-label">海报预览 · 竖版 1080 × 1920</span>
          <div class="poster-row">
            <div class="poster-cell">
              <!-- 占位 -->
              <div v-if="!posterDataUrl && !loading" class="poster placeholder">
                <div class="ph">
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                  <div class="ph-t">填写左侧配置并点"生成海报"</div>
                  <div class="ph-s">竖版 1080 × 1920 · 适合朋友圈 / 群发</div>
                </div>
              </div>

              <!-- 生成中骨架 -->
              <div v-else-if="loading" class="poster loading">
                <div class="skel s1"></div>
                <div class="skel s2"></div>
                <div class="skel s3"></div>
                <div class="skel s4"></div>
                <div class="skel s5"></div>
                <div class="loading-badge">
                  <div class="spinner"></div>
                  <div class="lt">生成中…</div>
                  <div class="lp">文生图 + Canvas 合成</div>
                </div>
              </div>

              <!-- 生成完成 -->
              <template v-else>
                <div class="poster done">
                  <img :src="posterDataUrl" class="p-img" alt="每日海报" />
                </div>
                <div class="poster-actions">
                  <button class="btn btn-ghost" style="flex:1" @click="download">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                    下载海报
                  </button>
                </div>
                <div class="poster-cap">竖版 <b>1080 × 1920</b> · 适合朋友圈 / 群发</div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 令牌 --od-* 为全局,定义于 styles\tokens.css。此处仅本页局部样式(移植自 Opendesign\ai-poster.html,移除 :root)。 */
.od-poster {
  font-family: var(--od-font-sans);
  background: var(--od-bg);
  color: var(--od-text);
  font-size: var(--od-text-base);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}
.od-poster * { box-sizing: border-box; }
.num { font-family: var(--od-font-mono); font-variant-numeric: tabular-nums; }
button { font-family: inherit; cursor: pointer; border: none; background: none; }

/* 页头 */
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--od-space-4); margin-bottom: var(--od-space-6); flex-wrap: wrap; }
.page-title { font-size: var(--od-text-2xl); font-weight: var(--od-weight-bold); margin-bottom: 4px; }
.page-sub { font-size: var(--od-text-sm); color: var(--od-text-muted); }

.model-tag { display: inline-flex; align-items: center; gap: 8px; font-size: var(--od-text-sm); color: var(--od-text); background: var(--od-surface); border: 1px solid var(--od-border); padding: 6px 12px; border-radius: var(--od-radius-full); box-shadow: var(--od-shadow-sm); white-space: nowrap; }
.model-tag b { font-weight: var(--od-weight-semibold); }
.model-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--od-primary); box-shadow: 0 0 0 3px var(--od-primary-soft); }

/* 布局 */
.layout { display: grid; grid-template-columns: 380px 1fr; gap: var(--od-space-5); max-width: 1180px; margin: 0 auto; align-items: start; }
@media (max-width: 920px) { .layout { grid-template-columns: 1fr; } }

/* 卡片 */
.card { background: var(--od-surface); border: 1px solid var(--od-border); border-radius: var(--od-radius-lg); box-shadow: var(--od-shadow-sm); padding: var(--od-space-5); }
.card-h { font-size: var(--od-text-lg); font-weight: var(--od-weight-semibold); margin-bottom: var(--od-space-2); }
.card-desc { font-size: var(--od-text-sm); color: var(--od-text-muted); margin-bottom: var(--od-space-5); }

/* 字段 */
.field { margin-bottom: var(--od-space-4); }
.field label { display: block; font-size: var(--od-text-sm); font-weight: var(--od-weight-medium); margin-bottom: 6px; }
.field .hint-txt { font-size: var(--od-text-xs); color: var(--od-text-muted); margin-top: 5px; }
.opt-tag { display: inline-block; font-size: 10px; font-weight: var(--od-weight-medium); color: var(--od-text-muted); background: var(--od-surface-2); border-radius: var(--od-radius-sm); padding: 1px 6px; margin-left: 4px; vertical-align: 1px; }

.select, .input { width: 100%; height: 40px; padding: 0 12px; background: var(--od-surface); border: 1px solid var(--od-border); border-radius: var(--od-radius-md); font-size: var(--od-text-base); color: var(--od-text); font-family: inherit; transition: all .15s; appearance: none; background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.4'><path d='M6 9l6 6 6-6'/></svg>"); background-repeat: no-repeat; background-position: right 12px center; padding-right: 34px; }
.select:hover, .input:hover { border-color: color-mix(in oklab, var(--od-border), black 8%); }
.select:focus, .input:focus { outline: none; border-color: var(--od-primary); box-shadow: 0 0 0 3px var(--od-primary-soft); }
textarea.input { height: auto; padding: 10px 12px; background-image: none; padding-right: 12px; resize: vertical; min-height: 84px; line-height: 1.6; }

/* 风格选择 */
.style-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.style-opt { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border: 1px solid var(--od-border); border-radius: var(--od-radius-md); cursor: pointer; font-size: var(--od-text-sm); transition: all .15s; }
.style-opt:hover { border-color: color-mix(in oklab, var(--od-border), black 8%); background: var(--od-surface-2); }
.style-opt.active { border-color: var(--od-primary); background: var(--od-primary-soft); color: var(--od-primary-hover); font-weight: var(--od-weight-medium); }
.style-sw { width: 18px; height: 18px; border-radius: var(--od-radius-sm); flex-shrink: 0; }

/* 按钮 */
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 42px; border-radius: var(--od-radius-md); font-size: var(--od-text-base); font-weight: var(--od-weight-semibold); transition: all .15s; width: 100%; }
.btn-primary { background: var(--od-primary); color: #fff; box-shadow: var(--od-shadow-sm); }
.btn-primary:hover:not(:disabled) { background: var(--od-primary-hover); box-shadow: var(--od-shadow-md); }
.btn-primary:disabled { opacity: .5; cursor: not-allowed; }
.btn-ghost { background: var(--od-surface); border: 1px solid var(--od-border); color: var(--od-text); height: 38px; }
.btn-ghost:hover { background: var(--od-surface-2); border-color: color-mix(in oklab, var(--od-border), black 8%); }

/* 错误提示 */
.err-box { font-size: var(--od-text-sm); color: var(--od-danger); background: var(--od-danger-soft); border: 1px solid color-mix(in oklab, var(--od-danger), white 35%); border-radius: var(--od-radius-md); padding: 8px 12px; margin-bottom: var(--od-space-4); }

.divider { height: 1px; background: var(--od-border); margin: var(--od-space-5) 0; }

/* 预览区 */
.preview-area { display: flex; flex-direction: column; gap: var(--od-space-5); }
.preview-block { position: relative; }
.preview-label { display: inline-flex; align-items: center; gap: 6px; font-size: var(--od-text-xs); font-weight: var(--od-weight-semibold); letter-spacing: .08em; text-transform: uppercase; color: var(--od-primary); background: var(--od-primary-soft); padding: 4px 10px; border-radius: var(--od-radius-full); margin-bottom: var(--od-space-3); }

.poster-row { display: flex; gap: var(--od-space-6); flex-wrap: wrap; align-items: flex-start; }
.poster-cell { display: flex; flex-direction: column; align-items: center; gap: var(--od-space-3); }

/* 海报 9:16(1080×1920 比例) */
.poster { width: 300px; height: 533px; border-radius: var(--od-radius-lg); overflow: hidden; position: relative; box-shadow: var(--od-shadow-lg); border: 1px solid var(--od-border); }

/* 占位态 */
.poster.placeholder { background: var(--od-surface-2); display: grid; place-items: center; }
.poster.placeholder .ph { display: flex; flex-direction: column; align-items: center; gap: 10px; color: var(--od-text-muted); text-align: center; padding: 20px; }
.poster.placeholder .ph-t { font-size: var(--od-text-sm); font-weight: var(--od-weight-medium); color: var(--od-text); }
.poster.placeholder .ph-s { font-size: var(--od-text-xs); }

/* 完成态:实际生成的图片填满海报框 */
.poster.done { background: var(--od-surface-2); }
.poster.done .p-img { width: 100%; height: 100%; object-fit: cover; display: block; }

/* 生成中骨架 */
.poster.loading { background: var(--od-surface-2); }
.poster.loading .skel { position: absolute; background: linear-gradient(100deg, var(--od-surface-2) 30%, color-mix(in oklab, var(--od-surface-2), white 35%) 50%, var(--od-surface-2) 70%); background-size: 200% 100%; animation: shimmer 1.4s infinite; border-radius: var(--od-radius-sm); }
@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
.poster.loading .s1 { top: 60px; left: 24px; right: 24px; height: 14px; }
.poster.loading .s2 { top: 84px; left: 24px; width: 120px; height: 22px; }
.poster.loading .s3 { bottom: 160px; left: 24px; right: 24px; height: 60px; border-radius: var(--od-radius-md); }
.poster.loading .s4 { bottom: 90px; left: 24px; right: 24px; height: 36px; border-radius: var(--od-radius-md); }
.poster.loading .s5 { bottom: 30px; left: 24px; right: 80px; height: 12px; }
.loading-badge { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: var(--od-surface); border: 1px solid var(--od-border); border-radius: var(--od-radius-lg); padding: 14px 18px; box-shadow: var(--od-shadow-lg); display: flex; flex-direction: column; align-items: center; gap: 10px; z-index: 3; min-width: 200px; }
.spinner { width: 30px; height: 30px; border: 3px solid var(--od-surface-2); border-top-color: var(--od-primary); border-radius: 50%; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.loading-badge .lt { font-size: var(--od-text-sm); font-weight: var(--od-weight-medium); }
.loading-badge .lp { font-size: var(--od-text-xs); color: var(--od-text-muted); font-family: var(--od-font-mono); }

.poster-actions { display: flex; gap: 10px; width: 300px; }
.poster-cap { font-size: var(--od-text-xs); color: var(--od-text-muted); text-align: center; }
.poster-cap b { color: var(--od-text); font-weight: var(--od-weight-medium); }
</style>
