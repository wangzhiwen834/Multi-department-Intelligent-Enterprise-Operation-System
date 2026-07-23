// 汉庭酒店业务模板(v1)
// 三张表:经营报表(转置,照搬 Excel「酒店运营」表)/收入对账(沿用足浴)/费用明细(沿用足浴)
// 加指标 = 在对应 columns 加一行,不改代码

export const HOTEL_BUSINESS_CODE = 'hotel';

export const hotelTemplate = {
  sheets: [
    {
      key: 'daily_ops',
      label: '经营报表',
      layout: 'transposed',
      grain: 'per_day',
      columns: [
        { key: 'date', label: '日期', type: 'date', kind: 'entry' },
        { key: 'hotel_revenue', label: '酒店营业收入', type: 'number', kind: 'entry' },
        { key: 'daily_cash_total', label: '日收银总额', type: 'number', kind: 'entry' },
        { key: 'room_revenue', label: '客房收入', type: 'number', kind: 'entry' },
        { key: 'breakfast_revenue', label: '餐券收入', type: 'number', kind: 'entry' },
        { key: 'guest_damage_revenue', label: '客损收入', type: 'number', kind: 'entry' },
        { key: 'member_benefit', label: '会员权益', type: 'number', kind: 'entry' },
        { key: 'other_revenue', label: '其他收入', type: 'number', kind: 'entry' },
        { key: 'offline_room_revenue', label: '线下房收入', type: 'number', kind: 'entry' },
        { key: 'overnight_rooms', label: '过夜间数', type: 'int', kind: 'entry' },
        { key: 'non_hourly_rooms', label: '非时租', type: 'int', kind: 'entry' },
        { key: 'hourly_rooms', label: '时租', type: 'int', kind: 'entry' },
        { key: 'cleaned_rooms', label: '清扫间数', type: 'int', kind: 'entry' },
        { key: 'big_bed_rooms', label: '大床房', type: 'int', kind: 'entry' },
        { key: 'suite_rooms', label: '套房', type: 'int', kind: 'entry' },
        { key: 'family_rooms', label: '家庭房', type: 'int', kind: 'entry' },
        { key: 'superior_big_bed_rooms', label: '高级大床房', type: 'int', kind: 'entry' },
        { key: 'business_big_bed_rooms', label: '商务大床房', type: 'int', kind: 'entry' },
        { key: 'superior_twin_rooms', label: '高级双床房', type: 'int', kind: 'entry' },
        { key: 'business_twin_rooms', label: '商务双床房', type: 'int', kind: 'entry' },
        { key: 'meituan_rooms', label: '美团(间)', type: 'int', kind: 'entry' },
        { key: 'ctrip_rooms', label: '携程(间)', type: 'int', kind: 'entry' },
        { key: 'huazhu_rooms', label: '华住(间)', type: 'int', kind: 'entry' },
        { key: 'selfuse_rooms', label: '自用/免费房(间)', type: 'int', kind: 'entry' },
        { key: 'walkin_guests', label: '自然客流', type: 'int', kind: 'entry' },
        { key: 'adr', label: 'ADR均房价', type: 'number', kind: 'manual_derived' },
        { key: 'occupancy', label: 'OCC入住率', type: 'number', kind: 'manual_derived' },
        { key: 'revpar', label: 'REVPAR', type: 'number', kind: 'manual_derived' },
        { key: 'online_ratio', label: '网销占比', type: 'number', kind: 'manual_derived' },
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
