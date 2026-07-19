<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { Canvas, IText, FabricImage, Rect, Shadow } from 'fabric';

// 编辑画布逻辑尺寸(9:16)。导出时 multiplier=2 -> 1080×1920。
const EW = 540;
const EH = 960;
const FONT_STACK = '"PingFang SC","Microsoft YaHei","Hiragino Sans GB",sans-serif';
const COLORS = ['#ffffff', '#0f172a', '#ef4444', '#f59e0b', '#16a34a', '#2563eb', '#8b5cf6', '#ec4899'];

const props = defineProps<{
  bgImage: string;
  shopName: string;
  date: string;
}>();

const emit = defineEmits<{ (e: 'ready'): void }>();

const canvasEl = ref<HTMLCanvasElement | null>(null);
const wrapRef = ref<HTMLDivElement | null>(null);
let canvas: Canvas | null = null;
let bgImgObj: FabricImage | null = null;
let ro: ResizeObserver | null = null;

// 选中文字时的属性态
interface SelState { fontSize: number; fill: string; bold: boolean; align: 'left' | 'center' | 'right'; }
const sel = ref<SelState | null>(null);
const cropMode = ref(false);

let cropMarquee: Rect | null = null;
let cropBands: Rect[] = [];
let disposed = false;

// ---------- 显示尺寸(响应式,backstore 不变) ----------
function applyDisplaySize() {
  if (!canvas || !wrapRef.value) return;
  const cw = canvas.getWidth();
  const ch = canvas.getHeight();
  const avail = wrapRef.value.clientWidth;
  if (!avail) return;
  const dispW = Math.min(cw, avail);
  const dispH = Math.round(dispW * ch / cw);
  canvas.setDimensions({ width: dispW, height: dispH }, { cssOnly: true });
}

// ---------- 背景图(cover 铺满) ----------
async function loadBg(dataUrl: string): Promise<FabricImage> {
  const img = await FabricImage.fromURL(dataUrl);
  const s = Math.max(EW / (img.width || EW), EH / (img.height || EH));
  img.scale(s);
  img.set({
    left: (EW - (img.width || 0) * s) / 2,
    top: (EH - (img.height || 0) * s) / 2,
    selectable: false,
    evented: false,
    hoverCursor: 'default',
  });
  return img;
}

// ---------- 文字图层 ----------
function makeText(role: string, text: string, opts: Record<string, unknown>): IText {
  const t = new IText(text, {
    fontFamily: FONT_STACK,
    fill: '#ffffff',
    textAlign: 'center',
    shadow: new Shadow({ color: 'rgba(0,0,0,0.6)', blur: 6, offsetX: 0, offsetY: 2 }),
    ...opts,
  });
  (t as unknown as { role: string }).role = role;
  return t;
}

function createText(role: 'shopName' | 'date', text: string): IText {
  if (role === 'shopName') {
    return makeText('shopName', text, { fontSize: 50, fontWeight: 'bold', originX: 'center', originY: 'top', left: EW / 2, top: 56 });
  }
  return makeText('date', text, { fontSize: 22, originX: 'center', originY: 'top', left: EW / 2, top: 112 });
}

function seedTexts() {
  if (!canvas) return;
  // 店铺 / 日期未提供时不自动生成对应文字图层。
  if (props.shopName) canvas.add(createText('shopName', props.shopName));
  if (props.date) canvas.add(createText('date', props.date));
}

function findText(role: string): IText | undefined {
  if (!canvas) return undefined;
  return canvas.getObjects().find(o => (o as unknown as { role?: string }).role === role) as IText | undefined;
}

// 表单 -> 图层:有值则更新或新建,无值则移除(店铺/日期不选时图上不显示)。
function syncText(role: 'shopName' | 'date', text: string) {
  if (!canvas) return;
  const obj = findText(role);
  if (text) {
    if (obj) {
      if (obj.text === text) return;
      obj.set('text', text);
      obj.setCoords();
    } else {
      canvas.add(createText(role, text));
    }
  } else if (obj) {
    canvas.remove(obj);
  }
  canvas.requestRenderAll();
}

// ---------- 初始化 ----------
async function init() {
  if (!canvasEl.value || canvas) return;
  canvas = new Canvas(canvasEl.value, {
    preserveObjectStacking: true,
    backgroundColor: '#0f172a',
    selection: true,
  });
  canvas.setDimensions({ width: EW, height: EH });
  applyDisplaySize();

  canvas.on('selection:created', updateSel);
  canvas.on('selection:updated', updateSel);
  canvas.on('selection:cleared', () => { sel.value = null; });
  canvas.on('object:modified', updateSel);

  bgImgObj = await loadBg(props.bgImage);
  if (disposed || !canvas) return;
  canvas.add(bgImgObj);
  seedTexts();
  canvas.requestRenderAll();

  ro = new ResizeObserver(applyDisplaySize);
  if (wrapRef.value) ro.observe(wrapRef.value);
  window.addEventListener('keydown', onKey);
  emit('ready');
}

// ---------- 背景图替换(再次生成时保留文字) ----------
watch(() => props.bgImage, async (v) => {
  if (!v) return;
  if (cropMode.value) cancelCrop();
  if (!canvas) { await init(); return; }
  const nb = await loadBg(v);
  if (disposed || !canvas) return;
  if (bgImgObj) canvas.remove(bgImgObj);
  bgImgObj = nb;
  canvas.add(nb);
  canvas.sendObjectToBack(nb);
  canvas.requestRenderAll();
});

// ---------- 表单 -> 图层同步 ----------
watch(() => props.shopName, v => syncText('shopName', v));
watch(() => props.date, v => syncText('date', v));

// ---------- 选中态 ----------
function updateSel() {
  if (!canvas) return;
  const o = canvas.getActiveObject();
  if (o && o instanceof IText) {
    sel.value = {
      fontSize: Math.round(o.fontSize || 36),
      fill: typeof o.fill === 'string' ? o.fill : '#ffffff',
      bold: o.fontWeight === 'bold',
      align: (o.textAlign as 'left' | 'center' | 'right') || 'center',
    };
  } else {
    sel.value = null;
  }
}

// ---------- 工具栏:文字 ----------
function addText() {
  if (!canvas) return;
  const t = makeText('custom', '双击编辑', {
    fontSize: 36, originX: 'center', originY: 'center', left: EW / 2, top: EH / 2,
  });
  canvas.add(t);
  canvas.setActiveObject(t);
  canvas.requestRenderAll();
  updateSel();
}

function deleteSelected() {
  if (!canvas) return;
  const objs = canvas.getActiveObjects();
  if (!objs.length) return;
  objs.forEach(o => {
    canvas!.remove(o);
    if (o === bgImgObj) bgImgObj = null;
  });
  canvas.discardActiveObject();
  sel.value = null;
  canvas.requestRenderAll();
}

function onKey(e: KeyboardEvent) {
  if (!canvas) return;
  const target = e.target as HTMLElement | null;
  if (!target || !target.closest('.pe-wrap')) return; // 仅编辑区生效
  const active = canvas.getActiveObject();
  if (!active) return;
  if ((active as unknown as { isEditing?: boolean }).isEditing) return; // 文字编辑中交由 Fabric
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    deleteSelected();
  }
}

function setFontSize(d: number) {
  const o = canvas?.getActiveObject();
  if (!o || !(o instanceof IText)) return;
  o.set('fontSize', Math.max(8, Math.round((o.fontSize || 36) + d)));
  o.setCoords();
  canvas?.requestRenderAll();
  updateSel();
}
function setFill(c: string) {
  const o = canvas?.getActiveObject();
  if (!o || !(o instanceof IText)) return;
  o.set('fill', c);
  canvas?.requestRenderAll();
  updateSel();
}
function toggleBold() {
  const o = canvas?.getActiveObject();
  if (!o || !(o instanceof IText)) return;
  o.set('fontWeight', o.fontWeight === 'bold' ? 'normal' : 'bold');
  canvas?.requestRenderAll();
  updateSel();
}
function setAlign(a: 'left' | 'center' | 'right') {
  const o = canvas?.getActiveObject();
  if (!o || !(o instanceof IText)) return;
  o.set('textAlign', a);
  canvas?.requestRenderAll();
  updateSel();
}
function bringForward() {
  const o = canvas?.getActiveObject();
  if (!o) return;
  canvas!.bringObjectForward(o);
  canvas!.requestRenderAll();
}
function sendBackward() {
  const o = canvas?.getActiveObject();
  if (!o) return;
  canvas!.sendObjectBackwards(o);
  canvas!.requestRenderAll();
}

// 重新补齐被删掉的店名/日期图层(仅当表单有值时)
function resetSeedTexts() {
  if (!canvas) return;
  if (props.shopName && !findText('shopName')) canvas.add(createText('shopName', props.shopName));
  if (props.date && !findText('date')) canvas.add(createText('date', props.date));
  canvas.requestRenderAll();
}

// ---------- 裁剪(用画布当前尺寸,支持裁剪后再次裁剪) ----------
function clampMarquee() {
  const m = cropMarquee;
  if (!m || !canvas) return;
  const CW = canvas.getWidth(), CH = canvas.getHeight();
  const w = (m.width || 0) * (m.scaleX || 1);
  const h = (m.height || 0) * (m.scaleY || 1);
  let l = m.left || 0;
  let t = m.top || 0;
  if (l < 0) l = 0;
  if (t < 0) t = 0;
  if (l + w > CW) l = CW - w;
  if (t + h > CH) t = CH - h;
  m.set({ left: l, top: t });
  m.setCoords();
}
function normalizeMarquee() {
  const m = cropMarquee;
  if (!m) return;
  const w = Math.max(40, (m.width || 0) * (m.scaleX || 1));
  const h = Math.max(40, (m.height || 0) * (m.scaleY || 1));
  m.set({ width: w, height: h, scaleX: 1, scaleY: 1 });
  clampMarquee();
  m.setCoords();
}
function updateBands() {
  const m = cropMarquee;
  if (!m || !canvas) return;
  const CW = canvas.getWidth(), CH = canvas.getHeight();
  const x = m.left || 0, y = m.top || 0;
  const w = (m.width || 0) * (m.scaleX || 1), h = (m.height || 0) * (m.scaleY || 1);
  cropBands[0].set({ left: 0, top: 0, width: CW, height: Math.max(0, y) });
  cropBands[1].set({ left: 0, top: y + h, width: CW, height: Math.max(0, CH - (y + h)) });
  cropBands[2].set({ left: 0, top: y, width: Math.max(0, x), height: h });
  cropBands[3].set({ left: x + w, top: y, width: Math.max(0, CW - (x + w)), height: h });
  cropBands.forEach(b => b.setCoords());
  canvas.requestRenderAll();
}
function enterCrop() {
  if (!canvas || cropMarquee) return;
  const CW = canvas.getWidth(), CH = canvas.getHeight();
  canvas.discardActiveObject();
  canvas.getObjects().forEach(o => { o.set({ selectable: false, evented: false }); });
  canvas.selection = false;
  cropBands = [0, 1, 2, 3].map(() => new Rect({
    fill: 'rgba(0,0,0,0.55)', selectable: false, evented: false, originX: 'left', originY: 'top',
  }));
  const mw = CW * 0.7, mh = CH * 0.7;
  cropMarquee = new Rect({
    left: (CW - mw) / 2, top: (CH - mh) / 2, width: mw, height: mh,
    originX: 'left', originY: 'top',
    fill: 'transparent', stroke: '#ffffff', strokeWidth: 2,
    cornerColor: '#2563eb', cornerStrokeColor: '#2563eb', cornerSize: 10, transparentCorners: false,
    selectable: true, evented: true,
  });
  cropMarquee.setControlVisible('mtr', false); // 禁用旋转
  cropBands.forEach(b => canvas!.add(b));
  canvas.add(cropMarquee);
  updateBands();
  cropMarquee.on('moving', () => { clampMarquee(); updateBands(); });
  cropMarquee.on('scaling', updateBands);
  cropMarquee.on('modified', () => { normalizeMarquee(); updateBands(); });
  canvas.setActiveObject(cropMarquee);
  cropMode.value = true;
  canvas.requestRenderAll();
}
function applyCrop() {
  if (!canvas || !cropMarquee) return;
  normalizeMarquee();
  const m = cropMarquee;
  const x = m.left || 0, y = m.top || 0, w = m.width || 0, h = m.height || 0;
  canvas.remove(m);
  cropBands.forEach(b => canvas!.remove(b));
  cropMarquee = null;
  cropBands = [];
  // 整体平移 (-x,-y),丢弃完全落在裁剪框外的对象
  canvas.getObjects().slice().forEach(o => {
    o.set({ left: (o.left || 0) - x, top: (o.top || 0) - y });
    o.setCoords();
    const br = o.getBoundingRect();
    if (br.left + br.width <= 0 || br.top + br.height <= 0 || br.left >= w || br.top >= h) {
      canvas!.remove(o);
      if (o === bgImgObj) bgImgObj = null;
    }
  });
  canvas.setDimensions({ width: Math.round(w), height: Math.round(h) });
  canvas.getObjects().forEach(o => { if (o instanceof IText) o.set({ selectable: true, evented: true }); });
  canvas.selection = true;
  canvas.discardActiveObject();
  sel.value = null;
  cropMode.value = false;
  applyDisplaySize();
  canvas.requestRenderAll();
}
function cancelCrop() {
  if (!canvas) { cropMode.value = false; return; }
  if (cropMarquee) canvas.remove(cropMarquee);
  cropBands.forEach(b => canvas!.remove(b));
  cropMarquee = null;
  cropBands = [];
  canvas.getObjects().forEach(o => { if (o instanceof IText) o.set({ selectable: true, evented: true }); });
  canvas.selection = true;
  canvas.discardActiveObject();
  cropMode.value = false;
  canvas.requestRenderAll();
}

// ---------- 导出 ----------
function exportJpeg(): string {
  if (!canvas) return '';
  canvas.discardActiveObject();
  canvas.requestRenderAll();
  return canvas.toDataURL({ format: 'jpeg', quality: 0.92, multiplier: 2 });
}
defineExpose({ exportJpeg });

onMounted(init);
onBeforeUnmount(() => {
  disposed = true;
  window.removeEventListener('keydown', onKey);
  ro?.disconnect();
  canvas?.dispose();
  canvas = null;
});
</script>

<template>
  <div class="pe-wrap">
    <!-- 工具栏 -->
    <div class="pe-toolbar">
      <template v-if="!cropMode">
        <button class="pe-btn" @click="addText" title="添加文字图层">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>
          添加文字
        </button>
        <button class="pe-btn" :disabled="!sel" @click="deleteSelected" title="删除选中">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/></svg>
          删除
        </button>
        <button class="pe-btn" @click="enterCrop" title="裁剪整张海报">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14"/></svg>
          裁剪
        </button>
        <button class="pe-btn" @click="resetSeedTexts" title="补回店名/日期/文案">重置文字</button>
        <span class="pe-sep"></span>
        <button class="pe-btn icon" :disabled="!sel" @click="bringForward" title="上移一层">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
        </button>
        <button class="pe-btn icon" :disabled="!sel" @click="sendBackward" title="下移一层">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
        </button>
      </template>
      <template v-else>
        <span class="pe-hint">拖动 / 缩放白框选裁剪范围</span>
        <button class="pe-btn primary" @click="applyCrop">应用裁剪</button>
        <button class="pe-btn" @click="cancelCrop">取消</button>
      </template>

      <!-- 文字属性条 -->
      <span v-if="sel && !cropMode" class="pe-props">
        <span class="pe-sep"></span>
        <button class="pe-btn icon" @click="setFontSize(-2)" title="字号 −">A−</button>
        <span class="pe-num">{{ sel.fontSize }}</span>
        <button class="pe-btn icon" @click="setFontSize(2)" title="字号 +">A+</button>
        <button class="pe-btn icon" :class="{ on: sel.bold }" @click="toggleBold" title="加粗"><b>B</b></button>
        <button class="pe-btn icon" :class="{ on: sel.align === 'left' }" @click="setAlign('left')" title="左对齐">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h12M3 18h15"/></svg>
        </button>
        <button class="pe-btn icon" :class="{ on: sel.align === 'center' }" @click="setAlign('center')" title="居中">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M6 12h12M4 18h16"/></svg>
        </button>
        <button class="pe-btn icon" :class="{ on: sel.align === 'right' }" @click="setAlign('right')" title="右对齐">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M9 12h12M6 18h15"/></svg>
        </button>
        <span class="pe-swatches">
          <button v-for="c in COLORS" :key="c" class="pe-sw" :class="{ on: sel.fill === c }" :style="{ background: c }" @click="setFill(c)" :title="c"></button>
        </span>
      </span>
    </div>

    <!-- 画布舞台 -->
    <div class="pe-stage">
      <div class="pe-canvas-wrap" ref="wrapRef">
        <canvas ref="canvasEl"></canvas>
      </div>
      <p class="pe-tip">双击文字可直接编辑内容;拖动调整位置;选中后可改字号 / 颜色 / 对齐 / 层级。裁剪作用于整张海报。</p>
    </div>
  </div>
</template>

<style scoped>
.pe-wrap, .pe-wrap * { box-sizing: border-box; }
.pe-wrap { display: flex; flex-direction: column; gap: var(--od-space-3); font-family: var(--od-font-sans); }

.pe-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 10px 12px; background: var(--od-surface); border: 1px solid var(--od-border); border-radius: var(--od-radius-lg); box-shadow: var(--od-shadow-sm); }
.pe-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 32px; min-width: 32px; padding: 0 10px; border: 1px solid var(--od-border); border-radius: var(--od-radius-md); background: var(--od-surface); color: var(--od-text); font-size: var(--od-text-sm); font-weight: var(--od-weight-medium); cursor: pointer; transition: all .15s; }
.pe-btn.icon { padding: 0; width: 32px; font-size: 13px; }
.pe-btn:hover:not(:disabled) { background: var(--od-surface-2); border-color: color-mix(in oklab, var(--od-border), black 10%); }
.pe-btn:disabled { opacity: .4; cursor: not-allowed; }
.pe-btn.primary { background: var(--od-primary); border-color: var(--od-primary); color: #fff; }
.pe-btn.primary:hover { background: var(--od-primary-hover); }
.pe-btn.on { background: var(--od-primary-soft); border-color: var(--od-primary); color: var(--od-primary-hover); }
.pe-sep { width: 1px; height: 20px; background: var(--od-border); margin: 0 4px; }
.pe-hint { font-size: var(--od-text-sm); color: var(--od-text-muted); margin-right: auto; }
.pe-num { font-size: var(--od-text-xs); color: var(--od-text-muted); font-family: var(--od-font-mono); min-width: 24px; text-align: center; }
.pe-props { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; }
.pe-swatches { display: inline-flex; gap: 4px; margin-left: 4px; }
.pe-sw { width: 20px; height: 20px; border-radius: 50%; border: 2px solid var(--od-border); cursor: pointer; padding: 0; }
.pe-sw.on { border-color: var(--od-primary); box-shadow: 0 0 0 2px var(--od-primary-soft); }

.pe-stage { display: flex; flex-direction: column; align-items: center; gap: var(--od-space-2); }
.pe-canvas-wrap { width: 100%; max-width: 540px; display: flex; justify-content: center; border-radius: var(--od-radius-lg); overflow: hidden; box-shadow: var(--od-shadow-lg); border: 1px solid var(--od-border); background: var(--od-surface-2); }
.pe-canvas-wrap :deep(canvas) { display: block; max-width: 100%; }
.pe-tip { font-size: var(--od-text-xs); color: var(--od-text-muted); text-align: center; max-width: 540px; }
</style>
