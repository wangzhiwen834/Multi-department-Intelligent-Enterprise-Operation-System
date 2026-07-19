<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';

// 仅在生成中挂载,故计时器随挂载/卸载启停。
const elapsed = ref(0);
let t: number | undefined;
onMounted(() => { t = window.setInterval(() => elapsed.value++, 1000); });
onBeforeUnmount(() => { if (t) clearInterval(t); });
</script>

<template>
  <div class="pl-card">
    <div class="pl-orb">
      <svg class="pl-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" />
        <path d="M5 20l.7-2M19 20l-.7-2M12 19v.01" />
      </svg>
    </div>
    <div class="pl-title">AI 正在生成海报</div>
    <div class="pl-dots"><span></span><span></span><span></span></div>
    <div class="pl-bar"><i></i></div>
    <div class="pl-elapsed">已等待 {{ elapsed }} 秒 · 通常 10–30 秒</div>
  </div>
</template>

<style scoped>
.pl-card, .pl-card * { box-sizing: border-box; }
.pl-card { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 26px 30px; background: var(--od-surface); border: 1px solid var(--od-border); border-radius: var(--od-radius-lg); box-shadow: var(--od-shadow-lg); min-width: 240px; font-family: var(--od-font-sans); }
.pl-orb { width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; color: var(--od-primary); background: var(--od-primary-soft); box-shadow: 0 0 0 4px color-mix(in oklab, var(--od-primary-soft), transparent 40%); animation: pl-pulse 1.6s ease-in-out infinite; }
@keyframes pl-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
.pl-icon { animation: pl-spin 3s linear infinite; }
@keyframes pl-spin { to { transform: rotate(360deg); } }
.pl-title { font-size: var(--od-text-base); font-weight: var(--od-weight-semibold); color: var(--od-text); }
.pl-dots { display: flex; gap: 5px; height: 8px; }
.pl-dots span { width: 7px; height: 7px; border-radius: 50%; background: var(--od-primary); opacity: .35; animation: pl-bounce 1s ease-in-out infinite; }
.pl-dots span:nth-child(2) { animation-delay: .15s; }
.pl-dots span:nth-child(3) { animation-delay: .3s; }
@keyframes pl-bounce { 0%, 100% { transform: translateY(0); opacity: .35; } 50% { transform: translateY(-5px); opacity: 1; } }
.pl-bar { width: 180px; height: 4px; border-radius: 999px; background: var(--od-surface-2); overflow: hidden; position: relative; }
.pl-bar i { position: absolute; top: 0; left: -40%; width: 40%; height: 100%; border-radius: 999px; background: var(--od-primary); animation: pl-slide 1.2s ease-in-out infinite; }
@keyframes pl-slide { 0% { left: -40%; } 100% { left: 100%; } }
.pl-elapsed { font-size: var(--od-text-xs); color: var(--od-text-muted); font-family: var(--od-font-mono); }
</style>
