import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { query } from '../src/db/pool.js';
import { resetDb } from './helpers.js';
import { getFeatureModel, classifyKind, refreshModels } from '../src/settings/settings.service.js';
import { config } from '../src/config.js';

beforeEach(async () => { await resetDb(); });
afterEach(() => vi.unstubAllGlobals());

describe('getFeatureModel', () => {
  it('无 DB 分配 -> env 兜底', async () => {
    expect(await getFeatureModel('chat')).toBe(config.doubaoModel);
    expect(await getFeatureModel('poster')).toBe(config.posterModel);
    expect(await getFeatureModel('extraction')).toBe(config.extractModel);
  });

  it('有 DB 分配 -> 返 DB 值,其他功能仍兜底', async () => {
    await query("INSERT INTO ai_model (model_id,label,kind) VALUES ('m1','测试','chat')");
    await query("INSERT INTO ai_feature_config (feature,model_id) VALUES ('chat','m1')");
    expect(await getFeatureModel('chat')).toBe('m1');
    expect(await getFeatureModel('poster')).toBe(config.posterModel);
  });
});

describe('classifyKind', () => {
  it('TextToImage -> image', () => expect(classifyKind(['TextToImage'])).toBe('image'));
  it('ImageToImage -> image', () => expect(classifyKind(['ImageToImage'])).toBe('image'));
  it('TextGeneration -> chat', () => expect(classifyKind(['TextGeneration'])).toBe('chat'));
  it('VisualQuestionAnswering -> chat', () => expect(classifyKind(['VisualQuestionAnswering'])).toBe('chat'));
  it('视频 -> other', () => expect(classifyKind(['TextToVideo'])).toBe('other'));
  it('空 -> other', () => expect(classifyKind(null)).toBe('other'));
});

describe('refreshModels', () => {
  it('拉取 + 过滤 Shutdown + 分类 + upsert', async () => {
    const mockResp = {
      data: [
        { id: 'chat-1', name: '对话模型', status: 'Active', task_type: ['TextGeneration'] },
        { id: 'img-1', name: '文生图', status: undefined, task_type: ['TextToImage'] },
        { id: 'dead-1', name: '已停服', status: 'Shutdown', task_type: ['TextGeneration'] },
      ],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => mockResp, text: async () => '' }));
    const r = await refreshModels();
    expect(r.fetched).toBe(2);
    const models = (await query('SELECT model_id, kind FROM ai_model ORDER BY model_id')).rows;
    expect(models.map((m: any) => m.model_id)).toEqual(['chat-1', 'img-1']);
    expect(models.find((m: any) => m.model_id === 'chat-1').kind).toBe('chat');
    expect(models.find((m: any) => m.model_id === 'img-1').kind).toBe('image');
  });

  it('重复拉取 upsert 不累积', async () => {
    const mockResp = { data: [{ id: 'm1', name: 'M1', status: 'Active', task_type: ['TextGeneration'] }] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => mockResp, text: async () => '' }));
    await refreshModels();
    await refreshModels();
    const n = (await query('SELECT count(*)::int AS n FROM ai_model')).rows[0].n;
    expect(n).toBe(1);
  });

  it('Ark 返回非 200 -> 抛错', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' }));
    await expect(refreshModels()).rejects.toThrow('Ark /models 500');
  });
});
