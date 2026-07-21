export interface TemplateColumn { key: string; label: string; type: string; kind: string }
export interface TemplateSheet { key: string; label: string; layout?: string; grain?: string; columns: TemplateColumn[] }
export interface TemplateDef { sheets: TemplateSheet[] }
export interface Template { id: number; business_code: string; version: number; definition: TemplateDef }

export interface Shop {
  id: number; code: string; name: string; status: string;
  business_code: string; business_name: string;
  address: string | null;
  phone: string | null;
}

// 企业 logo(全局共享,海报素材)
export interface Logo {
  id: number;
  filename: string;
  original_name: string;
  mime: string;
  size: number;
  url: string;
  created_at: string;
}
export interface Workbook { id: number; shop_id: number; period: string; template_version: number; status: string }

export interface WorkbookListItem {
  id: number; shop_id: number; period: string; template_version: number;
  status: string; updated_at: string; lockedBy: string | null;
}

export interface BootstrapPayload {
  wbId: number;
  template: Template;
  snapshot: { data: any; updated_at: string } | null;
  lockStatus: LockStatus;
}

export interface LockStatus {
  user_id?: number; user_name?: string; expires_at?: string; acquired_at?: string; held?: boolean;
}
export interface SyncError { sheetKey: string; date: string; key: string; msg: string }
export interface ExtractResult {
  ok: boolean;
  configured?: boolean;                              // false = AI 未配置
  extracted: { dailyMetrics: number; expenses: number };
  errors: SyncError[];
  sheets?: { key: string; rowsIn: number; rowsOut: number }[];
  error?: string;
}
export interface User { id: number; username: string; name: string; role: string; department: string | null; phone?: string; status?: 'active' | 'disabled'; created_at?: string; }

export interface AuditLogEntry {
  id: number;
  user_id: number | null;
  user_name: string | null;
  ip: string;
  action: string;
  target: string | null;
  detail: Record<string, unknown>;
  result: 'success' | 'failed' | string;
  created_at: string;
}
export interface AuditLogPage { items: AuditLogEntry[]; total: number; page: number; pageSize: number }

export interface DashboardOverview {
  granularity: 'day' | 'week' | 'month' | 'year';
  date: string;            // YYYY-MM-DD(请求的锚点日)
  rangeStart: string;      // YYYY-MM-DD
  rangeEnd: string;        // YYYY-MM-DD
  shopId: number | null;
  kpis: {
    revenue: number;             // 营业收入 Σ
    customersTotal: number;      // 总客流 Σ
    avgCustomerPrice: number;    // Σrevenue/Σcustomers 重算
    rechargeTotal: number;       // 充值总额 Σ
    totalClocks: number;         // 总钟数 Σ
    newMembers: number;          // 新增会员 Σ
    therapistAttendance: number; // 技师出勤(人天)Σ
    therapistWage: number;       // 技师工资 Σ
    memberConsume: number;       // 会员消费 Σ
  };
  revenueTrend: { label: string; revenue: number }[];
  customerStructure: { member: number; group: number; walkin: number };
  clockStructure: { arranged: number; requested: number; added: number };
  rechargeStructure: { first: number; renew: number; gift: number };
  businessStructure: { footbath: number; spa: number; minor: number };
  paymentChannels: { cash: number; douyin: number; meituan: number; pos: number; alipay: number; wechat: number };
  expenseBySubject: { subject: string; amount: number }[];
  shopRanking: { shopId: number; shopName: string; revenue: number }[];
}
