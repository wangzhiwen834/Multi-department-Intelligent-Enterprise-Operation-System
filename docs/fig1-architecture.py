# fig1 - 系统总体架构图 (SCI 风格 / 中文)
# 用分层背景色带明确每层范围, 左侧色条 + 层名
import os
import matplotlib as mpl
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Rectangle

mpl.rcParams.update({
    "font.family": "sans-serif",
    "font.sans-serif": ["Microsoft YaHei", "SimHei", "Arial", "DejaVu Sans"],
    "axes.unicode_minus": False,
    "svg.fonttype": "none",
    "pdf.fonttype": 42,
    "font.size": 11,
})

HERE = os.path.dirname(os.path.abspath(__file__))

fig, ax = plt.subplots(figsize=(11.0, 8.0))
ax.set_xlim(0, 11.0)
ax.set_ylim(0, 8.0)
ax.axis('off')

# ========== 配色 ==========
COL = {
    "frame":     "#90a4ae",
    "text":      "#263238",
    "sub":       "#607d8b",
    "note":      "#90a4ae",
    "arrow":     "#455a64",
    "dash":      "#78909c",
    # 录入层 - 蓝灰
    "L_entry":   "#546e7a",
    "B_entry":   "#eceff1",     # 模块填充
    "BG_entry":  "#f5f7fa",     # 层背景 (更淡)
    # 数据层 - 深绿
    "L_data":    "#2e7d32",
    "B_data":    "#e8f5e9",
    "BG_data":   "#f3faf3",
    # 视图层 - 深红
    "L_view":    "#c62828",
    "B_view":    "#ffebee",
    "BG_view":   "#fff5f5",
    # 特殊
    "B_lock":    "#fff8e1",     # 悲观锁 - 黄
    "B_tmpl":    "#e3f2fd",     # 模板描述符 - 青
    "B_pg":      "#f3e5f5",     # PostgreSQL - 紫
}


def box(x, y, w, h, line1, line2=None, fc=None, ec=None, fs=9, tc=None, lw=0.9, ls="-"):
    if fc is None: fc = "white"
    if ec is None: ec = COL["frame"]
    if tc is None: tc = COL["text"]
    p = FancyBboxPatch((x, y), w, h,
                       boxstyle="round,pad=0.02,rounding_size=0.06",
                       facecolor=fc, edgecolor=ec, linewidth=lw, linestyle=ls)
    ax.add_patch(p)
    if line2 is None:
        ax.text(x + w / 2, y + h / 2, line1, ha='center', va='center',
                fontsize=fs, color=tc, fontweight='bold')
    else:
        ax.text(x + w / 2, y + h / 2 + 0.12, line1, ha='center', va='center',
                fontsize=fs, color=tc, fontweight='bold')
        ax.text(x + w / 2, y + h / 2 - 0.14, line2, ha='center', va='center',
                fontsize=fs - 1, color=COL["sub"])
    return p


def label(x, y, text, fs=8.5, color=None, ha='center', va='center', style='normal'):
    if color is None: color = COL["text"]
    ax.text(x, y, text, ha=ha, va=va, fontsize=fs, color=color, style=style)


def arrow(x0, y0, x1, y1, color=None, lw=1.1, style="->", ls="-"):
    if color is None: color = COL["arrow"]
    ax.annotate('', xy=(x1, y1), xytext=(x0, y0),
                arrowprops=dict(arrowstyle=style, color=color, lw=lw, linestyle=ls,
                                shrinkA=2, shrinkB=2))


def layer_background(x0, y0, w, h, cn, en, bar_c, bg_c, top_line=True, bottom_line=True):
    """
    绘制整层背景色带 (矩形, 无缝拼接) + 左侧色条 + 层名.
    top_line / bottom_line 控制是否画上下分隔线, 避免相邻层之间出现双线.
    """
    bg = Rectangle((x0, y0), w, h, facecolor=bg_c, edgecolor="none", alpha=0.85)
    ax.add_patch(bg)
    if top_line:
        ax.plot([x0, x0 + w], [y0 + h, y0 + h], color=bar_c, lw=1.0, alpha=0.5)
    if bottom_line:
        ax.plot([x0, x0 + w], [y0, y0], color=bar_c, lw=1.0, alpha=0.5)
    # 左侧色条
    bar = FancyBboxPatch((x0 + 0.08, y0 + 0.12), 0.12, h - 0.24,
                         boxstyle="round,pad=0.0,rounding_size=0.04",
                         facecolor=bar_c, edgecolor="none", alpha=0.9)
    ax.add_patch(bar)
    # 层名
    ax.text(x0 + 0.35, y0 + h / 2 + 0.25, cn, ha='left', va='center',
            fontsize=13, color=bar_c, fontweight='bold')
    ax.text(x0 + 0.35, y0 + h / 2 - 0.25, en, ha='left', va='center',
            fontsize=10.5, color=bar_c, style='italic')


# ========== 层背景 (从最底层开始画, 无缝拼接, 共用边界线) ==========
# 视图层 (y 0.1 - 1.55) - 顶部线由数据层提供
layer_background(0.0, 0.10, 11.0, 1.45, "视图层", "View Layer",
                 COL["L_view"], COL["BG_view"], top_line=False, bottom_line=True)
# 数据层 (y 1.55 - 5.30) - 上下都画线
layer_background(0.0, 1.55, 11.0, 3.75, "数据层", "Data Layer",
                 COL["L_data"], COL["BG_data"], top_line=True, bottom_line=False)
# 录入层 (y 5.30 - 7.20) - 底部线由数据层提供
layer_background(0.0, 5.30, 11.0, 1.90, "录入层", "Entry Layer",
                 COL["L_entry"], COL["BG_entry"], top_line=True, bottom_line=False)


# ========== 录入层内容 (y 5.30 - 7.20, 中心 6.25) ==========
box(1.45, 5.75, 1.8, 0.95, "员工", "(店长 / 财务)",
    fc=COL["B_entry"], ec=COL["L_entry"], fs=10)
box(3.65, 5.55, 3.0, 1.25, "Univer 在线表格", "(录入面, 仅写)",
    fc=COL["B_entry"], ec=COL["L_entry"], fs=11)
box(7.05, 5.75, 2.0, 0.95, "工作表级悲观锁", "(并发控制)",
    fc=COL["B_lock"], ec="#f9a825", fs=10)

arrow(3.25, 6.23, 3.65, 6.23)
label(3.45, 6.48, "录入", fs=8.5)
arrow(6.65, 6.23, 7.05, 6.23)
label(6.85, 6.48, "守护", fs=8.5)

# 录入层 -> 抽取管线
arrow(5.15, 5.55, 5.15, 5.15)
label(5.28, 5.35, "保存 / 定时触发", ha='left', fs=8.5)


# ========== 数据层内容 ==========
# --- AI 语义抽取管线 (主框 + 内部子组件) ---
pipe_x, pipe_y, pipe_w, pipe_h = 2.90, 3.85, 5.5, 1.30
pipe = FancyBboxPatch((pipe_x, pipe_y), pipe_w, pipe_h,
                      boxstyle="round,pad=0.02,rounding_size=0.06",
                      facecolor=COL["B_data"], edgecolor=COL["L_data"], linewidth=1.1)
ax.add_patch(pipe)
ax.text(pipe_x + pipe_w / 2, pipe_y + pipe_h - 0.32, "AI 语义抽取管线",
        ha='center', va='center', fontsize=12, color=COL["L_data"], fontweight='bold')
ax.text(pipe_x + pipe_w / 2, pipe_y + pipe_h - 0.62, "(唯一入库路径)",
        ha='center', va='center', fontsize=9, color=COL["L_data"], style='italic')

# 4 个子组件
sub_w, sub_h = 1.10, 0.40
sub_y = pipe_y + 0.12
sub_items = [
    ("工作表解析", 3.10),
    ("字段归一化", 4.30),
    ("数据校验",  5.50),
    ("写入器",    6.70),
]
for name, sx in sub_items:
    box(sx, sub_y, sub_w, sub_h, name, fs=8.5, fc="white", ec=COL["L_data"], lw=0.7)
for i in range(len(sub_items) - 1):
    x0 = sub_items[i][1] + sub_w
    x1 = sub_items[i + 1][1]
    arrow(x0, sub_y + sub_h / 2, x1, sub_y + sub_h / 2, color=COL["L_data"], lw=0.7)

# 模板描述符
box(8.80, 4.00, 1.85, 0.90, "模板描述符", "definition (JSONB)",
    fc=COL["B_tmpl"], ec="#1e88e5", fs=9, ls="--")
arrow(8.80, 4.45, 8.40, 4.45, color="#1e88e5", lw=0.9, ls="--")
label(8.60, 4.68, "驱动", color="#1e88e5", fs=8.5)

# --- PostgreSQL 唯一事实源 ---
pg_x, pg_y, pg_w, pg_h = 1.95, 1.80, 7.40, 1.70
pg = FancyBboxPatch((pg_x, pg_y), pg_w, pg_h,
                    boxstyle="round,pad=0.02,rounding_size=0.06",
                    facecolor=COL["B_pg"], edgecolor="#8e24aa", linewidth=1.1)
ax.add_patch(pg)
ax.text(pg_x + pg_w / 2, pg_y + pg_h - 0.22, "PostgreSQL  (唯一事实源)",
        ha='center', va='center', fontsize=12, color="#8e24aa", fontweight='bold')
ax.text(pg_x + pg_w / 2, pg_y + pg_h - 0.55, "干净业务表 / 快照",
        ha='center', va='center', fontsize=9, color="#8e24aa", style='italic')

box(2.25, 1.98, 2.10, 0.52, "daily_metric", fs=8.5, fc="white", ec="#8e24aa", lw=0.8)
box(4.50, 1.98, 1.55, 0.52, "expense", fs=8.5, fc="white", ec="#8e24aa", lw=0.8)
box(6.35, 1.98, 2.60, 0.52, "workbook_snapshot", fs=8.5, fc="white", ec="#8e24aa", lw=0.8)

# 抽取管线 -> PostgreSQL
arrow(5.65, 3.85, 5.65, 3.50)
label(5.78, 3.68, "写入更新", ha='left', fs=8.5)


# ========== 视图层内容 (y 0.10 - 1.55) ==========
box(1.20, 0.30, 2.7, 1.0, "数据大屏", "(ECharts, 粒度聚合)",
    fc=COL["B_view"], ec=COL["L_view"], fs=10)
box(4.15, 0.30, 2.9, 1.0, "AI 经营分析", "(函数调用式智能体)",
    fc=COL["B_view"], ec=COL["L_view"], fs=10)
box(7.45, 0.30, 2.4, 1.0, "AI 海报生成", "(文生图 + Canvas)",
    fc=COL["B_view"], ec=COL["L_view"], fs=10)

# PostgreSQL -> 视图层
for x in [2.55, 5.60, 8.65]:
    arrow(x, 1.80, x, 1.30, color=COL["arrow"], lw=1.0)
label(5.60, 1.55, "衍生 / 只读查询", fs=8.5)

fig.tight_layout()
fig.savefig(os.path.join(HERE, "fig1-architecture.png"), dpi=300, bbox_inches="tight", facecolor='white')
fig.savefig(os.path.join(HERE, "fig1-architecture.svg"), dpi=300, bbox_inches="tight", facecolor='white')
print("saved fig1-architecture (png + svg)")
