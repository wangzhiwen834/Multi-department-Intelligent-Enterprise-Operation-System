# Fig4: AI 抽取管线流程图 (标准流程图规范)
import os
import matplotlib as mpl
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import Polygon, Ellipse

mpl.rcParams.update({
    "font.family": "sans-serif",
    "font.sans-serif": ["Microsoft YaHei", "SimHei", "Arial", "DejaVu Sans"],
    "axes.unicode_minus": False,
    "svg.fonttype": "none",
    "pdf.fonttype": 42,
    "font.size": 9,
})

HERE = os.path.dirname(os.path.abspath(__file__))

fig, ax = plt.subplots(figsize=(8.5, 5.8))
ax.set_xlim(0, 10); ax.set_ylim(0, 7); ax.axis('off')

PROC = '#dbeafe'      # 处理框色
DEC  = '#fff3cd'      # 判断框色
START = '#d4edda'     # 开始框色
END  = '#f8d7da'      # 结束框色
LINE = '#455a64'      # 连线色

def flow_proc(cx, cy, w, h, text):
    x, y = cx - w/2, cy - h/2
    p = mpatches.FancyBboxPatch((x, y), w, h,
                                boxstyle="round,pad=0.02,rounding_size=0.05",
                                facecolor=PROC, edgecolor='#1e3a8a', linewidth=1.3)
    ax.add_patch(p)
    ax.text(cx, cy, text, ha='center', va='center', fontsize=9,
            color='#1e3a8a', fontweight='bold', linespacing=1.3)

def flow_decision(cx, cy, w, h, text):
    pts = [(cx, cy + h/2), (cx + w/2, cy), (cx, cy - h/2), (cx - w/2, cy)]
    p = Polygon(pts, closed=True, facecolor=DEC, edgecolor='#b45309', linewidth=1.3)
    ax.add_patch(p)
    ax.text(cx, cy, text, ha='center', va='center', fontsize=8.5,
            color='#92400e', fontweight='bold', linespacing=1.2)

def flow_start(cx, cy, w, h, text):
    e = Ellipse((cx, cy), w, h, facecolor=START, edgecolor='#1e7e34', linewidth=1.3)
    ax.add_patch(e)
    ax.text(cx, cy, text, ha='center', va='center', fontsize=9,
            color='#1e7e34', fontweight='bold')

def flow_end(cx, cy, w, h, text):
    e = Ellipse((cx, cy), w, h, facecolor=END, edgecolor='#991b1b', linewidth=1.3)
    ax.add_patch(e)
    ax.text(cx, cy, text, ha='center', va='center', fontsize=9,
            color='#991b1b', fontweight='bold')

def flow_arrow(x1, y1, x2, y2, label='', label_pos='right', label_offset=0.2):
    ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(arrowstyle='->', color=LINE, lw=1.3, shrinkA=3, shrinkB=3))
    if label:
        mx, my = (x1+x2)/2, (y1+y2)/2
        if label_pos == 'right':
            ha, va, dx, dy = 'left', 'center', label_offset, 0
        elif label_pos == 'left':
            ha, va, dx, dy = 'right', 'center', -label_offset, 0
        elif label_pos == 'above':
            ha, va, dx, dy = 'center', 'bottom', 0, label_offset
        elif label_pos == 'below':
            ha, va, dx, dy = 'center', 'top', 0, -label_offset
        else:
            ha, va, dx, dy = 'center', 'center', 0, 0
        ax.text(mx + dx, my + dy, label, ha=ha, va=va, fontsize=8,
                color=LINE, fontweight='bold',
                bbox=dict(boxstyle='round,pad=0.18', fc='white', ec=LINE, lw=0.8))

# ---- 流程节点 ----
flow_start(5.0, 6.4, 1.8, 0.6, '开始\nStart')

flow_proc(5.0, 5.5, 3.2, 0.6, '读取 workbook_snapshot\n(工作簿快照)')
flow_arrow(5.0, 6.10, 5.0, 5.80)

flow_proc(5.0, 4.6, 3.2, 0.6, 'serializeSheet\n序列化为 TSV')
flow_arrow(5.0, 5.20, 5.0, 4.90)

flow_decision(5.0, 3.55, 1.8, 1.1, '转置布局?\nTransposed?')
flow_arrow(5.0, 4.30, 5.0, 4.10)

# 左分支: 是 -> 确定性解析
flow_proc(2.3, 2.2, 2.8, 0.7, 'parseTransposed\n确定性解析')
flow_arrow(4.15, 3.25, 3.70, 2.55, label='是 / Yes', label_pos='above', label_offset=0.02)

# 右分支: 否 -> LLM 回退
flow_proc(7.7, 2.2, 2.8, 0.7, 'callDoubaoJson\nLLM 语义抽取')
flow_arrow(5.85, 3.25, 6.30, 2.55, label='否 / No', label_pos='above', label_offset=0.02)

# 汇总: coerceMetric 双保险校验
flow_proc(5.0, 1.0, 3.4, 0.7, 'coerceMetric 双保险校验\n(类型转换 + 强校验)')
flow_arrow(2.3, 1.85, 3.8, 1.35)
flow_arrow(7.7, 1.85, 6.2, 1.35)

flow_end(5.0, 0.15, 2.8, 0.5, '写入 daily_metric & expense')
flow_arrow(5.0, 0.65, 5.0, 0.40)

# ---- 标题 ----
ax.text(5.0, 6.85, '图 3  AI 抽取管线流程图 / AI Extraction Pipeline Flow',
        ha='center', fontsize=10.5, fontweight='bold', color='#1e293b')

fig.tight_layout()
fig.savefig(os.path.join(HERE, 'fig4-extraction-pipeline.png'), dpi=300, bbox_inches='tight', facecolor='white')
fig.savefig(os.path.join(HERE, 'fig4-extraction-pipeline.svg'), dpi=300, bbox_inches='tight', facecolor='white')
print("saved fig4-extraction-pipeline (png + svg)")
