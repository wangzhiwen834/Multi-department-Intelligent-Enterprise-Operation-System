# 静水楼台企业智能经营系统 · 设计系统令牌规范

> 一句话系统说明:商务浅色精修的财务经营后台 —— 纯白卡片 + 柔和阴影 + 细冷边框,以 sky/blue(`#2563eb`)为唯一主色,5 店各持一色用于数据区分,数字一律等宽,留白透气、信息密而不乱。

本规范是后续所有屏 HTML 的唯一视觉契约。每个屏在 `<style>` 内联下面 §1 的 `:root` 令牌块,样式全部引用 `--od-*` 变量,不硬编码颜色。

---

## 1. CSS `:root` 令牌块(逐屏内联)

```css
:root{
  /* ── 颜色 · 表面与文本 ───────────────────────────── */
  --od-bg:#f7f9fc;            /* 应用底色,极浅冷灰,让白卡浮起 */
  --od-surface:#ffffff;       /* 卡片/面板表面 */
  --od-surface-2:#f1f5f9;     /* 次级表面:表头、悬停底、分割块 */
  --od-border:#e2e8f0;        /* 细冷边框(slate-200) */
  --od-text:#0f172a;          /* 主文本(slate-900) */
  --od-text-muted:#64748b;    /* 次要文本/标签(slate-500) */

  /* ── 颜色 · 主色与品牌 ───────────────────────────── */
  --od-primary:#2563eb;       /* sky/blue 主线:主按钮、激活态、链接、焦点环 */
  --od-primary-hover:#1d4ed8; /* 主色悬停(更深,保证白字对比) */
  --od-gold:#d4a017;          /* 金额高亮 / VIP / 充值强调 */

  /* ── 颜色 · 语义 ─────────────────────────────────── */
  --od-success:#16a34a;       /* 达成 / 启用 / 正向 */
  --od-warning:#f59e0b;       /* 预警 / 接近临界 */
  --od-danger:#ef4444;        /* 落后 / 禁用 / 负向 */

  /* ── 颜色 · 5 店配色(数据区分,互不撞色) ───────── */
  --od-palette-1:#0ea5e9;     /* 大河坎店 · sky */
  --od-palette-2:#3b82f6;     /* 旗舰店   · blue */
  --od-palette-3:#14b8a6;     /* 中心店   · teal */
  --od-palette-4:#8b5cf6;     /* 北区店   · violet */
  --od-palette-5:#f59e0b;     /* 南区店   · amber */

  /* ── 颜色 · 语义软底(徽章/状态条背景) ───────────── */
  --od-primary-soft:#dbeafe;
  --od-success-soft:#dcfce7;
  --od-warning-soft:#fef3c7;
  --od-danger-soft:#fee2e2;
  --od-gold-soft:#fef3c7;

  /* ── 字体 ────────────────────────────────────────── */
  --od-font-sans:"Inter","PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,-apple-system,sans-serif;
  --od-font-mono:"JetBrains Mono","SF Mono","Cascadia Code",Consolas,ui-monospace,monospace;

  /* ── 字号 ────────────────────────────────────────── */
  --od-text-xs:12px;          /* 辅助/脚注 */
  --od-text-sm:13px;          /* 表格次要列/标签 */
  --od-text-base:14px;        /* 正文/表单/按钮基线 */
  --od-text-lg:16px;          /* 小标题/强调正文 */
  --od-text-xl:18px;          /* 卡片标题 */
  --od-text-2xl:24px;         /* 区块标题 */

  /* ── 字重 ────────────────────────────────────────── */
  --od-weight-normal:400;
  --od-weight-medium:500;
  --od-weight-semibold:600;
  --od-weight-bold:700;

  /* ── 间距(4px 递增刻度) ────────────────────────── */
  --od-space-1:4px;
  --od-space-2:8px;
  --od-space-3:12px;
  --od-space-4:16px;
  --od-space-5:20px;
  --od-space-6:24px;
  --od-space-7:32px;
  --od-space-8:40px;

  /* ── 圆角 ────────────────────────────────────────── */
  --od-radius-sm:6px;         /* 标签/小按钮 */
  --od-radius-md:8px;         /* 输入框/按钮 */
  --od-radius-lg:12px;        /* 卡片 */
  --od-radius-xl:16px;        /* 大容器/弹窗 */
  --od-radius-full:9999px;    /* 徽章/头像 */

  /* ── 阴影(柔和、克制) ─────────────────────────── */
  --od-shadow-sm:0 1px 2px rgba(15,23,42,.04),0 1px 3px rgba(15,23,42,.06);
  --od-shadow-md:0 4px 12px rgba(15,23,42,.06),0 2px 4px rgba(15,23,42,.04);
  --od-shadow-lg:0 12px 32px rgba(15,23,42,.10),0 4px 12px rgba(15,23,42,.06);

  /* ── 布局辅助(非必选,跨屏一致用) ──────────────── */
  --od-sidebar-w:232px;
  --od-sidebar-w-collapsed:64px;
  --od-topbar-h:56px;
}
```

---

## 2. 令牌说明表

### 颜色 · 表面与文本

| 令牌 | 值 | 用途 |
|---|---|---|
| `--od-bg` | `#f7f9fc` | 应用底色,极浅冷灰,衬托白卡 |
| `--od-surface` | `#ffffff` | 卡片、面板、弹窗表面 |
| `--od-surface-2` | `#f1f5f9` | 表头、行悬停、分割块、折叠态底 |
| `--od-border` | `#e2e8f0` | 卡片/表格/输入框细边框 |
| `--od-text` | `#0f172a` | 标题、数值、主文本 |
| `--od-text-muted` | `#64748b` | 标签、说明、次要文本 |

### 颜色 · 主色与品牌

| 令牌 | 值 | 用途 |
|---|---|---|
| `--od-primary` | `#2563eb` | 主按钮、激活态、链接、焦点环、图表主线 |
| `--od-primary-hover` | `#1d4ed8` | 主按钮悬停(更深,白字对比 ≥4.5) |
| `--od-gold` | `#d4a017` | 金额高亮、VIP、充值强调(每屏最多一处) |

### 颜色 · 语义

| 令牌 | 值 | 用途 |
|---|---|---|
| `--od-success` | `#16a34a` | 达成、启用、正向趋势 |
| `--od-warning` | `#f59e0b` | 预警、接近临界 |
| `--od-danger` | `#ef4444` | 落后、禁用、负向趋势 |

### 颜色 · 5 店配色

| 令牌 | 值 | 门店 |
|---|---|---|
| `--od-palette-1` | `#0ea5e9` | 大河坎店 |
| `--od-palette-2` | `#3b82f6` | 旗舰店 |
| `--od-palette-3` | `#14b8a6` | 中心店 |
| `--od-palette-4` | `#8b5cf6` | 北区店 |
| `--od-palette-5` | `#f59e0b` | 南区店 |

### 颜色 · 语义软底

| 令牌 | 值 | 用途 |
|---|---|---|
| `--od-primary-soft` | `#dbeafe` | 主色徽章/选中行底 |
| `--od-success-soft` | `#dcfce7` | 达成徽章底 |
| `--od-warning-soft` | `#fef3c7` | 预警徽章底 |
| `--od-danger-soft` | `#fee2e2` | 落后/禁用徽章底 |
| `--od-gold-soft` | `#fef3c7` | 金额高亮底 |

### 字体 / 字号 / 字重

| 令牌 | 值 | 用途 |
|---|---|---|
| `--od-font-sans` | Inter, PingFang SC … | 正文与 UI |
| `--od-font-mono` | JetBrains Mono, SF Mono … | 财务数字、金额、代码 |
| `--od-text-xs` | `12px` | 辅助、脚注 |
| `--od-text-sm` | `13px` | 表格次要列、标签 |
| `--od-text-base` | `14px` | 正文、表单、按钮基线 |
| `--od-text-lg` | `16px` | 小标题、强调正文 |
| `--od-text-xl` | `18px` | 卡片标题 |
| `--od-text-2xl` | `24px` | 区块标题 |
| `--od-weight-normal` | `400` | 正文 |
| `--od-weight-medium` | `500` | 按钮、强调 |
| `--od-weight-semibold` | `600` | 标题、主按钮 |
| `--od-weight-bold` | `700` | 大数值 |

### 间距 / 圆角 / 阴影

| 令牌 | 值 | 用途 |
|---|---|---|
| `--od-space-1..8` | `4/8/12/16/20/24/32/40px` | 全局间距刻度 |
| `--od-radius-sm` | `6px` | 标签、小按钮 |
| `--od-radius-md` | `8px` | 输入框、按钮 |
| `--od-radius-lg` | `12px` | 卡片 |
| `--od-radius-xl` | `16px` | 大容器、弹窗 |
| `--od-radius-full` | `9999px` | 徽章、头像、圆点 |
| `--od-shadow-sm` | 浅投影 | 卡片默认 |
| `--od-shadow-md` | 中投影 | 悬停/浮层 |
| `--od-shadow-lg` | 深投影 | 弹窗/抽屉 |

---

## 3. 配色逻辑

### 主色
唯一主色为 sky/blue 家族的 `--od-primary #2563eb`。它是全系统唯一的"动作色":主按钮、激活的侧边栏项、选中表签、链接、焦点环、图表主线全部走它。配套 `--od-primary-hover #1d4ed8` 在悬停时加深,保证白字在按钮上对比达标。主色**不作为大面积底色**,只用于焦点动作与关键数据线,因此一旦出现就携带指令权重。`--od-primary-soft #dbeafe` 用于选中行、徽章等需要弱主色底的场景。

### 语义色(状态,非装饰)
- **成功 `--od-success #16a34a`** —— 任务达成、用户启用、正向同比。配 `--od-success-soft` 做徽章。
- **预警 `--od-warning #f59e0b`** —— 接近临界(如任务进度略低于时间进度但未明显落后)。配 `--od-warning-soft`。
- **危险 `--od-danger #ef4444`** —— 任务明显落后、用户禁用、负向同比。配 `--od-danger-soft`。任务仪表盘中"落后店"用此色标记。

语义色只表达状态,绝不用作装饰性着色;每屏语义色用量受状态数量自然约束,不额外铺色。

### 5 店色(数据区分)
5 店配色用于"5 店排名、营收分摊、海报店标"等需要横向区分门店的场景,以**冷色为主、两抹暖色点睛**,保证在白底上彼此可辨且与主色和谐:
- **大河坎店 `--od-palette-1 #0ea5e9`(sky)** —— 示例中的"落后店",sky 蓝与主色同族,使其落后标记更内敛、不喧宾夺主。
- **旗舰店 `--od-palette-2 #3b82f6`(blue)** —— 头部门店,与主色同谱,呼应品牌。
- **中心店 `--od-palette-3 #14b8a6`(teal)** —— 中段,青绿拉开层次。
- **北区店 `--od-palette-4 #8b5cf6`(violet)** —— 冷紫,丰富色谱但不抢主色。
- **南区店 `--od-palette-5 #f59e0b`(amber)** —— 暖琥珀,与预警色同源,仅作数据区分(非状态)。

> 门店色与语义色职责分离:门店色回答"是哪家店",语义色回答"是什么状态"。大河坎店用 sky 蓝表达身份,用 `--od-danger` 表达"落后",二者叠加不冲突。

### 使用约定
- **数字一律 `--od-font-mono` + `tabular-nums`**,金额前缀 `¥`,万级用"万"单位,保证财务列对齐。
- **阴影克制**:卡片默认 `--od-shadow-sm`,悬停 `--od-shadow-md`,弹窗 `--od-shadow-lg`;不靠重阴影制造层级,而靠边框 + 底色对比。
- **主色预算**:每屏主色作为动作/焦点出现,语义色按状态出现,gold 每屏最多一处高亮;装饰性渐变仅在登录页品牌区使用一次。
