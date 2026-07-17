export interface TemplateColumn { key: string; label: string; type: string; kind: string }
export interface TemplateSheet { key: string; label: string; layout?: string; grain?: string; columns: TemplateColumn[] }
export interface TemplateDef { sheets: TemplateSheet[] }
export interface Template { id: number; business_code: string; version: number; definition: TemplateDef }

export interface Shop {
  id: number; code: string; name: string; status: string;
  business_code: string; business_name: string;
}
export interface Workbook { id: number; shop_id: number; period: string; template_version: number; status: string }

export interface LockStatus {
  user_id?: number; user_name?: string; expires_at?: string; acquired_at?: string; held?: boolean;
}
export interface SyncError { sheetKey: string; date: string; key: string; msg: string }
export interface SyncResult { autoSums: Record<string, Record<string, number>>; errors: SyncError[] }
export interface User { id: number; username: string; name: string; role: string; department: string | null }
