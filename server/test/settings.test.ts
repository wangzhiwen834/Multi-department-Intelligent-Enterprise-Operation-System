import { describe, it, expect, beforeEach } from 'vitest';
import { query } from '../src/db/pool.js';
import { resetDb } from './helpers.js';
import { getFeatureModel, classifyKind } from '../src/settings/settings.service.js';
import { config } from '../src/config.js';

beforeEach(async () => { await resetDb(); });

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
