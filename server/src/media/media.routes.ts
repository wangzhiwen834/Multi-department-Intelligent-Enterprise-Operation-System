import { Router } from 'express';
import { z } from 'zod';
import { Readable } from 'node:stream';
import { authRequired } from '../auth/auth.middleware.js';
import { auditLog } from '../audit/audit.middleware.js';
import {
  getPlatforms,
  getAccounts,
  getValidAccounts,
  verifyAccount,
  deleteAccount,
  getLoginStream,
  getFiles,
  deleteFile,
  getTasks,
  cancelTask,
  retryTask,
  deleteTask,
  publishSingle,
  publishBatch,
  getPlatformStats,
  getFileStats,
} from './media.client.js';

export const mediaRouter = Router();
mediaRouter.use(authRequired);

// ==================== 平台 ====================

// GET /api/media/platforms
mediaRouter.get('/media/platforms', async (_req, res, next) => {
  try {
    const r = await getPlatforms();
    res.json(r.data);
  } catch (e) { next(e); }
});

// ==================== 账号 ====================

// GET /api/media/accounts
mediaRouter.get('/media/accounts', async (req, res, next) => {
  try {
    const valid = req.query.valid === '1';
    const type = req.query.type ? Number(req.query.type) : undefined;
    const r = valid ? await getValidAccounts(type) : await getAccounts();
    res.json(r.data);
  } catch (e) { next(e); }
});

// POST /api/media/accounts/:id/verify
mediaRouter.post('/media/accounts/:id/verify', auditLog('media.account.verify'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: '无效 id' });
    const r = await verifyAccount(id);
    res.json(r.data);
  } catch (e) { next(e); }
});

// DELETE /api/media/accounts/:id
mediaRouter.delete('/media/accounts/:id', auditLog('media.account.delete'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: '无效 id' });
    const r = await deleteAccount(id);
    res.json(r.data ?? { ok: true });
  } catch (e) { next(e); }
});

// ==================== SSE 登录流 ====================

// GET /api/media/login/stream?type=1&id=xxx
mediaRouter.get('/media/login/stream', async (req, res, next) => {
  try {
    const type = Number(req.query.type);
    const id = String(req.query.id || '');
    if (!type || !id) return res.status(400).json({ error: '缺少 type 或 id 参数' });

    const webStream = await getLoginStream(type, id);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    // web ReadableStream -> Node.js Readable -> pipe to response
    const nodeStream = Readable.fromWeb(webStream as any);
    nodeStream.pipe(res);
  } catch (e) { next(e); }
});

// ==================== 素材文件 ====================

// GET /api/media/files
mediaRouter.get('/media/files', async (_req, res, next) => {
  try {
    const r = await getFiles();
    // 重写 url，让文件走 Node.js 端的静态服务（Python 端的文件由 Node 代理访问）
    const files = r.data.map(f => ({
      ...f,
      url: `/api/media/files/preview/${f.file_path}`,
    }));
    res.json(files);
  } catch (e) { next(e); }
});

// 代理文件预览（从 Python 微服务拉取文件流转发给前端）
// 注意: 此路由不带 authRequired——<img>/<video> 标签不携带 Bearer token,
// 需公开访问(与 poster logos 的公开静态资源模式一致)。
export const mediaPreviewHandler = async (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
  console.log('[mediaPreview] hit:', req.originalUrl);
  try {
    // app.use('/api/media/files/preview', handler) 挂载后,文件名在 req.url 中(去掉前置 '/' 和 query)
    const pathPart = req.url.split('?')[0].replace(/^\/+/, '');
    const filePath = decodeURIComponent(pathPart);
    if (!filePath) return res.status(400).json({ error: '缺少文件名' });
    // 从 Python 微服务获取文件并转发
    const { config } = await import('../config.js');
    const baseUrl = config.mediaServiceUrl.replace(/\/$/, '');
    const url = `${baseUrl}/files/preview/${encodeURIComponent(filePath)}`;
    const headers: Record<string, string> = {};
    if (config.mediaApiKey) headers['X-API-Key'] = config.mediaApiKey;

    const resp = await fetch(url, { headers });
    if (!resp.ok) return res.status(resp.status).json({ error: '文件不存在' });
    const contentType = resp.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    // 允许跨域(前端 <img src> 加载非同源/同源均可; 这里同源无需 CORS,保留以备后用)
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const buf = Buffer.from(await resp.arrayBuffer());
    res.send(buf);
  } catch (e) { next(e); }
};

// DELETE /api/media/files/:id
mediaRouter.delete('/media/files/:id', auditLog('media.file.delete'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: '无效 id' });
    const r = await deleteFile(id);
    res.json(r.data ?? { ok: true });
  } catch (e) { next(e); }
});

// ==================== 上传文件 ====================
// 接收前端上传的文件，转发给 Python 微服务
// 使用 multipart/form-data 上传，Python 端也是同样的接口

const UploadBody = z.object({
  filename: z.string().optional(),
});

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from '../config.js';

const mediaUploadDir = path.join(config.uploadsDir, 'media-files');
mkdir(mediaUploadDir, { recursive: true }).catch(() => {});

// 用 multer 或直接读 raw body? 项目之前用 base64 dataURL 方式传文件(如 poster)
// 但视频文件可能很大，base64 不实际。我们用 multipart/form-data。
// 项目没有 multer 依赖，直接用 busboy 或原生解析。
// 为简单起见，先用 base64 dataURL（项目已有模式），后续再优化。
// 实际上视频文件可能很大(100MB+)，base64 不现实。
// 我们引入 multer 吧，这是 Node 生态标准。

// 先检查是否已安装 multer
// 未安装的话，我们用原生方式解析 multipart/form-data
// 或者简单点: Node.js 端接收文件存本地，然后给 Python 传文件路径
// 但 Python 和 Node.js 在同一台机器上，直接共享文件系统最快!

// 方案: Node 接收文件 -> 存在 uploads/media-files/ -> 把文件路径告诉 Python
// Python 端需要能访问到这个目录。我们在 conf.py 中将 UPLOAD_DIR 指向同一个目录
// 但为了简化初期实现，我们还是走 HTTP 代理: 直接用 request 代理上传请求

// 考虑到复杂度，先实现一个简化版: Node 端接收文件(使用 multer)，保存到本地，
// 然后通知 Python 文件路径。但 Python 也需要能读到这个文件。
// 最快的方式: 直接把上传请求代理到 Python 微服务。

// 为了不引入新依赖，我们用流式代理:
mediaRouter.post('/media/files/upload', auditLog('media.file.upload'), async (req, res, next) => {
  try {
    const baseUrl = config.mediaServiceUrl.replace(/\/$/, '');
    const url = `${baseUrl}/files/upload`;

    // 构造转发: 读取请求体并代理
    // 由于 express.json() 已解析过 body... 不，这条路由在 express.json 之后，
    // 但 multipart/form-data 不会被 express.json 解析，所以 raw body 还在。
    // 实际上 express.json() 只解析 content-type: application/json
    // 对于 multipart/form-data，我们需要流式转发。

    // 简单方案: 用 fetch + Request，从 req 读取 body
    const headers = new Headers();
    const contentType = req.headers['content-type'];
    if (contentType) headers.set('Content-Type', contentType);
    if (config.mediaApiKey) headers.set('X-API-Key', config.mediaApiKey);

    // 从 Readable 流构建 body
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.from(chunk));
    }
    const body = Buffer.concat(chunks);

    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body,
    });
    const data = await resp.json();
    if (!resp.ok) {
      return res.status(resp.status).json({ error: (data as { msg?: string }).msg || '上传失败' });
    }
    // 重写 url
    const result = (data as { code: number; data: { filepath: string; url: string } }).data;
    if (result) {
      result.url = `/api/media/files/preview/${result.filepath}`;
    }
    res.json(result);
  } catch (e) { next(e); }
});

// ==================== 发布任务记录 ====================

// GET /api/media/tasks
mediaRouter.get('/media/tasks', async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const page_size = Number(req.query.page_size) || 10;
    const status = req.query.status as string | undefined;
    const platform_name = req.query.platform_name as string | undefined;
    const account_name = req.query.account_name as string | undefined;
    const filename = req.query.filename as string | undefined;

    const r = await getTasks({ page, page_size, status, platform_name, account_name, filename });
    res.json(r.data);
  } catch (e) { next(e); }
});

// POST /api/media/tasks/:id/cancel
mediaRouter.post('/media/tasks/:id/cancel', auditLog('media.task.cancel'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: '无效 id' });
    const r = await cancelTask(id);
    res.json(r.data ?? { ok: true });
  } catch (e) { next(e); }
});

// POST /api/media/tasks/:id/retry
mediaRouter.post('/media/tasks/:id/retry', auditLog('media.task.retry'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: '无效 id' });
    const r = await retryTask(id);
    res.json(r.data ?? { ok: true });
  } catch (e) { next(e); }
});

// DELETE /api/media/tasks/:id
mediaRouter.delete('/media/tasks/:id', auditLog('media.task.delete'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: '无效 id' });
    const r = await deleteTask(id);
    res.json(r.data ?? { ok: true });
  } catch (e) { next(e); }
});

// ==================== 发布 ====================

const PublishSingleSchema = z.object({
  type: z.number(),
  accountList: z.array(z.any()),
  fileType: z.number().default(2),
  fileList: z.array(z.any()),
  title: z.string().optional(),
  text: z.string().optional(),
  tags: z.string().optional(),
  thumbnail: z.string().optional(),
  location: z.number().optional(),
  enableTimer: z.number().optional(),
  videosPerDay: z.number().optional(),
  dailyTimes: z.array(z.string()).optional(),
  startDays: z.number().optional(),
});

// POST /api/media/publish/single
mediaRouter.post('/media/publish/single', auditLog('media.publish.single'), async (req, res, next) => {
  try {
    const params = PublishSingleSchema.parse(req.body);
    const r = await publishSingle(params);
    res.json(r.data);
  } catch (e) {
    // 透传 Python 微服务的真实错误信息(而非统一吞成 'internal'),便于用户诊断发布失败原因
    const msg = (e as Error).message || '发布失败';
    res.status(500).json({ error: msg });
  }
});

const PublishBatchSchema = z.object({
  platforms: z.array(z.string()),
  accountFiles: z.record(z.array(z.string())),
  fileType: z.number().default(2),
  files: z.array(z.string()),
  title: z.string().optional(),
  text: z.string().optional(),
  tags: z.string().optional(),
  thumbnail: z.string().optional(),
  location: z.number().optional(),
  enableTimer: z.number().optional(),
  videosPerDay: z.number().optional(),
  dailyTimes: z.array(z.string()).optional(),
  startDays: z.number().optional(),
});

// POST /api/media/publish/batch
mediaRouter.post('/media/publish/batch', auditLog('media.publish.batch'), async (req, res, next) => {
  try {
    const params = PublishBatchSchema.parse(req.body);
    const r = await publishBatch(params);
    res.json(r.data);
  } catch (e) {
    // 透传 Python 微服务的真实错误信息(而非统一吞成 'internal')
    const msg = (e as Error).message || '发布失败';
    res.status(500).json({ error: msg });
  }
});

// ==================== 统计 ====================

// GET /api/media/stats/platform
mediaRouter.get('/media/stats/platform', async (_req, res, next) => {
  try {
    const r = await getPlatformStats();
    res.json(r.data);
  } catch (e) { next(e); }
});

// GET /api/media/stats/file
mediaRouter.get('/media/stats/file', async (_req, res, next) => {
  try {
    const r = await getFileStats();
    res.json(r.data);
  } catch (e) { next(e); }
});
