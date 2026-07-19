<script setup lang="ts">
import { ref, computed, onMounted, useTemplateRef, watch } from 'vue';
import { api } from '../api';
import type { Shop } from '../types';
import PosterEditor from './PosterEditor.vue';
import PosterLoading from './PosterLoading.vue';

const emit = defineEmits<{ (e: 'back'): void }>();

const shops = ref<Shop[]>([]);
const shopId = ref<number | null>(null);
const prompt = ref('足浴店周末养生特惠海报,温馨暖色调,画面中央木质足浴桶与袅袅热气,周围点缀艾草和绿植,顶部底部留白用于文字,柔和暖光,高清摄影质感');
const date = ref(new Date().toISOString().slice(0, 10));
// 风格可选:'' 表示无风格(不追加色调关键词)。预设按足浴店性质:养生 / 温暖 / 高端 / 喜庆 / 草本。
const style = ref('');
const styles = [
  { key: '养生禅意', kw: '禅意养生,原木米色调,绿色点缀,宁静留白', sw: 'linear-gradient(135deg,#6b8e6b,#c2b280)' },
  { key: '温暖柔和', kw: '温暖柔和,暖橙暖黄调,温馨光晕', sw: 'linear-gradient(135deg,#e8915a,#f2c572)' },
  { key: '高端会所', kw: '高端会所,黑金奢华,深色质感', sw: 'linear-gradient(135deg,#2a2a2a,#c9a227)' },
  { key: '节日喜庆', kw: '节日喜庆,中国红金,热闹氛围', sw: 'linear-gradient(135deg,#c0392b,#e67e22)' },
  { key: '清新草本', kw: '清新草本,浅绿淡雅,自然通透', sw: 'linear-gradient(135deg,#7bb661,#a8d5a2)' },
];
const styleKw = computed(() => styles.find(s => s.key === style.value)?.kw ?? '');
// 提示词模板:本机 localStorage 持久化,支持自定义增删改。首次加载若无存档则写入默认模板。
interface PromptTemplate { name: string; text: string; }
const TPL_KEY = 'poster.promptTemplates';
const DEFAULT_TEMPLATES: PromptTemplate[] = [
  { name: '周末养生特惠', text: '足浴店周末养生特惠海报,温馨暖色调,画面中央木质足浴桶与袅袅热气,周围点缀艾草和绿植,顶部底部留白用于文字,柔和暖光,高清摄影质感' },
  { name: '节日促销', text: '足浴店节日促销海报,喜庆暖红金色调,木桶足浴与灯笼艾草元素,热闹节日氛围,顶部底部留白用于文字,高清质感' },
  { name: '会员招募', text: '足浴店会员招募海报,高端会所质感,深色背景金色点缀,足浴与养生草本,顶部底部留白用于文字,奢华光感' },
  { name: '新店开业', text: '足浴店新店开业海报,明亮温馨色调,整洁足浴空间与绿植盆栽,开业喜庆氛围,顶部底部留白用于文字,高清摄影' },
  { name: '节气养生', text: '足浴店节气养生海报,自然清新色调,艾草木桶与节气元素,宁静养生氛围,顶部底部留白用于文字,柔和光晕' },
];
function loadTemplates(): PromptTemplate[] {
  try {
    const raw = localStorage.getItem(TPL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as PromptTemplate[];
    }
  } catch { /* ignore */ }
  return DEFAULT_TEMPLATES.slice();
}
const templates = ref<PromptTemplate[]>(loadTemplates());
watch(templates, v => { try { localStorage.setItem(TPL_KEY, JSON.stringify(v)); } catch { /* ignore */ } }, { deep: true });

const promptTpl = ref('');
const applyTpl = () => { if (promptTpl.value) prompt.value = promptTpl.value; };
const showTplMgr = ref(false);
const newTplName = ref('');
const newTplText = ref('');
const addTpl = () => {
  const n = newTplName.value.trim();
  const t = newTplText.value.trim();
  if (!n || !t) return;
  templates.value.push({ name: n, text: t });
  newTplName.value = '';
  newTplText.value = '';
};
const removeTpl = (i: number) => { templates.value.splice(i, 1); };
const loading = ref(false);
const err = ref('');
const bgImage = ref('');
const model = ref('');
const editorRef = useTemplateRef<InstanceType<typeof PosterEditor>>('editorRef');

const shopName = computed(() => shops.value.find(s => s.id === shopId.value)?.name ?? '');
onMounted(() => {
  api.shops().then(r => { shops.value = r; });
  api.aiInfo().then(i => model.value = i.posterModel);
});

const generate = async () => {
  loading.value = true; err.value = '';
  try {
    const full = styleKw.value ? `${prompt.value},${styleKw.value}` : prompt.value;
    const r = await api.posterGenerate(full);
    bgImage.value = r.image;
  } catch (e: any) { err.value = e.message; } finally { loading.value = false; }
};

const download = () => {
  const url = editorRef.value?.exportJpeg();
  if (!url) return;
  const a = document.createElement('a');
  a.href = url;
  a.download = `海报_${shopName.value || '通用'}_${date.value || '无日期'}.jpg`;
  a.click();
};
</script>

<template>
  <div class="od-poster">
    <div class="page-head">
      <div>
        <h1 class="page-title">AI 每日海报</h1>
        <p class="page-sub">选填店铺与日期,AI 生成文生图背景,生成后可在图上编辑文字、裁剪、加图层。</p>
      </div>
      <div class="model-tag"><span class="model-dot"></span>模型 <b>{{ model || '加载中…' }}</b></div>
    </div>

    <div class="layout">
      <!-- 左:配置区 -->
      <div class="card">
        <div class="card-h">海报配置</div>
        <div class="card-desc">提示词驱动文生图背景,生成后在画布上直接编辑店名 / 日期,可新增文字、裁剪、调层级。</div>

        <div class="field">
          <label>店铺 <span class="opt-tag">选填</span></label>
          <select v-model="shopId" class="select">
            <option :value="null">通用(不选店铺)</option>
            <option v-for="s in shops" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
          <div class="hint-txt">不选店铺时,店名文字可在生成后的图上自行编辑或删除。</div>
        </div>

        <div class="field">
          <label>日期 <span class="opt-tag">选填</span></label>
          <div class="date-row">
            <input v-model="date" type="date" class="input" />
            <button v-if="date" class="clear-btn" type="button" @click="date = ''" title="清除日期">×</button>
          </div>
          <div class="hint-txt">不选日期时图上不显示日期文字。</div>
        </div>

        <div class="field">
          <label>风格 <span class="opt-tag">选填</span></label>
          <div class="style-grid">
            <div class="style-opt" :class="{ active: style === '' }" role="button" tabindex="0"
                 @click="style = ''" @keydown.enter="style = ''">
              <span class="style-sw style-sw-none"></span>无风格
            </div>
            <div v-for="s in styles" :key="s.key" class="style-opt" :class="{ active: style === s.key }"
              role="button" tabindex="0" @click="style = s.key" @keydown.enter="style = s.key">
              <span class="style-sw" :style="{ background: s.sw }"></span>{{ s.key }}
            </div>
          </div>
          <div class="hint-txt">可选;选中风格的色调会追加到提示词,影响背景。</div>
        </div>

        <div class="field">
          <label>提示词</label>
          <div class="tpl-bar">
            <select v-model="promptTpl" class="select" @change="applyTpl">
              <option value="">选择提示词模板…</option>
              <option v-for="(t, i) in templates" :key="i" :value="t.text">{{ t.name }}</option>
            </select>
            <button class="btn btn-ghost tpl-mgr-btn" type="button" @click="showTplMgr = true">管理</button>
          </div>
          <textarea v-model="prompt" class="input" rows="4" style="margin-top:8px" placeholder="描述背景主视觉,如:足浴店周末养生特惠,温馨暖色调,木质足浴桶与艾草,顶部底部留白…"></textarea>
          <div class="hint-txt">可从模板载入完整示例后再微调;点「管理」可自定义增删改模板。</div>
        </div>

        <div v-if="err" class="err-box">{{ err }}</div>

        <div class="divider"></div>

        <button class="btn btn-primary" :disabled="loading" @click="generate">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M5 20l.7-2M19 20l-.7-2M12 19v.01"/></svg>
          {{ loading ? '生成中…' : '生成海报' }}
        </button>
        <div class="hint-txt" style="text-align:center;margin-top:8px">预计耗时约 10-30 秒</div>
      </div>

      <!-- 右:预览区 -->
      <div class="preview-area">
        <div class="preview-block">
          <span class="preview-label">海报编辑 · 竖版 1080 × 1920</span>
          <div class="poster-row">
            <div class="poster-cell">
              <!-- 首次:占位 / 生成中骨架(尚无图) -->
              <div v-if="!bgImage" class="poster" :class="loading ? 'loading' : 'placeholder'">
                <template v-if="!loading">
                  <div class="ph">
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                    <div class="ph-t">填写左侧配置并点"生成海报"</div>
                    <div class="ph-s">生成后可在图上编辑文字、裁剪</div>
                  </div>
                </template>
                <template v-else>
                  <PosterLoading />
                </template>
              </div>

              <!-- 编辑器(已生成过;再次生成时叠加遮罩,保留文字编辑) -->
              <template v-else>
                <div class="pe-host">
                  <PosterEditor ref="editorRef" :bg-image="bgImage" :shop-name="shopName" :date="date" />
                  <div v-if="loading" class="gen-overlay">
                    <PosterLoading />
                  </div>
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

    <!-- 提示词模板管理弹窗(本机 localStorage 持久化,自定义增删改) -->
    <div v-if="showTplMgr" class="tpl-mask" @click.self="showTplMgr = false">
      <div class="tpl-modal" role="dialog" aria-modal="true">
        <div class="tpl-head">
          <span>管理提示词模板</span>
          <button class="tpl-close" type="button" @click="showTplMgr = false" aria-label="关闭">×</button>
        </div>
        <div class="tpl-list">
          <div v-for="(t, i) in templates" :key="i" class="tpl-row">
            <input v-model="t.name" class="input tpl-name" placeholder="模板名" />
            <textarea v-model="t.text" class="input tpl-text" rows="2" placeholder="提示词内容"></textarea>
            <button class="tpl-del" type="button" @click="removeTpl(i)" title="删除该模板">删除</button>
          </div>
          <div v-if="!templates.length" class="tpl-empty">暂无模板,可在下方新增。</div>
        </div>
        <div class="tpl-new">
          <div class="tpl-new-title">新增模板</div>
          <input v-model="newTplName" class="input tpl-name" placeholder="模板名" />
          <textarea v-model="newTplText" class="input tpl-text" rows="2" placeholder="提示词内容"></textarea>
          <button class="btn btn-primary tpl-add" type="button" @click="addTpl">添加</button>
        </div>
        <div class="tpl-foot">模板保存在本机浏览器(localStorage),修改即时保存;不同浏览器/设备不共享。</div>
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
.style-sw-none { background: var(--od-surface-2); border: 1px dashed var(--od-text-muted); position: relative; }
.style-sw-none::after { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, transparent 44%, var(--od-text-muted) 44%, var(--od-text-muted) 56%, transparent 56%); border-radius: var(--od-radius-sm); }

.opt-tag { display: inline-block; font-size: var(--od-text-xs); font-weight: var(--od-weight-medium); color: var(--od-text-muted); background: var(--od-surface-2); border: 1px solid var(--od-border); border-radius: var(--od-radius-full); padding: 1px 7px; margin-left: 6px; vertical-align: middle; }

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
.poster { width: 100%; max-width: 540px; aspect-ratio: 9 / 16; border-radius: var(--od-radius-lg); overflow: hidden; position: relative; box-shadow: var(--od-shadow-lg); border: 1px solid var(--od-border); }

/* 占位态 */
.poster.placeholder { background: var(--od-surface-2); display: grid; place-items: center; }
.poster.placeholder .ph { display: flex; flex-direction: column; align-items: center; gap: 10px; color: var(--od-text-muted); text-align: center; padding: 20px; }
.poster.placeholder .ph-t { font-size: var(--od-text-sm); font-weight: var(--od-weight-medium); color: var(--od-text); }
.poster.placeholder .ph-s { font-size: var(--od-text-xs); }

/* 生成中:居中加载卡(PosterLoading 组件) */
.poster.loading { background: var(--od-surface-2); display: grid; place-items: center; }

.poster-actions { display: flex; gap: 10px; width: 100%; max-width: 540px; }
.poster-cap { font-size: var(--od-text-xs); color: var(--od-text-muted); text-align: center; }
.poster-cap b { color: var(--od-text); font-weight: var(--od-weight-medium); }

/* 编辑器宿主 + 再生成遮罩 */
.pe-host { position: relative; width: 540px; max-width: 100%; }
.gen-overlay { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(15, 23, 42, 0.45); border-radius: var(--od-radius-lg); z-index: 5; }

/* 日期清除 */
.date-row { display: flex; gap: 8px; align-items: center; }
.date-row .input { flex: 1; }
.clear-btn { flex-shrink: 0; width: 32px; height: 40px; border: 1px solid var(--od-border); border-radius: var(--od-radius-md); background: var(--od-surface); color: var(--od-text-muted); font-size: 18px; line-height: 1; cursor: pointer; transition: all .15s; }
.clear-btn:hover { background: var(--od-surface-2); color: var(--od-danger); border-color: color-mix(in oklab, var(--od-danger), white 30%); }

/* 提示词模板栏 + 管理按钮 */
.tpl-bar { display: flex; gap: 8px; }
.tpl-bar .select { flex: 1; }
.tpl-mgr-btn { width: auto; min-width: 64px; padding: 0 14px; flex-shrink: 0; }

/* 模板管理弹窗 */
.tpl-mask { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.5); display: grid; place-items: center; z-index: 100; padding: 20px; }
.tpl-modal { width: 100%; max-width: 560px; max-height: 85vh; display: flex; flex-direction: column; background: var(--od-surface); border: 1px solid var(--od-border); border-radius: var(--od-radius-lg); box-shadow: var(--od-shadow-lg); overflow: hidden; }
.tpl-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid var(--od-border); font-size: var(--od-text-lg); font-weight: var(--od-weight-semibold); }
.tpl-close { width: 28px; height: 28px; border: none; background: none; color: var(--od-text-muted); font-size: 20px; line-height: 1; cursor: pointer; border-radius: var(--od-radius-sm); }
.tpl-close:hover { background: var(--od-surface-2); color: var(--od-text); }
.tpl-list { flex: 1; overflow-y: auto; padding: 14px 18px; display: flex; flex-direction: column; gap: 12px; }
.tpl-row { display: grid; grid-template-columns: 140px 1fr auto; gap: 8px; align-items: start; }
.tpl-row .tpl-name { height: 40px; }
.tpl-row .tpl-text { height: auto; min-height: 60px; padding: 8px 12px; background-image: none; padding-right: 12px; resize: vertical; line-height: 1.5; }
.tpl-del { height: 40px; padding: 0 12px; border: 1px solid color-mix(in oklab, var(--od-danger), white 30%); border-radius: var(--od-radius-md); background: var(--od-danger-soft); color: var(--od-danger); font-size: var(--od-text-sm); cursor: pointer; white-space: nowrap; }
.tpl-del:hover { background: color-mix(in oklab, var(--od-danger-soft), var(--od-danger) 15%); }
.tpl-empty { font-size: var(--od-text-sm); color: var(--od-text-muted); text-align: center; padding: 16px 0; }
.tpl-new { border-top: 1px solid var(--od-border); padding: 14px 18px; display: grid; grid-template-columns: 140px 1fr auto; gap: 8px; align-items: start; }
.tpl-new-title { grid-column: 1 / -1; font-size: var(--od-text-sm); font-weight: var(--od-weight-semibold); margin-bottom: 2px; }
.tpl-new .tpl-name { height: 40px; }
.tpl-new .tpl-text { height: auto; min-height: 60px; padding: 8px 12px; background-image: none; padding-right: 12px; resize: vertical; line-height: 1.5; }
.tpl-add { height: 40px; width: auto; padding: 0 16px; }
.tpl-foot { padding: 10px 18px; border-top: 1px solid var(--od-border); font-size: var(--od-text-xs); color: var(--od-text-muted); background: var(--od-surface-2); }
@media (max-width: 560px) { .tpl-row, .tpl-new { grid-template-columns: 1fr; } .tpl-add, .tpl-del { width: 100%; } }
</style>
