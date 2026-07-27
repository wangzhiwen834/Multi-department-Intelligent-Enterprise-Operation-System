# fig2 - 足浴门店 2026-07 真实经营数据(16 天,AI 抽取入库)
# 3 面板: a 日营收趋势 / b 客流构成 / c 钟数构成
import json
import matplotlib as mpl
import matplotlib.pyplot as plt
import numpy as np

mpl.rcParams.update({
    "font.family": "sans-serif",
    "font.sans-serif": ["Microsoft YaHei", "SimHei", "Arial", "DejaVu Sans"],
    "axes.unicode_minus": False,
    "svg.fonttype": "none",
    "pdf.fonttype": 42,
    "font.size": 7,
    "axes.linewidth": 0.8,
    "axes.spines.right": False,
    "axes.spines.top": False,
    "legend.frameon": False,
})

with open("docs/fig2-data.json", encoding="utf-8") as f:
    rows = json.load(f)

dates = [r["date"] for r in rows]
x = np.arange(len(dates))
metrics = [r["metrics"] for r in rows]

def col(key):
    return np.array([float(m.get(key, np.nan)) if m.get(key) is not None else np.nan for m in metrics])

revenue = col("revenue")
cm, cg, cw = col("customers_member"), col("customers_group"), col("customers_walkin")
ca, cr, cd = col("clocks_arranged"), col("clocks_requested"), col("clocks_added")

C_REV = "#2563eb"
C_CM, C_CG, C_CW = "#93c5fd", "#fbbf24", "#f87171"
C_CA, C_CR, C_CD = "#34d399", "#60a5fa", "#c4b5fd"

fig, axes = plt.subplots(1, 3, figsize=(7.2, 2.5))
xt = x[::3]
xl = [d[5:] for d in dates][::3]

# a 日营收趋势
ax = axes[0]
ax.plot(x, revenue, "-o", color=C_REV, ms=2.5, lw=1.2)
ax.set_title("a  日营收趋势", loc="left", fontweight="bold")
ax.set_ylabel("营收(元)")
ax.set_xticks(xt); ax.set_xticklabels(xl)

# b 客流构成
ax = axes[1]
ax.bar(x, cm, color=C_CM, label="会员")
ax.bar(x, cg, bottom=np.nan_to_num(cm), color=C_CG, label="团购")
ax.bar(x, cw, bottom=np.nan_to_num(cm)+np.nan_to_num(cg), color=C_CW, label="散客")
ax.set_title("b  客流构成", loc="left", fontweight="bold")
ax.set_ylabel("客流(人)")
ax.set_xticks(xt); ax.set_xticklabels(xl)
ax.legend(fontsize=6, ncol=3, loc="upper center", bbox_to_anchor=(0.5, 1.18), handlelength=1)

# c 钟数构成
ax = axes[2]
ax.bar(x, ca, color=C_CA, label="排钟")
ax.bar(x, cr, bottom=np.nan_to_num(ca), color=C_CR, label="点钟")
ax.bar(x, cd, bottom=np.nan_to_num(ca)+np.nan_to_num(cr), color=C_CD, label="加钟")
ax.set_title("c  钟数构成", loc="left", fontweight="bold")
ax.set_ylabel("钟数")
ax.set_xticks(xt); ax.set_xticklabels(xl)
ax.legend(fontsize=6, ncol=3, loc="upper center", bbox_to_anchor=(0.5, 1.18), handlelength=1)

for ax in axes:
    ax.set_xlabel("日期(2026-07)")

fig.tight_layout()
fig.savefig("docs/fig2-footbath-eval.png", dpi=300, bbox_inches="tight")
fig.savefig("docs/fig2-footbath-eval.svg", bbox_inches="tight")
print("saved docs/fig2-footbath-eval.png + .svg")
