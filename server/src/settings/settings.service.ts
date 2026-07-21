// 系统设置:AI 模型管理。getFeatureModel 供网关读 DB(env 兜底);refreshModels 从 Ark 拉取。
import { query } from '../db/pool.js';
import { config } from '../config.js';

export type AiFeature = 'chat' | 'poster' | 'extraction';
export type AiModelKind = 'chat' | 'image' | 'other';

export interface AiModel {
  id: number; model_id: string; label: string; kind: AiModelKind;
  status: string | null; task_type: string[] | null; fetched_at: string | null; enabled: boolean;
}

// env 兜底(无 DB 分配时,行为同子项目3 之前)
const ENV_FALLBACK: Record<AiFeature, string> = {
  chat: config.doubaoModel,
  poster: config.posterModel,
  extraction: config.extractModel,
};

// 查功能分配的模型;DB 无行 -> env 兜底。无缓存(AI 调用不频繁,单次 DB 查询可忽略)。
export async function getFeatureModel(feature: AiFeature): Promise<string> {
  const r = (await query<{ model_id: string }>(
    'SELECT model_id FROM ai_feature_config WHERE feature=$1', [feature],
  )).rows[0];
  return r?.model_id || ENV_FALLBACK[feature];
}

// task_type -> kind:文生图类->image;文本生成类->chat;其余->other
export function classifyKind(taskType: string[] | null | undefined): AiModelKind {
  const t = taskType || [];
  if (t.some(x => x === 'TextToImage' || x === 'ImageToImage')) return 'image';
  if (t.some(x => x === 'TextGeneration' || x === 'VisualQuestionAnswering')) return 'chat';
  return 'other';
}
