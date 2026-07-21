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
export interface SyncResult { autoSums: Record<string, Record<string, number>>; errors: SyncError[] }
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
  period: string; shopId: number | null;
  kpis: { totalRevenue: number; totalCustomers: number; avgCustomerPrice: number; totalRecharge: number };
  taskProgress: number; timeProgress: number;
  revenueTrend: { date: string; revenue: number }[];
  shopRanking: { shopId: number; shopName: string; revenue: number; target: number; taskProgress: number }[];
  businessStructure: { footbath: number; spa: number; minor: number };
  paymentChannels: { cash: number; douyin: number; meituan: number; pos: number; alipay: number; wechat: number };
  expenseBySubject: { subject: string; amount: number }[];
}
