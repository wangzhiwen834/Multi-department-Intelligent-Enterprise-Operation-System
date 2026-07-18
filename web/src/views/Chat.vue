<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue';
import { api } from '../api';

const props = defineProps<{ period: string }>();
const emit = defineEmits<{ (e: 'back'): void }>();

interface Msg { role: 'user' | 'assistant'; content: string }
const messages = ref<Msg[]>([
  { role: 'assistant', content: '你好,我是经营分析助手。可以问我:本月总营收多少?任务完成进度如何?哪家店客流最高?7 月维修费有哪些?……' },
]);
const input = ref('');
const loading = ref(false);
const listRef = ref<HTMLDivElement | null>(null);
const model = ref('');
onMounted(() => { api.aiInfo().then(i => model.value = i.chatModel); });

const scroll = () => nextTick(() => listRef.value?.scrollTo({ top: listRef.value.scrollHeight }));

const send = async () => {
  const m = input.value.trim();
  if (!m || loading.value) return;
  input.value = '';
  messages.value.push({ role: 'user', content: m });
  loading.value = true;
  await scroll();
  try {
    const r = await api.aiChat(m, props.period);
    messages.value.push({ role: 'assistant', content: r.answer });
  } catch (e: any) {
    messages.value.push({ role: 'assistant', content: `出错:${e.message}` });
  } finally {
    loading.value = false;
    await scroll();
  }
};

const suggestions = ['本月总营收多少?任务完成进度如何?', '5 家店营收排名怎样?', '本月维修费有哪些?'];
const ask = (s: string) => { input.value = s; send(); };
</script>

<template>
  <div class="od-chat">
    <div class="chat">

      <!-- 模型标识条 -->
      <div class="model-bar">
        <div class="model-tag">
          <span class="model-dot"></span>当前模型<b>{{ model || '加载中…' }}</b>
        </div>
        <div class="model-meta"><span>上下文:{{ period }}</span></div>
      </div>

      <!-- 消息流 -->
      <div ref="listRef" class="stream">
        <div v-for="(m, i) in messages" :key="i" class="msg" :class="m.role === 'user' ? 'user' : 'ai'">
          <div v-if="m.role === 'user'" class="av user">我</div>
          <div v-else class="av ai">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z" fill="#ffffff"/></svg>
          </div>
          <div class="bubble">{{ m.content }}</div>
        </div>

        <!-- 思考中态 -->
        <div v-if="loading" class="msg ai">
          <div class="av ai">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z" fill="#ffffff"/></svg>
          </div>
          <div>
            <div class="loading-bubble"><i></i><i></i><i></i></div>
            <div class="loading-meta">正在分析数据,请稍候…</div>
          </div>
        </div>

        <!-- 欢迎建议(仅初始问候后、未提问时展示) -->
        <div v-if="messages.length === 1 && !loading" class="suggest-q">
          <button v-for="s in suggestions" :key="s" class="sq" @click="ask(s)">
            <span class="sq-ico">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17l6-6 4 4 7-7"/><path d="M21 8v5h-5"/></svg>
            </span>
            <span>{{ s }}</span>
            <span class="sq-go">-&gt;</span>
          </button>
        </div>
      </div>

      <!-- 输入框 -->
      <form class="composer" @submit.prevent="send">
        <div class="composer-inner">
          <input v-model="input" :disabled="loading" placeholder="输入你的经营问题,如:本月总营收多少?" />
          <button class="send-btn" type="submit" :disabled="loading" aria-label="发送">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/></svg>
          </button>
        </div>
        <div class="composer-foot">
          <span>AI 基于历史数据生成,关键决策请结合实际核对</span>
          <span>Enter 发送</span>
        </div>
      </form>

    </div>
  </div>
</template>

<style scoped>
/* 令牌 --od-* 为全局,定义于 styles\tokens.css。此处仅本页局部样式(移植自 Opendesign\ai-chat.html,移除 :root)。 */
.od-chat {
  height: 100%;
  display: flex;
  justify-content: center;
  font-family: var(--od-font-sans);
  color: var(--od-text);
  font-size: var(--od-text-base);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}
.od-chat * { box-sizing: border-box; }
.num { font-family: var(--od-font-mono); font-variant-numeric: tabular-nums; }
button { font-family: inherit; cursor: pointer; border: none; background: none; }

/* 对话容器 */
.chat {
  width: 100%;
  max-width: 820px;
  background: var(--od-surface);
  border: 1px solid var(--od-border);
  border-radius: var(--od-radius-lg);
  box-shadow: var(--od-shadow-sm);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* 模型标识条 */
.model-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px var(--od-space-5);
  background: linear-gradient(90deg, var(--od-primary-soft), color-mix(in oklab, var(--od-primary-soft), white 35%));
  border-bottom: 1px solid var(--od-border);
  flex-shrink: 0;
}
.model-tag { display: flex; align-items: center; gap: 8px; font-size: var(--od-text-sm); color: var(--od-text); }
.model-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--od-primary); box-shadow: 0 0 0 3px var(--od-primary-soft); }
.model-tag b { font-weight: var(--od-weight-semibold); }
.model-meta { font-size: var(--od-text-xs); color: var(--od-text-muted); display: flex; align-items: center; gap: 10px; }

/* 消息流 */
.stream {
  flex: 1; overflow-y: auto;
  padding: var(--od-space-5);
  display: flex; flex-direction: column; gap: var(--od-space-5);
}
.msg { display: flex; gap: var(--od-space-3); max-width: 88%; }
.msg.user { align-self: flex-end; flex-direction: row-reverse; }
.av { width: 32px; height: 32px; border-radius: var(--od-radius-full); display: grid; place-items: center; flex-shrink: 0; font-size: 14px; }
.av.ai { background: linear-gradient(135deg, var(--od-primary), var(--od-palette-1)); color: #fff; }
.av.user { background: var(--od-surface-2); color: var(--od-text); }
.bubble {
  padding: 11px 14px;
  border-radius: var(--od-radius-lg);
  font-size: var(--od-text-sm);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
.msg.ai .bubble { background: var(--od-surface); border: 1px solid var(--od-border); border-top-left-radius: 4px; }
.msg.user .bubble { background: var(--od-primary); color: #fff; border-top-right-radius: 4px; }

/* 加载态 */
.loading-bubble {
  display: flex; align-items: center; gap: 5px;
  padding: 14px 16px;
  background: var(--od-surface-2);
  border: 1px solid var(--od-border);
  border-radius: var(--od-radius-lg);
  border-top-left-radius: 4px;
  width: fit-content;
}
.loading-bubble i { width: 7px; height: 7px; border-radius: 50%; background: var(--od-text-muted); animation: blink 1.4s infinite both; }
.loading-bubble i:nth-child(2) { animation-delay: .2s; }
.loading-bubble i:nth-child(3) { animation-delay: .4s; }
@keyframes blink { 0%, 80%, 100% { opacity: .3; } 40% { opacity: 1; } }
.loading-meta { font-size: var(--od-text-xs); color: var(--od-text-muted); margin-left: 10px; margin-top: 6px; }

/* 欢迎建议 */
.suggest-q { display: flex; flex-direction: column; gap: 8px; width: 100%; max-width: 440px; margin-top: var(--od-space-2); }
.sq {
  display: flex; align-items: center; gap: 10px;
  padding: 11px 14px;
  background: var(--od-surface);
  border: 1px solid var(--od-border);
  border-radius: var(--od-radius-md);
  font-size: var(--od-text-sm);
  text-align: left;
  color: var(--od-text);
  transition: all .15s;
}
.sq:hover { border-color: var(--od-primary); background: var(--od-primary-soft); color: var(--od-primary-hover); }
.sq .sq-ico { width: 28px; height: 28px; border-radius: var(--od-radius-sm); background: var(--od-primary-soft); color: var(--od-primary); display: grid; place-items: center; flex-shrink: 0; }
.sq .sq-go { margin-left: auto; color: var(--od-text-muted); }

/* 输入框 */
.composer { border-top: 1px solid var(--od-border); padding: var(--od-space-3) var(--od-space-4); background: var(--od-surface); flex-shrink: 0; }
.composer-inner {
  display: flex; align-items: flex-end; gap: var(--od-space-2);
  background: var(--od-surface-2);
  border: 1px solid var(--od-border);
  border-radius: var(--od-radius-lg);
  padding: 6px 6px 6px 14px;
  transition: all .15s;
}
.composer-inner:focus-within { border-color: var(--od-primary); box-shadow: 0 0 0 3px var(--od-primary-soft); background: var(--od-surface); }
.composer-inner input {
  flex: 1; border: none; background: none; outline: none;
  font-family: inherit; font-size: var(--od-text-sm); color: var(--od-text);
  padding: 8px 0; resize: none;
}
.composer-inner input::placeholder { color: color-mix(in oklab, var(--od-text-muted), white 18%); }
.composer-inner input:disabled { opacity: .6; }
.send-btn {
  width: 36px; height: 36px;
  border-radius: var(--od-radius-md);
  background: var(--od-primary); color: #fff;
  display: grid; place-items: center; flex-shrink: 0;
  transition: all .15s;
}
.send-btn:hover:not(:disabled) { background: var(--od-primary-hover); }
.send-btn:disabled { opacity: .4; cursor: not-allowed; }
.composer-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; font-size: var(--od-text-xs); color: var(--od-text-muted); }
</style>
