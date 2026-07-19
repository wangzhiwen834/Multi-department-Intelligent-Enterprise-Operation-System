<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { marked } from 'marked';

const html = ref('');
const loading = ref(true);
const err = ref('');

// GitHub 风格 slug,让目录锚点可跳转。
const slugify = (s: string) =>
  s.replace(/<[^>]+>/g, '')
    .toLowerCase()
    .replace(/[().·,!?，。、：:]/g, '')
    .trim()
    .replace(/\s+/g, '-');

onMounted(async () => {
  try {
    const r = await fetch('/manual.md', { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const md = await r.text();
    let out = await marked.parse(md) as string;
    // 给 h2/h3 注入 id,供目录锚点跳转。
    out = out.replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (_m, d: string, text: string) =>
      `<h${d} id="${slugify(text)}">${text}</h${d}>`);
    html.value = out;
  } catch (e: any) {
    err.value = e.message;
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="od-manual">
    <div v-if="loading" class="ml-state">加载中…</div>
    <div v-else-if="err" class="ml-state ml-err">手册加载失败:{{ err }}</div>
    <article v-else class="ml-article" v-html="html"></article>
  </div>
</template>

<style scoped>
.od-manual { font-family: var(--od-font-sans); color: var(--od-text); max-width: 880px; margin: 0 auto; }
.ml-state { padding: 48px; text-align: center; color: var(--od-text-muted); font-size: var(--od-text-base); }
.ml-err { color: var(--od-danger); }
.ml-article { background: var(--od-surface); border: 1px solid var(--od-border); border-radius: var(--od-radius-lg); box-shadow: var(--od-shadow-sm); padding: 36px 44px; line-height: 1.75; font-size: var(--od-text-base); }
.ml-article :deep(h1) { font-size: var(--od-text-2xl); font-weight: var(--od-weight-bold); margin: 0 0 6px; }
.ml-article :deep(h2) { font-size: var(--od-text-xl); font-weight: var(--od-weight-semibold); margin: 32px 0 14px; padding-bottom: 8px; border-bottom: 1px solid var(--od-border); scroll-margin-top: 80px; }
.ml-article :deep(h3) { font-size: var(--od-text-lg); font-weight: var(--od-weight-semibold); margin: 22px 0 10px; scroll-margin-top: 80px; }
.ml-article :deep(h4) { font-size: var(--od-text-base); font-weight: var(--od-weight-semibold); margin: 16px 0 6px; }
.ml-article :deep(p) { margin: 10px 0; }
.ml-article :deep(ul), .ml-article :deep(ol) { margin: 10px 0; padding-left: 26px; }
.ml-article :deep(li) { margin: 5px 0; }
.ml-article :deep(blockquote) { margin: 14px 0; padding: 10px 16px; background: var(--od-primary-soft); border-left: 3px solid var(--od-primary); border-radius: 0 var(--od-radius-md) var(--od-radius-md) 0; color: var(--od-text); }
.ml-article :deep(blockquote p) { margin: 0; }
.ml-article :deep(code) { font-family: var(--od-font-mono); background: var(--od-surface-2); padding: 2px 6px; border-radius: var(--od-radius-sm); font-size: 13px; }
.ml-article :deep(pre) { background: var(--od-surface-2); border: 1px solid var(--od-border); border-radius: var(--od-radius-md); padding: 14px 16px; overflow-x: auto; margin: 14px 0; }
.ml-article :deep(pre code) { background: none; padding: 0; }
.ml-article :deep(table) { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: var(--od-text-sm); }
.ml-article :deep(th), .ml-article :deep(td) { border: 1px solid var(--od-border); padding: 9px 12px; text-align: left; }
.ml-article :deep(th) { background: var(--od-surface-2); font-weight: var(--od-weight-semibold); }
.ml-article :deep(a) { color: var(--od-primary); text-decoration: none; }
.ml-article :deep(a:hover) { text-decoration: underline; }
.ml-article :deep(hr) { border: none; border-top: 1px solid var(--od-border); margin: 26px 0; }
.ml-article :deep(strong) { font-weight: var(--od-weight-semibold); }
@media (max-width: 700px) { .ml-article { padding: 22px 18px; } }
</style>
