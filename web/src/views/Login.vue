<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { api } from '../api';
import type { User } from '../types';

const emit = defineEmits<{ (e: 'login', u: User, t: string): void }>();
const username = ref('');
const password = ref('');
const err = ref('');
const showPwd = ref(false);
const shake = ref(false);
const remember = ref(false);

const submit = async () => {
  try {
    const r = await api.login(username.value, password.value);
    emit('login', r.user, r.token);
  } catch (e: any) {
    err.value = e.message;
    shake.value = true;
    setTimeout(() => shake.value = false, 500);
  }
};

/* ========== Canvas 科技粒子背景 ========== */
const canvasRef = ref<HTMLCanvasElement | null>(null);
let raf: number;

onMounted(() => {
  const c = canvasRef.value;
  if (!c) return;
  const ctx = c.getContext('2d')!;
  let w = 0, h = 0;

  interface Dot { x: number; y: number; vx: number; vy: number; r: number; color: string }
  const dots: Dot[] = [];
  const mouse = { x: -9999, y: -9999 };

  const colors = [
    '100,180,255',   // 亮蓝
    '80,200,240',    // 青蓝
    '140,160,255',   // 紫蓝
    '120,220,200',   // 青绿
  ];

  const resize = () => {
    w = c!.width = window.innerWidth;
    h = c!.height = window.innerHeight;
  };
  resize();
  window.addEventListener('resize', resize);

  const count = Math.min(180, Math.floor((w * h) / 9000));
  for (let i = 0; i < count; i++) {
    dots.push({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
      r: Math.random() * 2.5 + 1.2,
      color: colors[Math.floor(Math.random() * colors.length)],
    });
  }

  // 流星
  interface Meteor { x: number; y: number; vx: number; vy: number; len: number; life: number; maxLife: number }
  const meteors: Meteor[] = [];
  const spawnMeteor = () => {
    if (meteors.length > 3) return;
    const side = Math.random() > 0.5 ? 'top' : 'left';
    const m: Meteor = side === 'top'
      ? { x: Math.random() * w, y: -50, vx: (Math.random() - 0.3) * 3, vy: Math.random() * 3 + 2, len: Math.random() * 80 + 40, life: 0, maxLife: Math.random() * 60 + 40 }
      : { x: -50, y: Math.random() * h * 0.5, vx: Math.random() * 4 + 2, vy: Math.random() * 2 + 1, len: Math.random() * 80 + 40, life: 0, maxLife: Math.random() * 60 + 40 };
    meteors.push(m);
  };

  const onMove = (e: MouseEvent) => { mouse.x = e.clientX; mouse.y = e.clientY; };
  window.addEventListener('mousemove', onMove);

  let frame = 0;
  const draw = () => {
    frame++;
    ctx.clearRect(0, 0, w, h);

    // 1. 科技网格(底层)
    const gridSize = 60;
    ctx.strokeStyle = 'rgba(60,100,180,0.06)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < w; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // 2. 连线(更亮更粗)
    for (let i = 0; i < dots.length; i++) {
      for (let j = i + 1; j < dots.length; j++) {
        const dx = dots[i].x - dots[j].x;
        const dy = dots[i].y - dots[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 180) {
          const alpha = (1 - dist / 180) * 0.35;
          ctx.beginPath();
          ctx.strokeStyle = `rgba(100,170,255,${alpha})`;
          ctx.lineWidth = 1;
          ctx.moveTo(dots[i].x, dots[i].y);
          ctx.lineTo(dots[j].x, dots[j].y);
          ctx.stroke();
        }
      }
    }

    // 3. 粒子(发光 + 鼠标吸引)
    for (const d of dots) {
      // 鼠标吸引
      const mdx = mouse.x - d.x;
      const mdy = mouse.y - d.y;
      const md = Math.sqrt(mdx * mdx + mdy * mdy);
      if (md < 250 && md > 10) {
        d.vx += (mdx / md) * 0.015;
        d.vy += (mdy / md) * 0.015;
      }
      // 速度衰减
      d.vx *= 0.998;
      d.vy *= 0.998;
      // 最小速度
      if (Math.abs(d.vx) < 0.1) d.vx += (Math.random() - 0.5) * 0.05;
      if (Math.abs(d.vy) < 0.1) d.vy += (Math.random() - 0.5) * 0.05;

      d.x += d.vx;
      d.y += d.vy;
      if (d.x < -20) d.x = w + 20;
      if (d.x > w + 20) d.x = -20;
      if (d.y < -20) d.y = h + 20;
      if (d.y > h + 20) d.y = -20;

      const glow = md < 200 ? (1 - md / 200) * 0.9 + 0.3 : 0.35;

      // 发光
      ctx.save();
      ctx.shadowBlur = md < 150 ? 12 : 6;
      ctx.shadowColor = `rgba(${d.color},${glow * 0.6})`;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${d.color},${glow})`;
      ctx.fill();
      ctx.restore();
    }

    // 4. 流星
    if (frame % 120 === 0) spawnMeteor();
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      m.x += m.vx;
      m.y += m.vy;
      m.life++;
      const lifeRatio = m.life / m.maxLife;
      const alpha = lifeRatio < 0.1 ? lifeRatio / 0.1 : lifeRatio > 0.8 ? (1 - lifeRatio) / 0.2 : 1;

      const tailX = m.x - m.vx * (m.len / Math.sqrt(m.vx * m.vx + m.vy * m.vy));
      const tailY = m.y - m.vy * (m.len / Math.sqrt(m.vx * m.vx + m.vy * m.vy));

      const grad = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
      grad.addColorStop(0, `rgba(180,220,255,${alpha})`);
      grad.addColorStop(1, 'rgba(180,220,255,0)');

      ctx.save();
      ctx.shadowBlur = 10;
      ctx.shadowColor = `rgba(150,200,255,${alpha * 0.5})`;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(tailX, tailY);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      if (m.life >= m.maxLife || m.x > w + 200 || m.y > h + 200) {
        meteors.splice(i, 1);
      }
    }

    raf = requestAnimationFrame(draw);
  };
  draw();

  onBeforeUnmount(() => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    window.removeEventListener('mousemove', onMove);
  });
});

/* ========== 卡片鼠标跟随光晕 ========== */
const cardRef = ref<HTMLDivElement | null>(null);
const glowX = ref(50);
const glowY = ref(50);
const onCardMove = (e: MouseEvent) => {
  const el = cardRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  glowX.value = ((e.clientX - rect.left) / rect.width) * 100;
  glowY.value = ((e.clientY - rect.top) / rect.height) * 100;
};
</script>

<template>
  <div class="login-page">
    <!-- 多层背景光晕 -->
    <div class="bg-glows">
      <div class="glow g1"></div>
      <div class="glow g2"></div>
      <div class="glow g3"></div>
      <div class="glow g4"></div>
    </div>

    <!-- 粒子星空 Canvas -->
    <canvas ref="canvasRef" class="star-canvas"></canvas>

    <!-- 噪点纹理 -->
    <div class="noise"></div>

    <!-- 中心内容 -->
    <div class="center-wrap">
      <!-- Logo + 系统名 -->
      <div class="brand-top">
        <div class="logo-wrap">
          <img src="/meixin.png" alt="美信" class="logo-img" />
        </div>
        <div class="brand-text">
          <h1 class="sys-name">静水楼台企业智能经营系统</h1>
          <div class="brand-line"></div>
          <p class="sys-en">JINGSHUI LOUTAI ENTERPRISE INTELLIGENT SYSTEM</p>
        </div>
      </div>

      <!-- 登录卡 -->
      <div ref="cardRef" class="login-card" :class="{ shake }" @mousemove="onCardMove">
        <div class="card-spotlight" :style="{ background: `radial-gradient(600px circle at ${glowX}% ${glowY}%, rgba(37,99,235,0.12), transparent 40%)` }"></div>
        <div class="card-border"></div>
        <div class="card-inner">
          <h2 class="card-title">欢迎登录</h2>

          <form @submit.prevent="submit">
            <div class="field">
              <label>账号</label>
              <div class="input-wrap">
                <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>
                <input v-model="username" class="input" placeholder="请输入账号" data-od-id="login-account" />
              </div>
            </div>

            <div class="field">
              <label>密码</label>
              <div class="input-wrap">
                <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
                <input v-model="password" :type="showPwd ? 'text' : 'password'" class="input" :class="{ error: !!err }" placeholder="请输入密码" data-od-id="login-password">
                <button type="button" class="eye" aria-label="显示密码" @click="showPwd = !showPwd">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
              </div>
              <div v-if="err" class="err-msg">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
                {{ err }}
              </div>
            </div>

            <label class="remember">
              <input v-model="remember" type="checkbox" />
              <span class="r-box">
                <svg v-if="remember" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>
              </span>
              <span class="r-text">记住我</span>
            </label>

            <button class="btn" type="submit" data-od-id="login-submit">
              <span class="btn-text">登 录</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            </button>
          </form>
        </div>
      </div>

      <div class="foot">© 2026 静水楼台企业智能经营系统 · 遇到问题请联系开发人员</div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  position: relative;
  overflow: hidden;
  font-family: var(--od-font-sans);
  color: var(--od-text);
  background: #060a14;
}

/* ========== 多层背景光晕 ========== */
.bg-glows { position: fixed; inset: 0; z-index: 0; pointer-events: none; }
.glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(100px);
  opacity: 0.5;
  animation: glowFloat 10s ease-in-out infinite alternate;
}
.g1 { width: 500px; height: 500px; top: -10%; left: -5%; background: radial-gradient(circle, rgba(37,99,235,0.35), transparent 70%); animation-duration: 12s; }
.g2 { width: 400px; height: 400px; top: 40%; right: -10%; background: radial-gradient(circle, rgba(99,102,241,0.25), transparent 70%); animation-duration: 14s; animation-delay: -3s; }
.g3 { width: 350px; height: 350px; bottom: -5%; left: 30%; background: radial-gradient(circle, rgba(14,165,233,0.22), transparent 70%); animation-duration: 11s; animation-delay: -5s; }
.g4 { width: 300px; height: 300px; top: 10%; left: 50%; background: radial-gradient(circle, rgba(139,92,246,0.18), transparent 70%); animation-duration: 16s; animation-delay: -7s; }
@keyframes glowFloat {
  0% { transform: translate(0, 0) scale(1); }
  100% { transform: translate(30px, -20px) scale(1.15); }
}

/* ========== Canvas 粒子星空 ========== */
.star-canvas {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

/* ========== 噪点纹理 ========== */
.noise {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  opacity: 0.035;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-repeat: repeat;
  background-size: 200px 200px;
}

/* ========== 中心内容区 ========== */
.center-wrap {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 40px 20px;
  width: 100%;
  max-width: 420px;
}

/* ========== Logo + 品牌 ========== */
.brand-top {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  text-align: center;
  animation: fadeInDown 0.7s ease-out both;
}
@keyframes fadeInDown {
  from { opacity: 0; transform: translateY(-16px); }
  to { opacity: 1; transform: translateY(0); }
}

.logo-wrap {
  position: relative;
  width: 88px;
  height: 88px;
  display: grid;
  place-items: center;
}
.logo-wrap::before {
  content: '';
  position: absolute;
  inset: -10px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(37,99,235,0.22), transparent 68%);
  animation: logoPulse 3s ease-in-out infinite;
}
.logo-wrap::after {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.06);
}
@keyframes logoPulse {
  0%, 100% { transform: scale(1); opacity: 0.5; }
  50% { transform: scale(1.12); opacity: 1; }
}
.logo-img {
  width: 72px;
  height: 72px;
  object-fit: contain;
  position: relative;
  z-index: 1;
  filter: drop-shadow(0 4px 16px rgba(0,0,0,0.4));
}

.brand-text { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.sys-name {
  font-size: 22px;
  font-weight: var(--od-weight-bold);
  color: #fff;
  letter-spacing: 0.06em;
  text-shadow: 0 2px 20px rgba(0,0,0,0.5);
  margin: 0;
}
.brand-line {
  width: 40px;
  height: 2px;
  border-radius: 1px;
  background: linear-gradient(90deg, transparent, rgba(37,99,235,0.7), transparent);
}
.sys-en {
  font-size: 10px;
  font-weight: var(--od-weight-medium);
  letter-spacing: 0.18em;
  color: rgba(255,255,255,0.3);
  text-transform: uppercase;
  margin: 0;
}

/* ========== 登录卡 ========== */
.login-card {
  position: relative;
  width: 100%;
  border-radius: var(--od-radius-xl);
  background: rgba(255,255,255,0.04);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow:
    0 32px 80px rgba(0,0,0,0.4),
    inset 0 1px 0 rgba(255,255,255,0.06);
  overflow: hidden;
  animation: fadeInUp 0.7s ease-out 0.1s both;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}
.login-card:hover {
  box-shadow:
    0 40px 100px rgba(0,0,0,0.5),
    inset 0 1px 0 rgba(255,255,255,0.08);
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 抖动(登录失败) */
.shake { animation: cardShake 0.5s ease both; }
@keyframes cardShake {
  0%, 100% { transform: translateX(0); }
  15% { transform: translateX(-10px); }
  30% { transform: translateX(8px); }
  45% { transform: translateX(-6px); }
  60% { transform: translateX(4px); }
  75% { transform: translateX(-2px); }
}

/* 鼠标跟随光晕 */
.card-spotlight {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  opacity: 0;
  transition: opacity 0.4s ease;
}
.login-card:hover .card-spotlight { opacity: 1; }

/* 边框微光 */
.card-border {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.03) 50%, rgba(255,255,255,0.06) 100%);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}

.card-inner {
  position: relative;
  z-index: 1;
  padding: 32px 28px;
}

.card-title {
  font-size: var(--od-text-xl);
  font-weight: var(--od-weight-semibold);
  color: #fff;
  text-align: center;
  margin: 0 0 24px;
}

/* ========== 表单 ========== */
.field { margin-bottom: 16px; }
.field label {
  display: block;
  font-size: var(--od-text-sm);
  font-weight: var(--od-weight-medium);
  color: rgba(255,255,255,0.65);
  margin-bottom: 6px;
}

.input-wrap { position: relative; }
.input {
  width: 100%;
  height: 46px;
  padding: 0 40px 0 42px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: var(--od-radius-md);
  font-size: var(--od-text-base);
  color: #fff;
  font-family: inherit;
  transition: all 0.2s ease;
  outline: none;
}
.input::placeholder { color: rgba(255,255,255,0.3); }
.input:hover {
  background: rgba(255,255,255,0.08);
  border-color: rgba(255,255,255,0.18);
}
.input:focus {
  background: rgba(255,255,255,0.08);
  border-color: var(--od-primary);
  box-shadow: 0 0 0 3px rgba(37,99,235,0.2), 0 0 24px rgba(37,99,235,0.1);
}
.input.error {
  border-color: var(--od-danger);
  box-shadow: 0 0 0 3px rgba(239,68,68,0.15);
  animation: inputShake 0.4s ease;
}
@keyframes inputShake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}

.input-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: rgba(255,255,255,0.4);
  pointer-events: none;
}

.eye {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 30px;
  height: 30px;
  border-radius: var(--od-radius-sm);
  display: grid;
  place-items: center;
  color: rgba(255,255,255,0.4);
  background: none;
  border: none;
  cursor: pointer;
  transition: all 0.15s;
}
.eye:hover {
  background: rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.75);
}

.err-msg {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--od-text-xs);
  color: #fca5a5;
  margin-top: 6px;
}

/* 记住我 */
.remember {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  margin-bottom: 16px;
  user-select: none;
}
.remember input { position: absolute; opacity: 0; width: 0; height: 0; }
.r-box {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 1.5px solid rgba(255,255,255,0.25);
  background: rgba(255,255,255,0.05);
  display: grid;
  place-items: center;
  transition: all 0.15s;
  flex-shrink: 0;
}
.remember:hover .r-box { border-color: rgba(255,255,255,0.4); }
.remember input:focus + .r-box { box-shadow: 0 0 0 2px rgba(37,99,235,0.3); }
.remember input:checked + .r-box {
  background: var(--od-primary);
  border-color: var(--od-primary);
}
.r-text {
  font-size: var(--od-text-sm);
  color: rgba(255,255,255,0.55);
}

/* ========== 登录按钮 ========== */
.btn {
  width: 100%;
  height: 46px;
  border-radius: var(--od-radius-md);
  border: none;
  font-size: var(--od-text-base);
  font-weight: var(--od-weight-semibold);
  color: #fff;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: linear-gradient(135deg, var(--od-primary), color-mix(in oklab, var(--od-primary), var(--od-palette-1) 35%));
  box-shadow: 0 4px 18px rgba(37,99,235,0.3), inset 0 1px 0 rgba(255,255,255,0.15);
  transition: all 0.25s ease;
}
.btn::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
  transform: translateX(-100%);
}
.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 28px rgba(37,99,235,0.4), inset 0 1px 0 rgba(255,255,255,0.2);
}
.btn:hover::before { animation: btnShine 0.7s ease forwards; }
@keyframes btnShine {
  to { transform: translateX(100%); }
}
.btn:active { transform: translateY(0); }

/* ========== 底部 ========== */
.foot {
  font-size: var(--od-text-xs);
  color: rgba(255,255,255,0.25);
  text-align: center;
  animation: fadeInUp 0.7s ease-out 0.35s both;
}

/* ========== 响应式 ========== */
@media (max-width: 480px) {
  .center-wrap { padding: 28px 16px; gap: 20px; }
  .logo-img { width: 60px; height: 60px; }
  .sys-name { font-size: 18px; }
  .card-inner { padding: 24px 20px; }
  .hint-accounts { flex-direction: column; }
}
</style>