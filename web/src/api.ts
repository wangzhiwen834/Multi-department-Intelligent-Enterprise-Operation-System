import type { Shop, Template, Workbook, LockStatus, SyncResult, User, DashboardOverview } from './types';

const TOKEN_KEY = 'token';
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(opts.headers as Record<string, string>) };
  const t = getToken();
  if (t) headers.Authorization = `Bearer ${t}`;
  const r = await fetch(path, { ...opts, headers });
  if (r.status === 401) { clearToken(); throw new Error('未登录或登录已过期'); }
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${r.status}`);
  }
  return r.status === 204 ? (undefined as T) : r.json();
}

export const api = {
  login: (username: string, password: string) =>
    req<{ token: string; user: User }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  me: () => req<User>('/api/auth/me'),
  shops: () => req<Shop[]>('/api/shops'),
  template: (code: string) => req<Template>(`/api/templates/${code}`),
  getWorkbook: (shopId: number, period: string) =>
    req<Workbook | null>(`/api/workbooks?shopId=${shopId}&period=${period}`),
  createWorkbook: (shopId: number, period: string) =>
    req<Workbook>('/api/workbooks', { method: 'POST', body: JSON.stringify({ shopId, period }) }),
  getSnapshot: (id: number) =>
    req<{ data: unknown; updated_at: string } | null>(`/api/workbooks/${id}/snapshot`),
  putSnapshot: (id: number, data: unknown) =>
    req<{ ok: boolean }>(`/api/workbooks/${id}/snapshot`, { method: 'PUT', body: JSON.stringify({ data }) }),
  lockStatus: (id: number, sheetKey: string) =>
    req<LockStatus>(`/api/workbooks/${id}/locks/${sheetKey}`),
  acquireLock: (id: number, sheetKey: string) =>
    req<{ acquired: boolean; lock?: unknown; heldBy?: { user_name: string } }>(`/api/workbooks/${id}/locks/${sheetKey}`, { method: 'POST' }),
  heartbeat: (id: number, sheetKey: string) =>
    req<{ renewed: boolean }>(`/api/workbooks/${id}/locks/${sheetKey}`, { method: 'PUT' }),
  releaseLock: (id: number, sheetKey: string) =>
    req<{ released: boolean }>(`/api/workbooks/${id}/locks/${sheetKey}`, { method: 'DELETE' }),
  takeoverLock: (id: number, sheetKey: string) =>
    req<{ acquired: boolean; lock?: unknown; heldBy?: { user_name: string } }>(`/api/workbooks/${id}/locks/${sheetKey}/takeover`, { method: 'POST' }),
  sync: (id: number, body: { dailyMetrics: unknown[]; expenses: unknown[] }) =>
    req<SyncResult>(`/api/workbooks/${id}/sync`, { method: 'POST', body: JSON.stringify(body) }),
  ledger: (shopId: number, period: string) =>
    req<{ period: string; days: { date: string; revenue: number; expense: number; running_balance: number }[] }>(`/api/shops/${shopId}/ledger?period=${period}`),
  dashboardOverview: (period: string, shopId?: number) =>
    req<DashboardOverview>(`/api/dashboard/overview?period=${period}${shopId ? `&shopId=${shopId}` : ''}`),
  aiChat: (message: string, period: string) =>
    req<{ answer: string; configured: boolean; error?: string }>('/api/ai/chat', { method: 'POST', body: JSON.stringify({ message, period }) }),
  posterGenerate: (prompt: string, size?: string) =>
    req<{ image: string }>('/api/poster/generate', { method: 'POST', body: JSON.stringify({ prompt, size }) }),
};
