// 足浴业务模板定义(v1)
// 三张录入表:经营报表(转置)/收入对账(一行一天)/费用明细(一笔一行)
// kind: entry=人工录入 | manual_derived=人工填派生值(客单价等)
// 合计(月合计)由后端按 entry 指标求和自动算,前端展示;不在此声明单独列
// 加指标 = 在对应 columns 加一行,不改代码

export const FOOTBATH_BUSINESS_CODE = 'footbath';

export const FOOTBATH_SHOPS = [
  { code: 'dahekang', name: '大河坎店' },
  { code: 'jiangbei', name: '江北店' },
  { code: 'hantai', name: '汉台店' },
  { code: 'nanzheng', name: '南郑店' },
  { code: 'chenggu', name: '城固店' },
];

export const footbathTemplate = {
  sheets: [
    {
      key: 'daily_ops',
      label: '经营报表',
      layout: 'transposed', // 日期作列、指标作行
      grain: 'per_day',
      columns: [
        { key: 'date', label: '日期', type: 'date', kind: 'entry' },
        { key: 'revenue', label: '营业收入', type: 'number', kind: 'entry' },
        { key: 'cash_revenue', label: '现金收入', type: 'number', kind: 'entry' },
        { key: 'customers_total', label: '总客流', type: 'int', kind: 'entry' },
        { key: 'customers_member', label: '会员客流', type: 'int', kind: 'entry' },
        { key: 'customers_group', label: '团购客流', type: 'int', kind: 'entry' },
        { key: 'customers_walkin', label: '散客流', type: 'int', kind: 'entry' },
        { key: 'new_members', label: '新增会员', type: 'int', kind: 'entry' },
        { key: 'recharge_total', label: '充值总额', type: 'number', kind: 'entry' },
        { key: 'recharge_first', label: '充值首充', type: 'number', kind: 'entry' },
        { key: 'recharge_renew', label: '充值续充', type: 'number', kind: 'entry' },
        { key: 'recharge_gift', label: '充值赠送', type: 'number', kind: 'entry' },
        { key: 'member_consume', label: '会员消费', type: 'number', kind: 'entry' },
        { key: 'therapist_wage', label: '技师工资', type: 'number', kind: 'entry' },
        { key: 'therapist_attendance', label: '技师出勤', type: 'int', kind: 'entry' },
        { key: 'total_clocks', label: '总钟数', type: 'int', kind: 'entry' },
        { key: 'clocks_arranged', label: '排钟', type: 'int', kind: 'entry' },
        { key: 'clocks_requested', label: '点钟', type: 'int', kind: 'entry' },
        { key: 'clocks_added', label: '加钟', type: 'int', kind: 'entry' },
        { key: 'footbath_revenue', label: '足浴业务收入', type: 'number', kind: 'entry' },
        { key: 'spa_revenue', label: 'SPA业务收入', type: 'number', kind: 'entry' },
        { key: 'minor_revenue', label: '小项业务收入', type: 'number', kind: 'entry' },
        { key: 'customer_price', label: '客单价', type: 'number', kind: 'manual_derived' },
      ],
    },
    {
      key: 'reconciliation',
      label: '收入对账',
      layout: 'row_per_day',
      grain: 'per_day',
      columns: [
        { key: 'date', label: '日期', type: 'date', kind: 'entry' },
        { key: 'total_receipt', label: '总收款', type: 'number', kind: 'entry' },
        { key: 'cash', label: '现金', type: 'number', kind: 'entry' },
        { key: 'douyin', label: '抖音', type: 'number', kind: 'entry' },
        { key: 'meituan', label: '美团', type: 'number', kind: 'entry' },
        { key: 'pos', label: 'POS', type: 'number', kind: 'entry' },
        { key: 'alipay', label: '支付宝', type: 'number', kind: 'entry' },
        { key: 'wechat', label: '微信', type: 'number', kind: 'entry' },
        { key: 'mofang_revenue', label: '摩方营收', type: 'number', kind: 'entry' },
        { key: 'mofang_diff', label: '对账差额', type: 'number', kind: 'manual_derived' },
      ],
    },
    {
      key: 'expense',
      label: '费用明细',
      layout: 'row_per_transaction',
      grain: 'per_transaction',
      columns: [
        { key: 'pay_date', label: '付款日期', type: 'date', kind: 'entry' },
        { key: 'attribution_month', label: '费用归属月', type: 'text', kind: 'entry' },
        { key: 'summary', label: '摘要', type: 'text', kind: 'entry' },
        { key: 'amount', label: '金额', type: 'number', kind: 'entry' },
        { key: 'payee', label: '收款人', type: 'text', kind: 'entry' },
        { key: 'subject', label: '科目', type: 'text', kind: 'entry' },
      ],
    },
  ],
};
