<script setup lang="ts">
import * as echarts from 'echarts';
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import type { Theme } from '../theme';

const props = defineProps<{ option: echarts.EChartsOption; theme: Theme; onClick?: (p: any) => void }>();
const el = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;
let ro: ResizeObserver | null = null;

onMounted(() => {
  if (!el.value) return;
  chart = echarts.init(el.value);
  chart.setOption(props.option, true);
  if (props.onClick) chart.on('click', props.onClick);
  ro = new ResizeObserver(() => chart?.resize());
  ro.observe(el.value);
});
watch(() => props.option, (o) => { chart?.setOption(o, true); });
watch(() => props.theme, () => { chart?.resize(); });
onBeforeUnmount(() => { ro?.disconnect(); chart?.dispose(); chart = null; });
</script>

<template>
  <div ref="el" class="h-full w-full"></div>
</template>
