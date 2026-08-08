# fig3-fig7 - 架构与模块功能示意图(Schematics)
# 全部中文标签 + 中英双语图题; 导出 PNG+SVG
import matplotlib as mpl
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches

mpl.rcParams.update({
    "font.family": "sans-serif",
    "font.sans-serif": ["Microsoft YaHei", "SimHei", "Arial", "DejaVu Sans"],
    "axes.unicode_minus": False,
    "svg.fonttype": "none",
    "pdf.fonttype": 42,
    "font.size": 7,
})


def save(fig, name):
    fig.savefig(f"docs/{name}.png", dpi=300, bbox_inches="tight", facecolor='white')
    fig.savefig(f"docs/{name}.svg", bbox_inches="tight", facecolor='white')
    print(f"saved {name}")


def rbox(ax, x, y, w, h, txt, fc, fs=7, ec='#475569'):
    p = mpatches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.03",
                                facecolor=fc, edgecolor=ec, linewidth=0.8)
    ax.add_patch(p)
    ax.text(x+w/2, y+h/2, txt, ha='center', va='center', fontsize=fs, color='#1e293b', linespacing=1.3)


def arrow(ax, x1, y1, x2, y2, color='#475569'):
    ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(arrowstyle='->', color=color, lw=1.0))

# ============================================================
# Fig3: 数据模型 ER 图 (标准 E-R 规范: 矩形实体 / 菱形联系 / 椭圆属性 / 下划线主键)
# ============================================================
fig, ax = plt.subplots(figsize=(13.0, 8.8))
ax.set_xlim(0, 13); ax.set_ylim(0, 8.8); ax.axis('off')

import matplotlib.patches as mpatches
from matplotlib.patches import Ellipse, Polygon

EC = '#1e3a8a'      # 实体主色
RC = '#c2410c'      # 联系色
AC = '#0f766e'      # 属性色
KEY = '#991b1b'     # 主键下划线色
LINE = '#475569'    # 连线色

def er_entity(cx, cy, w, h, name, fc='#dbeafe'):
    x, y = cx - w/2, cy - h/2
    p = mpatches.FancyBboxPatch((x, y), w, h,
                                boxstyle="round,pad=0.02,rounding_size=0.04",
                                facecolor=fc, edgecolor=EC, linewidth=1.5)
    ax.add_patch(p)
    ax.text(cx, cy, name, ha='center', va='center', fontsize=10,
            color=EC, fontweight='bold')

def er_relation(cx, cy, w, h, name, fc='#fed7aa'):
    """菱形联系"""
    pts = [(cx, cy + h/2), (cx + w/2, cy), (cx, cy - h/2), (cx - w/2, cy)]
    p = Polygon(pts, closed=True, facecolor=fc, edgecolor=RC, linewidth=1.5)
    ax.add_patch(p)
    ax.text(cx, cy, name, ha='center', va='center', fontsize=8.5,
            color=RC, fontweight='bold', linespacing=1.2)

def er_attr(cx, cy, name, is_key=False, w=None, h=None):
    if w is None: w = max(1.2, len(name) * 0.16 + 0.5)
    if h is None: h = 0.52
    e = Ellipse((cx, cy), w, h, facecolor='#ecfdf5', edgecolor=AC, linewidth=1.0)
    ax.add_patch(e)
    weight = 'bold' if is_key else 'normal'
    ax.text(cx, cy, name, ha='center', va='center', fontsize=7.5,
            color=AC, fontweight=weight)
    if is_key:
        ax.plot([cx - w*0.38, cx + w*0.38], [cy - 0.02, cy - 0.02],
                color=KEY, lw=1.2, solid_capstyle='round')

def er_line(x1, y1, x2, y2, color=LINE, lw=1.2):
    ax.plot([x1, x2], [y1, y2], color=color, lw=lw, solid_capstyle='round')

def er_card(x, y, text, color=LINE):
    ax.text(x, y, text, ha='center', va='center', fontsize=9, color=color,
            fontweight='bold',
            bbox=dict(boxstyle='circle,pad=0.18', fc='white', ec=color, lw=1.0))

# ============================================================
# 布局 (自上而下, 实体集中在中轴, 属性分别向左右展开)
# 第1行: business + 属性
# 第2行: shop + template (左右对称) + 联系
# 第3行: workbook + 属性
# 第4行: daily_metric + expense + workbook_snapshot + 属性
# ============================================================

# ---- 第一层: business (y=7.2) ----
er_entity(6.2, 7.2, 2.4, 0.75, 'business  业务')
# 左属性
er_attr(1.5, 7.5, 'business_id', is_key=True, w=1.6)
er_attr(3.1, 7.55, 'business_code', w=1.7)
er_line(2.3, 7.28, 5.0, 7.20)
er_line(3.95, 7.40, 5.0, 7.28)
# 右属性
er_attr(9.5, 7.55, 'name', w=1.3)
er_attr(11.2, 7.5, 'created_at', w=1.5)
er_line(7.4, 7.20, 8.85, 7.40)
er_line(7.4, 7.28, 10.45, 7.28)

# ---- 第二层左: shop (y=5.0), 第二层右: template (y=5.0) ----
er_entity(2.5, 5.0, 2.0, 0.75, 'shop  门店')
# shop 左属性
er_attr(0.5, 5.5, 'shop_id', is_key=True, w=1.3)
er_attr(0.4, 4.9, 'name', w=1.1)
er_attr(0.5, 4.3, 'address', w=1.3)
er_line(1.5, 5.12, 1.05, 5.30)
er_line(1.5, 5.0, 0.95, 4.90)
er_line(1.5, 4.88, 1.05, 4.55)

er_entity(10.0, 5.0, 2.3, 0.75, 'template  模板')
# template 右属性
er_attr(12.1, 5.6, 'template_id', is_key=True, w=1.7)
er_attr(12.1, 5.0, 'version', w=1.3)
er_attr(12.0, 4.3, 'definition\n(JSONB)', w=1.9, h=0.62)
er_line(11.15, 5.22, 11.45, 5.42)
er_line(11.15, 5.0, 11.45, 5.0)
er_line(11.15, 4.72, 11.35, 4.52)

# 联系 R1: business - 拥有 - shop (1:N)
er_relation(4.5, 6.2, 1.0, 0.6, '拥有\nhas')
er_line(5.8, 6.82, 4.9, 6.45)
er_card(5.3, 6.70, '1')
er_line(4.1, 5.95, 3.2, 5.38)
er_card(3.7, 5.72, 'N')

# 联系 R2: business - 定义 - template (1:N)
er_relation(8.2, 6.2, 1.0, 0.6, '定义\ndefines')
er_line(6.6, 6.82, 7.7, 6.45)
er_card(7.1, 6.70, '1')
er_line(8.7, 5.95, 9.2, 5.38)
er_card(8.95, 5.72, 'N')

# ---- 第三层: workbook (y=3.5) ----
er_entity(6.8, 3.5, 2.4, 0.75, 'workbook  工作簿')
# workbook 上属性 (放在上方, 居中)
er_attr(5.5, 4.5, 'workbook_id', is_key=True, w=1.6)
er_attr(7.3, 4.6, 'period', w=1.1)
er_attr(9.0, 4.5, 'tmpl_version', w=1.6)
er_line(6.1, 3.88, 5.9, 4.28)
er_line(7.2, 3.88, 7.2, 4.30)
er_line(7.9, 3.88, 8.3, 4.28)

# 联系 R3: shop - 包含 - workbook (1:N), 联系菱形放左下方, 从 shop 底连到 workbook 左
er_relation(4.8, 4.2, 1.0, 0.6, '包含\ncontains')
er_line(3.5, 4.50, 4.4, 4.45)
er_card(3.9, 4.60, '1')
er_line(5.2, 3.95, 5.6, 3.88)
er_card(5.4, 4.05, 'N')

# ---- 第四层: daily_metric / expense / workbook_snapshot ----
er_entity(2.0, 1.5, 2.4, 0.75, 'daily_metric  日指标', fc='#f3e8ff')
# daily_metric 下方属性
er_attr(1.0, 0.55, '(shop_id, date)', is_key=True, w=2.0)
er_attr(3.2, 0.55, 'metrics (JSONB)', w=2.0, h=0.52)
er_line(1.5, 1.12, 1.4, 0.82)
er_line(2.5, 1.12, 2.7, 0.82)

er_entity(5.8, 1.5, 2.2, 0.75, 'expense  费用明细', fc='#f3e8ff')
# expense 下方属性
er_attr(4.9, 0.55, 'expense_id', is_key=True, w=1.5)
er_attr(6.7, 0.55, 'amount + category', w=1.8)
er_line(5.4, 1.12, 5.3, 0.82)
er_line(6.2, 1.12, 6.3, 0.82)

er_entity(10.0, 1.5, 2.6, 0.75, 'workbook_snapshot  快照', fc='#f3e8ff')
# snapshot 下方属性 (统一放在实体下方)
er_attr(8.8, 0.55, 'snapshot_id', is_key=True, w=1.5)
er_attr(10.5, 0.50, 'data (JSONB)', w=1.7)
er_attr(12.0, 0.55, 'extracted_at', w=1.5)
er_line(9.4, 1.12, 9.1, 0.85)
er_line(10.0, 1.12, 10.0, 0.78)
er_line(10.6, 1.12, 10.9, 0.85)

# 联系 R4: workbook - 快照 - snapshot (1:1)
er_relation(8.8, 2.6, 1.0, 0.6, '快照\nof')
er_line(8.0, 3.30, 8.3, 2.85)
er_card(8.2, 3.15, '1')
er_line(9.3, 2.35, 9.5, 1.88)
er_card(9.4, 2.18, '1')

# 联系 R5: shop - 产生 - daily_metric (1:N)
er_relation(2.2, 3.1, 1.0, 0.6, '产生\nproduces')
er_line(2.2, 4.62, 2.2, 3.40)
er_card(2.2, 4.05, '1')
er_line(2.2, 2.80, 2.1, 1.88)
er_card(2.1, 2.45, 'N')

# 联系 R6: shop - 产生 - expense (1:N) (从 shop 底部 -> expense 顶部, 走右下方)
er_relation(5.5, 2.6, 1.0, 0.6, '产生\nincurs')
er_line(3.5, 4.25, 5.2, 2.90)
er_card(4.3, 3.75, '1')
er_line(5.8, 2.30, 5.8, 1.88)
er_card(5.8, 2.12, 'N')

# ---- 图注 ----
ax.text(6.5, 0.25, '图 2  数据模型 E-R 图 / Data Model ER Diagram',
        ha='center', fontsize=10.5, fontweight='bold', color='#1e293b')

save(fig, 'fig3-er-diagram')

# ============================================================
# Fig4: AI 抽取管线流程图 (标准流程图)
# ============================================================
fig, ax = plt.subplots(figsize=(8.5, 5.8))
ax.set_xlim(0, 10); ax.set_ylim(0, 7); ax.axis('off')

import matplotlib.patches as mpatches
from matplotlib.patches import Polygon, Ellipse

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
flow_start(5.0, 6.4, 1.8, 0.6, '开始
Start')

flow_proc(5.0, 5.5, 3.2, 0.6, '读取 workbook_snapshot
(工作簿快照)')
flow_arrow(5.0, 6.10, 5.0, 5.80)

flow_proc(5.0, 4.6, 3.2, 0.6, 'serializeSheet
序列化为 TSV')
flow_arrow(5.0, 5.20, 5.0, 4.90)

flow_decision(5.0, 3.55, 1.8, 1.1, '转置布局?
Transposed?')
flow_arrow(5.0, 4.30, 5.0, 4.10)

# 左分支: 是 -> 确定性解析
flow_proc(2.3, 2.2, 2.8, 0.7, 'parseTransposed
确定性解析')
flow_arrow(4.15, 3.25, 3.70, 2.55, label='是 / Yes', label_pos='above', label_offset=0.02)

# 右分支: 否 -> LLM 回退
flow_proc(7.7, 2.2, 2.8, 0.7, 'callDoubaoJson
LLM 语义抽取')
flow_arrow(5.85, 3.25, 6.30, 2.55, label='否 / No', label_pos='above', label_offset=0.02)

# 汇总: coerceMetric 双保险校验
flow_proc(5.0, 1.0, 3.4, 0.7, 'coerceMetric 双保险校验
(类型转换 + 强校验)')
flow_arrow(2.3, 1.85, 3.8, 1.35)
flow_arrow(7.7, 1.85, 6.2, 1.35)

flow_end(5.0, 0.15, 2.8, 0.5, '写入 daily_metric & expense')
flow_arrow(5.0, 0.65, 5.0, 0.40)

# ---- 标题 ----
ax.text(5.0, 6.85, '图 3  AI 抽取管线流程图 / AI Extraction Pipeline Flow',
        ha='center', fontsize=10.5, fontweight='bold', color='#1e293b')

save(fig, 'fig4-extraction-pipeline')


# ============================================================
# Fig5(图4): 悲观锁状态转换图 -> 见 fig5-lock.py
#   独立脚本, UML 状态机规范版, 忠实于 server/src/lock/lock.service.ts;
#   输出 fig5-lock-state-machine.png/.svg。本主脚本不再重复生成,
#   以免旧压缩版覆盖规范版。
# ============================================================

# ============================================================
# Fig6: 模板描述符"一份五用"
# ============================================================
fig, ax = plt.subplots(figsize=(6.0, 3.0))
ax.set_xlim(0, 10); ax.set_ylim(0, 5); ax.axis('off')

# 中心: template.definition JSONB
rbox(ax, 3.8, 2.0, 2.4, 1.0, 'template.definition\n(JSONB)', '#f3e8ff', fs=8, ec='#7c3aed')

# 五用
uses = [
    (0.3, 3.8, 2.0, 0.7, '录入表结构\n生成', '#dbeafe'),
    (0.3, 2.2, 2.0, 0.7, '抽取解析\n(extraction)', '#dcfce7'),
    (0.3, 0.6, 2.0, 0.7, '报表/台账\n生成', '#fef3c7'),
    (7.7, 3.8, 2.0, 0.7, '大屏指标\n选取', '#fecaca'),
    (7.7, 2.2, 2.0, 0.7, 'AI 上下文\n构建', '#e9d5ff'),
]
for u in uses:
    rbox(ax, *u)

# 连线
for u in uses[:3]:
    arrow(ax, u[0]+u[2], u[1]+u[3]/2, 3.8, 2.5)
for u in uses[3:]:
    arrow(ax, 6.2, 2.5, u[0], u[1]+u[3]/2)

ax.text(5, 4.8, 'Fig. 6 模板描述符"一份五用" / Template Descriptor: Five Reuses',
        ha='center', fontsize=9, fontweight='bold', color='#1e293b')

save(fig, 'fig6-template-five-uses')

# ============================================================
# Fig7: 多业务分派示意图
# ============================================================
fig, ax = plt.subplots(figsize=(6.5, 2.4))
ax.set_xlim(0, 10); ax.set_ylim(0, 3); ax.axis('off')

rbox(ax, 0.3, 1.0, 1.8, 0.8, 'Dashboard.vue\n(通用壳)', '#f1f5f9')
ax.text(2.6, 1.4, 'businessCode', fontsize=7, color='#475569')
arrow(ax, 2.1, 1.4, 3.0, 1.4)

rbox(ax, 3.2, 1.0, 1.6, 0.8, 'Footbath\nDashboard', '#dbeafe')
rbox(ax, 5.4, 1.0, 1.6, 0.8, 'Hotel\nDashboard', '#dbeafe')
rbox(ax, 7.6, 1.0, 1.6, 0.8, '...\n(新业态)', '#f1f5f9')

# 后端
rbox(ax, 3.2, 0.0, 1.6, 0.6, 'footbath.ts\n处理器', '#dcfce7', fs=6)
rbox(ax, 5.4, 0.0, 1.6, 0.6, 'hotel.ts\n处理器', '#dcfce7', fs=6)

arrow(ax, 4.0, 1.0, 4.0, 0.6)
arrow(ax, 6.2, 1.0, 6.2, 0.6)

ax.text(5, 2.7, 'Fig. 7 多业务分派示意图 / Multi-Business Dispatch',
        ha='center', fontsize=9, fontweight='bold', color='#1e293b')

save(fig, 'fig7-business-dispatch')

print("\nSchematics done (fig3,4,6,7). fig5(图4) 见 fig5-lock.py")
