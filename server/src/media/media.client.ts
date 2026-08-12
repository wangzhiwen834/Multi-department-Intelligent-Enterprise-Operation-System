import { config } from '../config.js';

/**
 * 媒体发布微服务客户端
 * 调用 Python Playwright 微服务 (media-publisher)
 */

const BASE_URL = config.mediaServiceUrl.replace(/\/$/, '');

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> ?? {}),
  };
  if (config.mediaApiKey) {
    headers['X-API-Key'] = config.mediaApiKey;
  }

  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, { ...opts, headers });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = (body as { msg?: string }).msg || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return body as T;
}

/**
 * 平台
 */
export interface MediaPlatform {
  type: number;
  key: string;
  name: string;
  features: Record<string, boolean>;
}

export function getPlatforms(): Promise<{ code: number; msg: string; data: MediaPlatform[] }> {
  return request('/platforms');
}

/**
 * 账号
 */
export interface MediaAccount {
  id: number;
  type: number;
  filePath: string;
  userName: string;
  status: number; // 0=失效 1=有效
}

export function getAccounts(): Promise<{ code: number; msg: string; data: MediaAccount[] }> {
  return request('/accounts');
}

export function getValidAccounts(type?: number): Promise<{ code: number; msg: string; data: MediaAccount[] }> {
  const qs = type ? `?type=${type}` : '';
  return request(`/accounts/valid${qs}`);
}

export function verifyAccount(id: number): Promise<{ code: number; msg: string; data: { id: number; valid: boolean; status: number } }> {
  return request(`/accounts/${id}/verify`, { method: 'POST' });
}

export function deleteAccount(id: number): Promise<{ code: number; msg: string; data: null }> {
  return request(`/accounts/${id}`, { method: 'DELETE' });
}

/**
 * SSE 登录流
 * 返回 web ReadableStream，路由层需用 Readable.fromWeb() 转成 Node stream
 */
export function getLoginStream(type: number, id: string): Promise<any> {
  return new Promise(async (resolve, reject) => {
    try {
      const url = `${BASE_URL}/login/stream?type=${type}&id=${encodeURIComponent(id)}`;
      const headers: Record<string, string> = {};
      if (config.mediaApiKey) headers['X-API-Key'] = config.mediaApiKey;

      const res = await fetch(url, { headers });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        reject(new Error((body as { msg?: string }).msg || `HTTP ${res.status}`));
        return;
      }
      // res.body 是 web ReadableStream，Node.js 中可直接 pipe
      resolve(res.body as unknown as NodeJS.ReadableStream);
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * 素材文件
 */
export interface MediaFile {
  id: number;
  filename: string;
  filesize: number; // MB
  upload_time: string;
  file_path: string;
  url: string;
}

export function getFiles(): Promise<{ code: number; msg: string; data: MediaFile[] }> {
  return request('/files');
}

export function deleteFile(id: number): Promise<{ code: number; msg: string; data: null }> {
  return request(`/files/${id}`, { method: 'DELETE' });
}

/**
 * 发布任务
 */
export interface MediaPublishTask {
  id: number;
  task_id: string;
  filename: string;
  file_id: number | null;
  account_id: number | string;
  account_name: string;
  platform_name: string;
  platform_type: number;
  status: string;
  create_time: string;
  update_time: string;
  error_msg: string | null;
}

export interface PublishTaskPage {
  records: MediaPublishTask[];
  total: number;
  page: number;
  pageSize: number;
}

export function getTasks(params: {
  page?: number;
  page_size?: number;
  status?: string;
  platform_name?: string;
  account_name?: string;
  filename?: string;
}): Promise<{ code: number; msg: string; data: PublishTaskPage }> {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '' && v !== null) sp.set(k, String(v));
  }
  return request(`/tasks?${sp.toString()}`);
}

export function cancelTask(id: number): Promise<{ code: number; msg: string; data: null }> {
  return request(`/tasks/${id}/cancel`, { method: 'POST' });
}

export function retryTask(id: number): Promise<{ code: number; msg: string; data: null }> {
  return request(`/tasks/${id}/retry`, { method: 'POST' });
}

export function deleteTask(id: number): Promise<{ code: number; msg: string; data: null }> {
  return request(`/tasks/${id}`, { method: 'DELETE' });
}

/**
 * 发布
 */
export interface PublishSingleParams {
  type: number;
  accountList: Array<{ filePath: string; userName: string } | string>;
  fileType: number; // 1=图文 2=视频
  fileList: Array<{ fileName: string } | string>;
  title?: string;
  text?: string;
  tags?: string;
  thumbnail?: string;
  location?: number;
  enableTimer?: number;
  videosPerDay?: number;
  dailyTimes?: string[];
  startDays?: number;
}

export function publishSingle(params: PublishSingleParams): Promise<{ code: number; msg: string; data: { task_id: string; status: string } }> {
  return request('/publish/single', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export interface PublishBatchParams {
  platforms: string[];
  accountFiles: Record<string, string[]>;
  fileType: number;
  files: string[];
  title?: string;
  text?: string;
  tags?: string;
  thumbnail?: string;
  location?: number;
  enableTimer?: number;
  videosPerDay?: number;
  dailyTimes?: string[];
  startDays?: number;
}

export function publishBatch(params: PublishBatchParams): Promise<{ code: number; msg: string; data: { task_id: string; result: unknown; status: string } }> {
  return request('/publish/batch', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * 登录命令（交互）
 */
export function sendLoginCommand(params: {
  id: string;
  action: string;
  x?: number;
  y?: number;
  text?: string;
  key?: string;
  url?: string;
}): Promise<{ code: number; msg: string; data: unknown }> {
  return request('/login/command', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * 统计
 */
export function getPlatformStats(): Promise<{ code: number; msg: string; data: unknown }> {
  return request('/stats/platform');
}

export function getFileStats(): Promise<{ code: number; msg: string; data: unknown }> {
  return request('/stats/file');
}
