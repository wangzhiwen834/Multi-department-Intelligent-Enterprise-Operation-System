// 禧悦健康调理馆业务模板(v1)
// 经营报表(行式:日期作行)+ 收入对账/费用明细(沿用足浴)
// 经营报表只取标签唯一的列:收款合计/退款合计 + 17 个服务项目(次卡/泳裤/.../卡)
// 支付渠道明细列(收单/现金/抖音/美团 跨业务线重复,标签歧义)不纳入,后续如需再细化

export const TIAOLI_BUSINESS_CODE = 'tiaoli';

export const tiaoliTemplate = {
  sheets: [
    {
      key: 'daily_ops',
      label: '经营报表',
      layout: 'row_per_day',
      grain: 'per_day',
      deterministic: true,
      columns: [
        { key: 'date', label: '日期', type: 'date', kind: 'entry' },
        { key: 'total_receipt', label: '收款合计', type: 'number', kind: 'entry' },
        { key: 'refund_total', label: '退款合计', type: 'number', kind: 'entry' },
        // 禧SPA儿童 项目销售
        { key: 'cika', label: '次卡', type: 'number', kind: 'entry' },
        { key: 'swimwear', label: '泳裤', type: 'number', kind: 'entry' },
        { key: 'swimming', label: '游泳项目', type: 'number', kind: 'entry' },
        { key: 'baby_herbal', label: '婴儿草本', type: 'number', kind: 'entry' },
        { key: 'haircut', label: '理发', type: 'number', kind: 'entry' },
        { key: 'diaper', label: '纸尿裤', type: 'number', kind: 'entry' },
        { key: 'other_goods', label: '其他商品', type: 'number', kind: 'entry' },
        // 悦SPA产康调理 项目销售
        { key: 'birth_checkup', label: '产道体检', type: 'number', kind: 'entry' },
        { key: 'bone_conditioning', label: '骨态调理', type: 'number', kind: 'entry' },
        { key: 'skin_care', label: '皮肤护理', type: 'number', kind: 'entry' },
        { key: 'postpartum_rehab', label: '产后康复', type: 'number', kind: 'entry' },
        { key: 'assistive_device', label: '辅助器材', type: 'number', kind: 'entry' },
        { key: 'fat_loss', label: '减脂', type: 'number', kind: 'entry' },
        { key: 'head_therapy', label: '头疗', type: 'number', kind: 'entry' },
        { key: 'fahan', label: '发汉', type: 'number', kind: 'entry' },
        { key: 'lactation', label: '开乳', type: 'number', kind: 'entry' },
        { key: 'card', label: '卡', type: 'number', kind: 'entry' },
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
