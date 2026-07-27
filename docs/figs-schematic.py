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
# Fig3: 数据模型 ER 图
# ============================================================
fig, ax = plt.subplots(figsize=(7.2, 3.0))
ax.set_xlim(0, 10); ax.set_ylim(0, 5); ax.axis('off')

# 五级实体
boxes = [
    (0.3, 3.6, 1.6, 0.8, 'business\n业务', '#dbeafe'),
    (2.5, 3.6, 1.6, 0.8, 'shop\n门店', '#dbeafe'),
    (4.7, 3.6, 1.6, 0.8, 'template\n模板(JSONB)', '#dbeafe'),
    (6.9, 3.6, 1.6, 0.8, 'workbook\n工作簿', '#dbeafe'),
]
for b in boxes:
    rbox(ax, *b)
for i in range(len(boxes)-1):
    arrow(ax, boxes[i][0]+boxes[i][2], boxes[i][1]+boxes[i][3]/2,
          boxes[i+1][0], boxes[i+1][1]+boxes[i+1][3]/2)

# 下方表
rbox(ax, 1.0, 1.2, 2.0, 1.0, 'daily_metric\n日指标(JSONB, GIN)', '#f3e8ff')
rbox(ax, 3.8, 1.2, 1.6, 1.0, 'expense\n费用明细', '#f3e8ff')
rbox(ax, 6.0, 1.2, 1.8, 1.0, 'workbook_snapshot\n工作簿快照', '#f3e8ff')

arrow(ax, 5.5, 3.6, 2.0, 2.2)
arrow(ax, 5.5, 3.6, 4.6, 2.2)
arrow(ax, 7.7, 3.6, 6.9, 2.2)

ax.text(5, 4.85, 'Fig. 3 数据模型 ER 图 / Data Model ER Diagram',
        ha='center', fontsize=9, fontweight='bold', color='#1e293b')

save(fig, 'fig3-er-diagram')

# ============================================================
# Fig4: AI 抽取管线流程图
# ============================================================
fig, ax = plt.subplots(figsize=(7.2, 2.8))
ax.set_xlim(0, 10); ax.set_ylim(0, 4); ax.axis('off')

steps = [
    (0.3, 1.6, 1.4, 0.7, '工作簿\n快照', '#dbeafe'),
    (2.2, 1.6, 1.4, 0.7, '序列化\nTSV', '#dcfce7'),
    (4.1, 2.3, 1.6, 0.7, '确定性解析\nparseTransposed', '#fef3c7'),
    (4.1, 0.9, 1.6, 0.7, 'LLM 回退\ncallDoubaoJson', '#fecaca'),
    (6.3, 1.6, 1.4, 0.7, 'coerceMetric\n校验', '#e9d5ff'),
    (8.2, 1.6, 1.4, 0.7, '写库\ndaily_metric', '#f3e8ff'),
]
for s in steps:
    rbox(ax, *s)

for i in range(len(steps)-1):
    if i == 1:
        arrow(ax, steps[1][0]+steps[1][2], steps[1][1]+steps[1][3]/2, steps[2][0], steps[2][1]+steps[2][3]/2)
        arrow(ax, steps[1][0]+steps[1][2], steps[1][1]+steps[1][3]/2, steps[3][0], steps[3][1]+steps[3][3]/2)
    elif i == 2:
        arrow(ax, steps[2][0]+steps[2][2]/2, steps[2][1], steps[4][0], steps[4][1]+steps[4][3]/2)
    elif i == 3:
        arrow(ax, steps[3][0]+steps[3][2]/2, steps[3][1]+steps[3][3], steps[4][0], steps[4][1])
    else:
        arrow(ax, steps[i][0]+steps[i][2], steps[i][1]+steps[i][3]/2, steps[i+1][0], steps[i+1][1]+steps[i+1][3]/2)

# 转置/行式判断菱形
ax.text(4.9, 1.75, '转置?', ha='center', va='center', fontsize=6, color='#7c2d12')

ax.text(5, 3.7, 'Fig. 4 AI 抽取管线流程图 / AI Extraction Pipeline Flow',
        ha='center', fontsize=9, fontweight='bold', color='#1e293b')

save(fig, 'fig4-extraction-pipeline')

# ============================================================
# Fig5: 悲观锁状态转换图
# ============================================================
fig, ax = plt.subplots(figsize=(6.5, 2.6))
ax.set_xlim(0, 10); ax.set_ylim(0, 3.5); ax.axis('off')

states = [
    (0.5, 1.2, 1.4, 0.7, '空闲\nFree', '#f1f5f9'),
    (3.0, 1.2, 1.6, 0.7, '持锁编辑\nLocked', '#dbeafe'),
    (5.8, 2.0, 1.6, 0.7, '待办接管\nTakeover', '#fef3c7'),
    (5.8, 0.4, 1.6, 0.7, '心跳断\nExpired', '#fecaca'),
]
for s in states:
    rbox(ax, *s)

# 转换箭头
arrow(ax, 1.9, 1.55, 3.0, 1.55)           # 空闲->持锁
ax.text(2.45, 1.7, 'acquire', fontsize=5.5, color='#475569')

arrow(ax, 4.6, 1.55, 5.8, 2.35)           # 持锁->待办
ax.text(5.1, 2.15, 'request', fontsize=5.5, color='#475569')

arrow(ax, 4.6, 1.35, 5.8, 0.75)           # 持锁->过期
ax.text(5.1, 0.85, 'timeout', fontsize=5.5, color='#475569')

arrow(ax, 7.4, 2.35, 7.4, 1.9)            # 待办->持锁(让出)
ax.text(7.55, 2.1, 'yield', fontsize=5.5, color='#475569')

arrow(ax, 7.4, 0.75, 7.4, 1.2)            # 过期->空闲
ax.text(7.55, 0.95, 'clean', fontsize=5.5, color='#475569')

# 持锁->空闲(保存释放)
arrow(ax, 3.8, 1.2, 3.8, 0.6)
arrow(ax, 3.8, 0.6, 1.2, 0.6)
arrow(ax, 1.2, 0.6, 1.2, 1.2)
ax.text(2.5, 0.45, 'save+release', fontsize=5.5, color='#475569')

ax.text(5, 3.2, 'Fig. 5 悲观锁状态转换图 / Pessimistic Lock State Machine',
        ha='center', fontsize=9, fontweight='bold', color='#1e293b')

save(fig, 'fig5-lock-state-machine')

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

print("\nAll 5 schematics done.")
