<script setup lang="ts">
import { ref } from 'vue';
import { api } from '../api';
import type { User } from '../types';

const emit = defineEmits<{ (e: 'login', u: User, t: string): void }>();
const username = ref('');
const password = ref('');
const err = ref('');
const showPwd = ref(false);

const submit = async () => {
  try {
    const r = await api.login(username.value, password.value);
    emit('login', r.user, r.token);
  } catch (e: any) {
    err.value = e.message;
  }
};
</script>

<template>
  <div class="wrap" data-od-id="login-wrap">
    <!-- 左:品牌视觉 -->
    <section class="brand" data-od-id="login-brand">
      <div class="brand-top">
        <span class="od-mark lg" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none"><path d="M12 3C12 3 5.5 10.5 5.5 15.2a6.5 6.5 0 0 0 13 0C18.5 10.5 12 3 12 3Z" fill="#ffffff"/></svg>
        </span>
        <div class="logo-text">静水楼台企业智能经营系统</div>
      </div>
      <div class="brand-mid">
        <div class="eyebrow">Multi-Dept Operation Platform</div>
        <h1>多部门智能经营平台<br>让经营数据自己说话</h1>
        <p>从门店营收、客流、充值到 AI 经营简报与每日海报,一套系统穿透多部门经营全貌。</p>
        <div class="chips">
          <span class="chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg>多部门协同</span>
          <span class="chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/></svg>AI 智能分析</span>
          <span class="chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17l6-6 4 4 7-7"/><path d="M21 8v5h-5"/></svg>财务穿透对账</span>
        </div>
        <div class="preview" data-od-id="login-preview">
          <div class="pv-head">
            <span class="pv-title"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>本月经营概览</span>
            <span class="pv-tag">2025-06</span>
          </div>
          <div><span class="pv-num">¥380.2万</span><span class="pv-trend">↑12.4%</span></div>
          <div class="pv-chart">
            <svg viewBox="0 0 200 36" preserveAspectRatio="none">
              <path d="M0,30 L20,26 L40,28 L60,20 L80,22 L100,14 L120,18 L140,10 L160,12 L180,6 L200,8 L200,36 L0,36 Z" fill="rgba(255,255,255,.22)"/>
              <polyline points="0,30 20,26 40,28 60,20 80,22 100,14 120,18 140,10 160,12 180,6 200,8" fill="none" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="pv-stats">
            <div class="pv-stat"><div class="v">24,560</div><div class="l">本月客流</div></div>
            <div class="pv-stat"><div class="v">¥154.7</div><div class="l">客单价</div></div>
            <div class="pv-stat"><div class="v">5/5</div><div class="l">门店在线</div></div>
          </div>
        </div>
      </div>
      <div class="brand-foot">
        <span>© 2026 静水楼台企业智能经营系统</span>
      </div>
    </section>

    <!-- 右:登录表单 -->
    <section class="form-side" data-od-id="login-form">
      <div class="card">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:var(--od-space-6)">
          <span class="od-mark md" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 3C12 3 5.5 10.5 5.5 15.2a6.5 6.5 0 0 0 13 0C18.5 10.5 12 3 12 3Z" fill="#ffffff"/></svg>
          </span>
          <div>
            <h2 style="font-size:var(--od-text-xl);font-weight:var(--od-weight-semibold)">静水楼台企业智能经营系统</h2>
            <p style="font-size:var(--od-text-sm);color:var(--od-text-muted)">多部门智能经营平台</p>
          </div>
        </div>

        <form @submit.prevent="submit">
          <div class="field">
            <label>账号</label>
            <div class="input-wrap">
              <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>
              <input v-model="username" class="input with-icon" placeholder="请输入手机号 / 账号" data-od-id="login-account">
            </div>
          </div>

          <div class="field">
            <label>密码</label>
            <div class="input-wrap">
              <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
              <input v-model="password" :type="showPwd ? 'text' : 'password'" class="input pwd" :class="{ error: !!err }" placeholder="请输入密码" data-od-id="login-password">
              <button type="button" class="eye" aria-label="显示密码" @click="showPwd = !showPwd">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
            </div>
            <div v-if="err" class="err-msg">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
              {{ err }}
            </div>
          </div>

          <button class="btn btn-primary" data-od-id="login-submit">
            登录
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </button>
        </form>

        <!-- 默认账号提示 -->
        <div class="hint" data-od-id="login-default-accounts">
          <div class="hint-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
            演示账号(可直接登录)
          </div>
          <div class="hint-accounts">
            <span class="acct">董事长 <b>boss</b> / <b>boss123</b></span>
            <span class="acct">经理 <b>mgr</b> / <b>mgr123</b></span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%}
body{font-family:var(--od-font-sans);background:var(--od-bg);color:var(--od-text);font-size:var(--od-text-base);line-height:1.5;-webkit-font-smoothing:antialiased}
.num{font-family:var(--od-font-mono);font-variant-numeric:tabular-nums}
button{font-family:inherit;cursor:pointer;border:none;background:none}
a{color:inherit;text-decoration:none}

.wrap{min-height:100vh;display:grid;grid-template-columns:1.05fr 1fr}

/* ── 品牌标(水滴 SVG,非卡通) ────────────────── */
.od-mark{display:inline-grid;place-items:center;border-radius:var(--od-radius-md);background:linear-gradient(135deg,var(--od-palette-1),var(--od-primary-hover));color:#fff;flex-shrink:0;line-height:0}
.od-mark svg{display:block}
.od-mark.lg{width:56px;height:56px;border-radius:var(--od-radius-lg);box-shadow:0 0 0 2px rgba(255,255,255,.22)}
.od-mark.lg svg{width:32px;height:32px}
.od-mark.md{width:40px;height:40px}
.od-mark.md svg{width:22px;height:22px}

/* ── 左:品牌视觉 ──────────────────────────────── */
.brand{position:relative;overflow:hidden;background:linear-gradient(140deg,var(--od-palette-1) 0%,var(--od-primary) 55%,var(--od-primary-hover) 100%);color:#fff;padding:48px 56px 40px;display:flex;flex-direction:column;justify-content:space-between}
.brand::before{content:"";position:absolute;width:520px;height:520px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.16),transparent 65%);top:-160px;right:-120px}
.brand::after{content:"";position:absolute;width:360px;height:360px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.10),transparent 70%);bottom:-140px;left:-80px}
.brand-top{position:relative;z-index:1;display:flex;align-items:center;gap:12px}
.logo-text{font-size:var(--od-text-lg);font-weight:var(--od-weight-semibold);letter-spacing:.02em}
.brand-mid{position:relative;z-index:1;max-width:440px}
.eyebrow{font-size:var(--od-text-sm);letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.78);margin-bottom:var(--od-space-4)}
.brand-mid h1{font-size:36px;line-height:1.22;font-weight:var(--od-weight-bold);letter-spacing:-.01em;margin-bottom:var(--od-space-4)}
.brand-mid p{font-size:var(--od-text-lg);color:rgba(255,255,255,.86);line-height:1.6}
.chips{display:flex;gap:10px;margin-top:var(--od-space-6);flex-wrap:wrap}
.chip{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:var(--od-radius-full);background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.22);font-size:var(--od-text-sm);backdrop-filter:blur(4px)}
.chip svg{width:14px;height:14px;opacity:.9}

/* 产品预览卡(玻璃,非卡通) */
.preview{position:relative;z-index:1;background:rgba(255,255,255,.14);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.22);border-radius:var(--od-radius-lg);padding:18px 20px;margin-top:var(--od-space-7);max-width:420px;box-shadow:var(--od-shadow-lg)}
.pv-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--od-space-3)}
.pv-title{font-size:var(--od-text-sm);color:rgba(255,255,255,.85);display:flex;align-items:center;gap:6px}
.pv-tag{font-size:var(--od-text-xs);background:rgba(255,255,255,.18);padding:2px 8px;border-radius:var(--od-radius-full)}
.pv-num{font-size:30px;font-weight:var(--od-weight-bold);font-family:var(--od-font-mono);letter-spacing:-.01em}
.pv-trend{display:inline-flex;align-items:center;gap:3px;font-size:var(--od-text-xs);font-weight:var(--od-weight-semibold);background:rgba(255,255,255,.18);padding:2px 8px;border-radius:var(--od-radius-full);margin-left:8px;vertical-align:middle}
.pv-chart{height:36px;margin:10px 0 12px}
.pv-chart svg{width:100%;height:100%}
.pv-stats{display:flex;gap:var(--od-space-6);padding-top:10px;border-top:1px solid rgba(255,255,255,.18)}
.pv-stat .v{font-size:var(--od-text-lg);font-weight:var(--od-weight-bold);font-family:var(--od-font-mono)}
.pv-stat .l{font-size:var(--od-text-xs);color:rgba(255,255,255,.78)}

.brand-foot{position:relative;z-index:1;font-size:var(--od-text-xs);color:rgba(255,255,255,.66);display:flex;justify-content:space-between}

/* ── 右:登录表单 ──────────────────────────────── */
.form-side{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 32px;background:var(--od-surface)}
.card{width:100%;max-width:380px}

.field{margin-bottom:var(--od-space-4)}
.field label{display:block;font-size:var(--od-text-sm);font-weight:var(--od-weight-medium);margin-bottom:6px;color:var(--od-text)}
.input-wrap{position:relative}
.input{width:100%;height:44px;padding:0 14px;background:var(--od-surface);border:1px solid var(--od-border);border-radius:var(--od-radius-md);font-size:var(--od-text-base);color:var(--od-text);font-family:inherit;transition:all .15s ease}
.input::placeholder{color:color-mix(in oklab,var(--od-text-muted),white 18%)}
.input:hover{border-color:color-mix(in oklab,var(--od-border),black 8%)}
.input:focus{outline:none;border-color:var(--od-primary);box-shadow:0 0 0 3px var(--od-primary-soft)}
.input.error{border-color:var(--od-danger);box-shadow:0 0 0 3px var(--od-danger-soft)}
.input.pwd{padding-right:44px}
.input.with-icon{padding-left:42px}
.input-icon{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--od-text-muted);pointer-events:none}
.eye{position:absolute;right:8px;top:50%;transform:translateY(-50%);width:30px;height:30px;border-radius:var(--od-radius-sm);display:grid;place-items:center;color:var(--od-text-muted)}
.eye:hover{background:var(--od-surface-2);color:var(--od-text)}
.err-msg{display:flex;align-items:center;gap:6px;font-size:var(--od-text-xs);color:color-mix(in oklab,var(--od-danger),black 20%);margin-top:6px}

.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:44px;width:100%;border-radius:var(--od-radius-md);font-size:var(--od-text-base);font-weight:var(--od-weight-semibold);transition:all .15s ease}
.btn-primary{background:var(--od-primary);color:#fff;box-shadow:var(--od-shadow-sm)}
.btn-primary:hover{background:var(--od-primary-hover);box-shadow:var(--od-shadow-md);transform:translateY(-1px)}

/* 默认账号提示 */
.hint{margin-top:var(--od-space-5);background:var(--od-surface-2);border:1px dashed var(--od-border);border-radius:var(--od-radius-md);padding:11px 13px;font-size:var(--od-text-sm)}
.hint-title{font-weight:var(--od-weight-medium);color:var(--od-text);margin-bottom:6px;display:flex;align-items:center;gap:6px}
.hint-title svg{color:var(--od-text-muted)}
.hint-accounts{display:flex;gap:8px;flex-wrap:wrap}
.acct{font-family:var(--od-font-mono);font-size:var(--od-text-xs);background:var(--od-surface);border:1px solid var(--od-border);border-radius:var(--od-radius-sm);padding:4px 8px;color:var(--od-text)}
.acct b{color:var(--od-primary);font-weight:var(--od-weight-semibold)}

@media(max-width:960px){
  .wrap{grid-template-columns:1fr}
  .brand{padding:32px 32px 28px;min-height:auto}
  .brand-mid h1{font-size:28px}
  .preview{display:none}
  .form-side{padding:28px 20px}
}
</style>
