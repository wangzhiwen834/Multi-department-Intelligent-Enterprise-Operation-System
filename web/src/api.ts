import type { Shop, Template, Workbook, WorkbookListItem, BootstrapPayload, LockStatus, ExtractResult, User, DashboardOverview, AuditLogPage, Logo, AiSettings, AiModelKind } from './types';

const TOKEN_KEY = 'token';
// 用 sessionStorage 而非 localStorage:每个标签页独立登录,支持同一浏览器多标签页登录不同账号(隔离 token,避免互相覆盖)。代价:关闭标签页/浏览器后需重新登录。
export const getToken = () => sessionStorage.getItem(TOKEN_KEY);
export const setToken = (t: string) => sessionStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => sessionStorage.removeItem(TOKEN_KEY);

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(opts.headers as Record<string, string>) };
  const t = getToken();
  if (t) headers.Authorization = `Bearer ${t}`;
  const r = await fetch(path, { ...opts, headers, cache: 'no-store' });
  if (r.status === 401) { clearToken(); throw new Error('未登录或登录已过期'); }
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${r.status}`);
  }
  return r.status === 204 ? (undefined as T) : r.json();
}

// 锁接口的 409(锁冲突)携带业务数据({acquired:false, heldBy} / {renewed:false, heldBy}),
// 前端需读取而非当异常抛出。reqLock 对 409 返回 body,其余同 req。
async function reqLock<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(opts.headers as Record<string, string>) };
  const t = getToken();
  if (t) headers.Authorization = `Bearer ${t}`;
  const r = await fetch(path, { ...opts, headers, cache: 'no-store' });
  if (r.status === 401) { clearToken(); throw new Error('未登录或登录已过期'); }
  const body = await r.json().catch(() => ({}));
  if (r.status === 409) return body as T;
  if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
  return (r.status === 204 ? undefined : body) as T;
}

// AI 抽取走 SSE 流:逐表进度事件 onProgress 回调,末尾 done 事件的结果作为返回值。
// 流前错误(403/409/404)走 JSON,throw;流内结果(含 not_configured/llm_error)在 done 事件里返回。
export async function extractWorkbookStream(
  id: number,
  source: 'save' | 'manual',
  onProgress?: (e: { stage: string; [k: string]: unknown }) => void,
): Promise<ExtractResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const t = getToken();
  if (t) headers.Authorization = `Bearer ${t}`;
  const r = await fetch(`/api/workbooks/${id}/extract`, {
    method: 'POST', headers, body: JSON.stringify({ source }), cache: 'no-store',
  });
  if (r.status === 401) { clearToken(); throw new Error('未登录或登录已过期'); }
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${r.status}`);
  }
  if (!r.body) throw new Error('无响应流');
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: ExtractResult | null = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const line = chunk.split('\n').find(l => l.startsWith('data: '));
      if (!line) continue;
      let evt: { stage: string; result?: ExtractResult };
      try { evt = JSON.parse(line.slice(6)); } catch { continue; }
      if (evt.stage === 'done') result = evt.result ?? null;
      else onProgress?.(evt);
    }
  }
  if (!result) throw new Error('抽取未返回结果');
  return result;
}

export const api = {
  login: (username: string, password: string) =>
    req<{ token: string; user: User }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  me: () => req<User>('/api/auth/me'),
  shops: () => req<Shop[]>('/api/shops'),
  updateShopContact: (id: number, body: { address: string; phone: string }) =>
    req<Shop>(`/api/shops/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  template: (code: string) => req<Template>(`/api/templates/${code}`),
  getWorkbook: (shopId: number, period: string) =>
    req<Workbook | null>(`/api/workbooks?shopId=${shopId}&period=${period}`),
  createWorkbook: (shopId: number, period: string) =>
    req<Workbook>('/api/workbooks', { method: 'POST', body: JSON.stringify({ shopId, period }) }),
  listWorkbooks: (shopId: number) =>
    req<WorkbookListItem[]>(`/api/shops/${shopId}/workbooks`),
  copyFromWorkbook: (id: number, fromPeriod: string) =>
    req<{ ok: boolean }>(`/api/workbooks/${id}/copy-from`, { method: 'POST', body: JSON.stringify({ fromPeriod }) }),
  deleteWorkbook: (id: number) =>
    req<{ ok: boolean }>(`/api/workbooks/${id}`, { method: 'DELETE' }),
  bootstrapWorkbook: (shopId: number, period: string) =>
    req<BootstrapPayload>('/api/workbooks/bootstrap', { method: 'POST', body: JSON.stringify({ shopId, period }) }),
  getSnapshot: (id: number) =>
    req<{ data: unknown; updated_at: string } | null>(`/api/workbooks/${id}/snapshot`),
  putSnapshot: (id: number, data: unknown) =>
    req<{ ok: boolean }>(`/api/workbooks/${id}/snapshot`, { method: 'PUT', body: JSON.stringify({ data }) }),
  lockStatus: (id: number, sheetKey: string) =>
    req<LockStatus>(`/api/workbooks/${id}/locks/${sheetKey}`),
  acquireLock: (id: number, sheetKey: string) =>
    reqLock<{ acquired: boolean; lock?: unknown; heldBy?: { user_name: string } }>(`/api/workbooks/${id}/locks/${sheetKey}`, { method: 'POST' }),
  heartbeat: (id: number, sheetKey: string) =>
    reqLock<{ renewed: boolean; lock?: unknown; heldBy?: { user_name: string }; takeoverRequest?: { user_name: string } }>(`/api/workbooks/${id}/locks/${sheetKey}`, { method: 'PUT' }),
  releaseLock: (id: number, sheetKey: string) =>
    req<{ released: boolean }>(`/api/workbooks/${id}/locks/${sheetKey}`, { method: 'DELETE' }),
  takeoverLock: (id: number, sheetKey: string) =>
    reqLock<{ acquired: boolean; pending?: boolean; lock?: unknown; heldBy?: { user_name: string } }>(`/api/workbooks/${id}/locks/${sheetKey}/takeover`, { method: 'POST' }),
  yieldLock: (id: number, sheetKey: string) =>
    reqLock<{ yielded: boolean }>(`/api/workbooks/${id}/locks/${sheetKey}/yield`, { method: 'POST' }),
  extractWorkbookStream,
  extractStatus: (id: number) =>
    req<{ lastExtractedAt: string | null }>(`/api/workbooks/${id}/extract/status`),
  ledger: (shopId: number, period: string) =>
    req<{ period: string; days: { date: string; revenue: number; expense: number; running_balance: number }[] }>(`/api/shops/${shopId}/ledger?period=${period}`),
  dashboardOverview: (granularity: 'day' | 'week' | 'month' | 'year', date: string, shopId?: number) =>
    req<DashboardOverview>(`/api/dashboard/overview?granularity=${granularity}&date=${date}${shopId ? `&shopId=${shopId}` : ''}`),
  aiChat: (message: string, period: string) =>
    req<{ answer: string; configured: boolean; error?: string }>('/api/ai/chat', { method: 'POST', body: JSON.stringify({ message, period }) }),
  aiInfo: () => req<{ chatModel: string; posterModel: string; configured: boolean }>('/api/ai/info'),
  posterGenerate: (prompt: string, size?: string) =>
    req<{ image: string }>('/api/poster/generate', { method: 'POST', body: JSON.stringify({ prompt, size }) }),
  posterLogos: () => req<Logo[]>('/api/poster/logos'),
  posterUploadLogo: (image: string, originalName: string) =>
    req<Logo>('/api/poster/logos', { method: 'POST', body: JSON.stringify({ image, originalName }) }),
  posterDeleteLogo: (id: number) =>
    req<{ ok: boolean }>(`/api/poster/logos/${id}`, { method: 'DELETE' }),
  listUsers: () => req<User[]>('/api/users'),
  createUser: (b: { username: string; password: string; name: string; role: 'manager' | 'employee'; department?: string | null; phone?: string }) =>
    req<User>('/api/users', { method: 'POST', body: JSON.stringify(b) }),
  updateUser: (id: number, b: { name?: string; phone?: string; status?: 'active' | 'disabled'; department?: string | null }) =>
    req<User>(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify(b) }),
  disableUser: (id: number) =>
    req<{ ok: boolean }>(`/api/users/${id}`, { method: 'DELETE' }),
  auditLogs: (params: { page?: number; pageSize?: number; action?: string; result?: string; q?: string; from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '' && v !== null) sp.set(k, String(v));
    return req<AuditLogPage>(`/api/audit/logs?${sp.toString()}`);
  },
  getAiSettings: () => req<AiSettings>('/api/settings/ai'),
  refreshAiModels: () => req<{ ok: boolean; fetched: number }>('/api/settings/ai/models/refresh', { method: 'POST' }),
  addAiModel: (b: { model_id: string; label: string; kind: AiModelKind }) =>
    req<{ ok: boolean }>('/api/settings/ai/models', { method: 'POST', body: JSON.stringify(b) }),
  delAiModel: (id: number) => req<{ ok: boolean }>(`/api/settings/ai/models/${id}`, { method: 'DELETE' }),
  assignAiFeature: (feature: 'chat' | 'poster' | 'extraction', model_id: string) =>
    req<{ ok: boolean }>(`/api/settings/ai/features/${feature}`, { method: 'PUT', body: JSON.stringify({ model_id }) }),
};
