# Fig5(图4): 悲观锁状态转换图 — UML 状态机规范版
# 状态: 空闲 Free / 持锁编辑 Held / 待办接管 Takeover-Pending (+ 初始伪状态 ●)
# 转移标注: 事件 [守卫] / 动作; 忠实于 server/src/lock/lock.service.ts
#   - acquireLock: 先清过期再 INSERT ON CONFLICT DO NOTHING; owner=self 则续期接管
#   - heartbeat: 仅持有者可续; 返回 takeoverRequest(有人请求接管)
#   - requestTakeover: 单槽待办(后到覆盖), 不夺权
#   - yieldLock: 持有者保存后让出, 持有者←请求者(两阶段礼让)
#   - releaseLock: 仅持有者可删(幂等); 保存前 isLockHolder 校验防覆盖
#   - timeout: expires_at<now() 由下次访问 lazy DELETE 清理(断线≈60s)
import os
import matplotlib as mpl
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Circle

mpl.rcParams.update({
    "font.family": "sans-serif",
    "font.sans-serif": ["Microsoft YaHei", "SimHei", "Arial", "DejaVu Sans"],
    "axes.unicode_minus": False,
    "svg.fonttype": "none",
    "pdf.fonttype": 42,
    "font.size": 9,
})

HERE = os.path.dirname(os.path.abspath(__file__))

fig, ax = plt.subplots(figsize=(13.0, 8.0))
ax.set_xlim(0, 13); ax.set_ylim(0, 8); ax.axis('off')

# 配色
FREE_C = '#f1f5f9'
HELD_C = '#dbeafe'
TAKE_C = '#fef3c7'
EDGE   = '#334155'
ARROW  = '#475569'
INK    = '#0f172a'


def state(cx, cy, w, h, cn, en, behavior, fc):
    x, y = cx - w / 2, cy - h / 2
    ax.add_patch(FancyBboxPatch(
        (x, y), w, h,
        boxstyle="round,pad=0.02,rounding_size=0.08",
        facecolor=fc, edgecolor=EDGE, linewidth=1.4))
    ax.text(cx, cy + 0.24, cn, ha='center', va='center',
            fontsize=12, color=INK, fontweight='bold')
    ax.text(cx, cy - 0.01, en, ha='center', va='center',
            fontsize=9.5, color='#475569', style='italic')
    ax.text(cx, cy - 0.30, behavior, ha='center', va='center',
            fontsize=8, color='#64748b', linespacing=1.3)


def initial(cx, cy):
    ax.add_patch(Circle((cx, cy), 0.10, color=INK))


def trans(x1, y1, x2, y2, rad, label, lx, ly):
    """带 UML 标注的转移箭头: 弧线 + 白底标签(事件[守卫]/动作)"""
    ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(arrowstyle='-|>', color=ARROW, lw=1.4,
                                connectionstyle=f'arc3,rad={rad}',
                                shrinkA=4, shrinkB=4))
    ax.text(lx, ly, label, ha='center', va='center', fontsize=8,
            color='#334155', linespacing=1.35,
            bbox=dict(boxstyle='round,pad=0.28', fc='white', ec=ARROW, lw=0.8))


def label_only(lx, ly, text):
    ax.text(lx, ly, text, ha='center', va='center', fontsize=8,
            color='#334155', linespacing=1.35,
            bbox=dict(boxstyle='round,pad=0.28', fc='white', ec=ARROW, lw=0.8))


# ============================================================
# 布局: 空闲(左) - 持锁(中) - 待办接管(右), 中线 y=4.3
# 上行=前向弧(acquire/request/heartbeat 自环); 下行=返回弧(yield/release/timeout)
# ============================================================
CY = 4.3
initial(1.0, CY)
state(3.0, CY, 2.2, 1.25, '空闲', 'Free',
      'entry/ 无活跃锁', FREE_C)
state(7.0, CY, 2.6, 1.35, '持锁编辑', 'Held',
      'do/ 每 5 s heartbeat 续期\n(TTL = 60 s)', HELD_C)
state(11.0, CY, 2.9, 1.35, '待办接管', 'Takeover-Pending',
      'do/ 收到 takeoverRequest\n保存后 yieldLock', TAKE_C)

# ---- 初始 -> 空闲 ----
ax.annotate('', xy=(1.85, CY), xytext=(1.12, CY),
            arrowprops=dict(arrowstyle='-|>', color=ARROW, lw=1.4,
                            shrinkA=2, shrinkB=2))

# ---- 上行(前向) ----
# 空闲 -> 持锁: acquire
trans(4.1, CY + 0.35, 5.7, CY + 0.35, 0.35,
      'acquireLock\n[无活跃锁 ∨ owner=self]\n/ INSERT; expires_at←now+60 s',
      4.9, 5.55)
# 持锁 -> 待办接管: request
trans(8.3, CY + 0.35, 9.55, CY + 0.35, 0.35,
      'requestTakeover\n[锁被他人持有]\n/ request_user_id←请求者(单槽·后到覆盖)',
      8.92, 5.55)
# 持锁 自环: heartbeat
ax.annotate('', xy=(7.55, CY + 0.65), xytext=(6.45, CY + 0.65),
            arrowprops=dict(arrowstyle='-|>', color=ARROW, lw=1.4,
                            connectionstyle='arc3,rad=0.9', shrinkA=3, shrinkB=3))
label_only(7.0, 6.55,
           'heartbeat\n[owner=self ∧ now ≤ expires_at]\n/ expires_at←now+60 s;  req ≠ null → 置 takeoverRequest')

# ---- 下行(返回) ----
# 待办接管 -> 持锁: yield (两阶段礼让, 持有者换为请求者)
trans(9.55, CY - 0.30, 8.3, CY - 0.30, 0.30,
      'yieldLock\n[owner=self ∧ req ≠ null]\n/ holder←请求者; 清 req; expires_at←now+60 s',
      8.92, 3.15)
# 持锁 -> 空闲: release (保存后释放)
trans(5.7, CY - 0.30, 4.1, CY - 0.30, 0.30,
      'releaseLock(保存后)\n[isLockHolder] / DELETE',
      4.9, 3.15)
# 持锁 -> 空闲: timeout (断线≈60s, lazy 清理)
trans(6.3, CY - 0.62, 3.3, CY - 0.62, 0.45,
      'timeout\n[now > expires_at]\n/ 清理过期行(断线 ≈ 60 s)',
      4.8, 2.05)
# 待办接管 -> 空闲: timeout (持锁者断线, 请求者下次 acquire 接管)
trans(10.7, CY - 0.62, 2.7, CY - 0.62, 0.55,
      'timeout\n[now > expires_at] / 清理过期行',
      7.0, 1.05)

# ---- 标题 ----
ax.text(6.5, 7.6, '图 4  悲观锁状态转换图 / Pessimistic Lock State Machine',
        ha='center', fontsize=12, fontweight='bold', color=INK)

# ---- 图例 ----
ax.text(1.1, 0.55,
        '● 初始伪状态\n转移标注: 事件 [守卫] / 动作\nTTL = 60 s · 心跳 = 5 s · 单槽接管(后到覆盖)',
        ha='left', va='center', fontsize=8, color='#475569', linespacing=1.5,
        bbox=dict(boxstyle='round,pad=0.35', fc='#f8fafc', ec='#cbd5e1', lw=0.8))

fig.tight_layout()
fig.savefig(os.path.join(HERE, 'fig5-lock-state-machine.png'), dpi=300,
            bbox_inches='tight', facecolor='white')
fig.savefig(os.path.join(HERE, 'fig5-lock-state-machine.svg'),
            bbox_inches='tight', facecolor='white')
print("saved fig5-lock-state-machine (png + svg) — UML 规范版")
