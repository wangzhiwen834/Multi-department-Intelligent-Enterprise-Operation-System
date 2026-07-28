// 禧悦国际月子会所业务模板(v1)
// 经营报表(行式:日期作行)+ 收入对账/费用明细(沿用足浴)
// 经营报表取标签唯一的列:收款项(押金/意向金/定金/尾款/产康/收现合计)+ 退款项 + 占用套数/入住率
// 月子房预定/房态的房型列(典雅/轻奢/舒适... 在预定与房态两组重复,标签歧义)不纳入

export const YUEZI_BUSINESS_CODE = 'yuezi';

export const yueziTemplate = {
  sheets: [
    {
      key: 'daily_ops',
      label: '经营报表',
      layout: 'row_per_day',
      grain: 'per_day',
      deterministic: true,
      columns: [
        { key: 'date', label: '日期', type: 'date', kind: 'entry' },
        // 收款项
        { key: 'deposit', label: '押金', type: 'number', kind: 'entry' },
        { key: 'intent_deposit', label: '意向金', type: 'number', kind: 'entry' },
        { key: 'down_payment', label: '定金', type: 'number', kind: 'entry' },
        { key: 'balance', label: '尾款', type: 'number', kind: 'entry' },
        { key: 'xiyue_home', label: '禧悦到家', type: 'number', kind: 'entry' },
        { key: 'chankang_sales', label: '产康销售额', type: 'number', kind: 'entry' },
        { key: 'other_goods', label: '其他商品', type: 'number', kind: 'entry' },
        { key: 'renew_balance', label: '续住/补尾款', type: 'number', kind: 'entry' },
        { key: 'accompany_fee', label: '陪产费用', type: 'number', kind: 'entry' },
        { key: 'cash_total', label: '收现合计', type: 'number', kind: 'entry' },
        // 退款项
        { key: 'refund_total', label: '退款合计', type: 'number', kind: 'entry' },
        { key: 'refund_deposit', label: '退押金', type: 'number', kind: 'entry' },
        { key: 'other_refund', label: '其他退款', type: 'number', kind: 'entry' },
        { key: 'refund_package', label: '退套餐款', type: 'number', kind: 'entry' },
        { key: 'chankang_refund', label: '产康退款', type: 'number', kind: 'entry' },
        // 房态
        { key: 'occupied_rooms', label: '占用套数', type: 'int', kind: 'entry' },
        { key: 'occupancy_rate', label: '入住率', type: 'number', kind: 'manual_derived' },
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
