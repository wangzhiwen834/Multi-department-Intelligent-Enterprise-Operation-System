# fig1 - 系统总体架构图(Approach B: 录入与展示分离)
# 三层:录入层(Univer + 悲观锁) -> 数据层(AI 语义抽取管线 + PostgreSQL 唯一事实源) -> 视图层(大屏/AI 分析/AI 海报)
import os
import matplotlib as mpl
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches

mpl.rcParams.update({
    "font.family": "sans-serif",
    "font.sans-serif": ["Microsoft YaHei", "SimHei", "Arial", "DejaVu Sans"],
    "axes.unicode_minus": False,
    "svg.fonttype": "none",      # SVG 文字可编辑
    "pdf.fonttype": 42,          # TrueType 可编辑
    "font.size": 7.5,
})

HERE = os.path.dirname(os.path.abspath(__file__))

fig, ax = plt.subplots(figsize=(7.6, 4.5))
ax.set_xlim(0, 10)
ax.set_ylim(0, 6)
ax.axis('off')

# 调色板(与既有图一致)
C = {
    "entry_face": "#dbeafe", "entry_edge": "#1e40af", "entry_txt": "#1e3a8a",
    "staff_face": "#e2e8f0", "staff_edge": "#475569",
    "lock_face":  "#fef3c7", "lock_edge":  "#b45309", "lock_txt":  "#92400e",
    "data_face":  "#dcfce7", "data_edge":  "#166534", "data_txt":  "#14532d",
    "pg_face":    "#f3e8ff", "pg_edge":    "#7e22ce", "pg_sub":    "#e9d5ff",
    "view_face":  "#fce7f3", "view_edge":  "#9d174d", "view_txt":  "#831843",
    "tmpl_face":  "#e0e7ff", "tmpl_edge":  "#4338ca", "tmpl_txt":  "#3730a3",
    "arrow":      "#475569", "arrow_soft": "#94a3b8",
}


def rbox(x, y, w, h, txt, fc, ec, fs=7.5, tc="#1e293b", lw=0.9, weight="normal", ls="-"):
    p = mpatches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.03,rounding_size=0.08",
                                facecolor=fc, edgecolor=ec, linewidth=lw, linestyle=ls)
    ax.add_patch(p)
    ax.text(x + w / 2, y + h / 2, txt, ha='center', va='center', fontsize=fs,
            color=tc, linespacing=1.35, fontweight=weight)


def arrow(x0, y0, x1, y1, color=C["arrow"], lw=1.0, style="->", ls="-"):
    ax.annotate('', xy=(x1, y1), xytext=(x0, y0),
                arrowprops=dict(arrowstyle=style, color=color, lw=lw, linestyle=ls,
                                shrinkA=0, shrinkB=0))


def layer_strip(y0, y1, label, color):
    """左侧色条 + 旋转层标签"""
    strip = mpatches.FancyBboxPatch((0.12, y0), 0.42, y1 - y0,
                                    boxstyle="round,pad=0.0,rounding_size=0.06",
                                    facecolor=color, edgecolor="none", alpha=0.92)
    ax.add_patch(strip)
    ax.text(0.33, (y0 + y1) / 2, label, ha='center', va='center', fontsize=8,
            color="white", fontweight="bold", linespacing=1.3, rotation=90)


# ---- 录入层 (y 4.55 - 5.85) ----
layer_strip(4.55, 5.85, "录入层\nEntry", C["entry_edge"])
rbox(0.95, 4.95, 1.7, 0.7, "员工\n(店长 / 财务)", C["staff_face"], C["staff_edge"], fs=7)
rbox(3.05, 4.80, 2.9, 1.0, "Univer 在线表格\n(录入面, 仅写)", C["entry_face"], C["entry_edge"],
     fs=8, tc=C["entry_txt"], weight="bold")
rbox(6.45, 4.95, 2.05, 0.7, "工作表级\n悲观锁", C["lock_face"], C["lock_edge"],
     fs=7, tc=C["lock_txt"])
arrow(2.65, 5.30, 3.05, 5.30)                      # 员工 -> Univer
arrow(5.95, 5.30, 6.45, 5.30)                      # Univer -> 悲观锁
ax.text(6.15, 5.42, "守护", ha='center', va='bottom', fontsize=5.8, color=C["lock_edge"])

# ---- 数据层 (y 2.30 - 4.30) ----
layer_strip(2.30, 4.30, "数据层\nData", C["data_edge"])
rbox(2.55, 3.50, 5.05, 0.78, "AI 语义抽取管线  (唯一入库路径)", C["data_face"], C["data_edge"],
     fs=8, tc=C["data_txt"], weight="bold")
rbox(8.10, 3.50, 1.65, 0.78, "模板描述符\ndefinition (JSONB)", C["tmpl_face"], C["tmpl_edge"],
     fs=6.3, tc=C["tmpl_txt"], ls="--")
arrow(8.10, 3.89, 7.60, 3.89, color=C["tmpl_edge"], lw=0.8, ls="--")  # 描述符 -> 抽取管线
ax.text(7.85, 4.00, "驱动", ha='center', va='bottom', fontsize=5.8, color=C["tmpl_edge"])

# PostgreSQL 唯一事实源 + 三类表
rbox(1.55, 2.35, 7.10, 0.88, "PostgreSQL  (唯一事实源)", C["pg_face"], C["pg_edge"],
     fs=8, tc="#6b21a8", weight="bold")
ax.text(5.10, 2.86, "干净业务表 / 快照", ha='center', va='center', fontsize=5.8, color="#7e22ce")
rbox(1.80, 2.42, 2.05, 0.34, "daily_metric", C["pg_sub"], C["pg_edge"], fs=6, lw=0.7)
rbox(4.05, 2.42, 1.55, 0.34, "expense", C["pg_sub"], C["pg_edge"], fs=6, lw=0.7)
rbox(5.85, 2.42, 2.55, 0.34, "workbook_snapshot", C["pg_sub"], C["pg_edge"], fs=6, lw=0.7)

arrow(4.50, 4.80, 4.50, 4.28)                      # Univer -> 抽取管线 (保存/定时)
ax.text(4.62, 4.55, "保存 / 定时", ha='left', va='center', fontsize=5.8, color=C["arrow"])
arrow(5.07, 3.50, 5.07, 3.23)                      # 抽取管线 -> PostgreSQL (upsert)
ax.text(5.18, 3.37, "upsert", ha='left', va='center', fontsize=5.8, color=C["arrow"])

# ---- 视图层 (y 0.45 - 1.70) ----
layer_strip(0.45, 1.70, "视图层\nView", C["view_edge"])
rbox(0.95, 0.55, 2.55, 1.0, "数据大屏\n(ECharts, 粒度聚合)", C["view_face"], C["view_edge"],
     fs=7.5, tc=C["view_txt"])
rbox(3.85, 0.55, 2.85, 1.0, "AI 经营分析\n(function-calling)", C["view_face"], C["view_edge"],
     fs=7.5, tc=C["view_txt"])
rbox(7.05, 0.55, 2.25, 1.0, "AI 海报\n(文生图 + Canvas)", C["view_face"], C["view_edge"],
     fs=7.5, tc=C["view_txt"])

# PostgreSQL -> 视图(衍生/读取)
for x in [2.22, 5.27, 8.17]:
    arrow(x, 2.35, x, 1.55, color=C["arrow"], lw=0.9)
ax.text(5.10, 1.95, "衍生 / 读取(只读)", ha='center', va='center', fontsize=5.8,
        color=C["arrow"], style="italic")

fig.tight_layout()
fig.savefig(os.path.join(HERE, "fig1-architecture.png"), dpi=300, bbox_inches="tight", facecolor='white')
fig.savefig(os.path.join(HERE, "fig1-architecture.svg"), dpi=300, bbox_inches="tight", facecolor='white')
print("saved fig1-architecture (png + svg)")
