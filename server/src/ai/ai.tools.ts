import { query } from '../db/pool.js';

export interface AiCtx { shopId: number | null; period: string }

// 工具定义(OpenAI function calling 格式)
export const AI_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'get_kpis',
      description: '获取某月(可选某店)的关键经营指标:总营收、总客流、平均客单价、充值总额、任务完成进度、时间进度',
      parameters: {
        type: 'object',
        properties: {
          period: { type: 'string', description: 'YYYY-MM 月份' },
          shopId: { type: 'integer', description: '门店 id,不传=全部店汇总' },
        },
        required: ['period'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'query_daily_metrics',
      description: '按日查询指定指标的明细。metricKeys 例如:revenue(营业收入)、customers_total(总客流)、recharge_total(充值总额)、footbath_revenue、spa_revenue、minor_revenue 等',
      parameters: {
        type: 'object',
        properties: {
          period: { type: 'string', description: 'YYYY-MM' },
          shopId: { type: 'integer', description: '门店 id,不传=全部店' },
          metricKeys: { type: 'array', items: { type: 'string' }, description: '要查询的指标 key 列表' },
        },
        required: ['period', 'metricKeys'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'query_expenses',
      description: '查询费用明细,可按科目过滤',
      parameters: {
        type: 'object',
        properties: {
          period: { type: 'string', description: 'YYYY-MM(按付款日期)' },
          shopId: { type: 'integer', description: '门店 id,不传=全部店' },
          subject: { type: 'string', description: '科目关键字,如 维修费、工资' },
        },
        required: ['period'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'compare_shops',
      description: '5 店对比某个指标(按月汇总),返回各店该指标值与排名',
      parameters: {
        type: 'object',
        properties: {
          period: { type: 'string', description: 'YYYY-MM' },
          metricKey: { type: 'string', description: '指标 key,如 revenue' },
        },
        required: ['period', 'metricKey'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_template',
      description: '获取当前业务的录入表模板定义(所有可用指标 key 与中文名、类型),用于了解可查询的指标',
      parameters: { type: 'object', properties: {} },
    },
  },
];

const shopFilter = (ctx: AiCtx, args: { shopId?: number }) => {
  const shopId = args.shopId ?? ctx.shopId;
  return { shopId, filter: shopId ? 'AND shop_id=$2' : '', params: shopId ? [ctx.period, shopId] : [ctx.period] };
};

async function getKpis(args: { period?: string; shopId?: number }, ctx: AiCtx) {
  const period = args.period ?? ctx.period;
  const { shopId, filter, params } = shopFilter({ ...ctx, period }, args);
  const kpi = (await query(
    `SELECT COALESCE(SUM((metrics->>'revenue')::numeric),0) AS revenue,
            COALESCE(SUM((metrics->>'customers_total')::numeric),0) AS customers,
            COALESCE(SUM((metrics->>'recharge_total')::numeric),0) AS recharge
     FROM daily_metric WHERE to_char(date,'YYYY-MM')=$1 ${filter}`, params,
  )).rows[0];
  const revenue = Number(kpi.revenue);
  const customers = Number(kpi.customers);
  const target = shopId
    ? Number((await query('SELECT monthly_target FROM shop WHERE id=$1', [shopId])).rows[0]?.monthly_target || 0)
    : Number((await query('SELECT COALESCE(SUM(monthly_target),0) AS t FROM shop')).rows[0]?.t || 0);
  const now = new Date();
  const [yy, mm] = period.split('-').map(Number);
  const daysInMonth = new Date(yy, mm, 0).getDate();
  const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const timeProgress = period === cur ? now.getDate() / daysInMonth : 1;
  return {
    period, shopId,
    totalRevenue: revenue, totalCustomers: customers,
    avgCustomerPrice: customers ? Number((revenue / customers).toFixed(2)) : 0,
    totalRecharge: Number(kpi.recharge),
    taskProgress: target ? Number((revenue / target).toFixed(4)) : 0,
    timeProgress: Number(timeProgress.toFixed(4)),
  };
}

async function queryDailyMetrics(args: { period?: string; shopId?: number; metricKeys?: string[] }, ctx: AiCtx) {
  const period = args.period ?? ctx.period;
  const keys = args.metricKeys || ['revenue'];
  const { filter, params } = shopFilter({ ...ctx, period }, args);
  const { rows } = await query(
    `SELECT to_char(date,'YYYY-MM-DD') AS date, metrics FROM daily_metric WHERE to_char(date,'YYYY-MM')=$1 ${filter} ORDER BY date`, params,
  );
  return rows.map((r: any) => {
    const m = r.metrics as Record<string, unknown>;
    const out: Record<string, unknown> = { date: r.date };
    for (const k of keys) out[k] = m[k] ?? null;
    return out;
  });
}

async function queryExpenses(args: { period?: string; shopId?: number; subject?: string }, ctx: AiCtx) {
  const period = args.period ?? ctx.period;
  const { shopId, filter, params } = shopFilter({ ...ctx, period }, args);
  let sql = `SELECT to_char(pay_date,'YYYY-MM-DD') AS pay_date, summary, amount, payee, subject
             FROM expense WHERE to_char(pay_date,'YYYY-MM')=$1 ${filter}`;
  const p = [...params];
  if (args.subject) { sql += ` AND subject ILIKE $${p.length + 1}`; p.push(`%${args.subject}%`); }
  sql += ' ORDER BY pay_date DESC NULLS LAST LIMIT 50';
  return (await query(sql, p)).rows.map((r: any) => ({ ...r, amount: Number(r.amount) }));
}

async function compareShops(args: { period?: string; metricKey?: string }, ctx: AiCtx) {
  const period = args.period ?? ctx.period;
  const key = args.metricKey || 'revenue';
  const { rows } = await query(
    `SELECT s.name, COALESCE(SUM((d.metrics->>$2)::numeric),0) AS value
     FROM shop s LEFT JOIN daily_metric d ON d.shop_id=s.id AND to_char(d.date,'YYYY-MM')=$1
     GROUP BY s.name ORDER BY value DESC`, [period, key],
  );
  return rows.map((r: any) => ({ shopName: r.name, value: Number(r.value) }));
}

async function getTemplate() {
  const { rows } = await query(
    `SELECT t.definition FROM template t ORDER BY t.version DESC LIMIT 1`,
  );
  const def = rows[0]?.definition as { sheets: { key: string; label: string; columns: { key: string; label: string; type: string }[] }[] } | undefined;
  if (!def) return { sheets: [] };
  return {
    sheets: def.sheets.map(s => ({ key: s.key, label: s.label, columns: s.columns.map(c => ({ key: c.key, label: c.label, type: c.type })) })),
  };
}

export async function executeTool(name: string, args: Record<string, unknown>, ctx: AiCtx): Promise<unknown> {
  switch (name) {
    case 'get_kpis': return getKpis(args as any, ctx);
    case 'query_daily_metrics': return queryDailyMetrics(args as any, ctx);
    case 'query_expenses': return queryExpenses(args as any, ctx);
    case 'compare_shops': return compareShops(args as any, ctx);
    case 'get_template': return getTemplate();
    default: return { error: `未知工具: ${name}` };
  }
}
