import { config } from '../config.js';
import { AI_TOOLS, executeTool, type AiCtx } from './ai.tools.js';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
}

const systemPrompt = (ctx: AiCtx) =>
  `你是一个足浴店经营分析助手。用中文回答。当前上下文:门店 ${ctx.shopId ? 'id=' + ctx.shopId : '全部 5 店'}、月份 ${ctx.period}。
可用指标(部分):revenue(营业收入)、customers_total(总客流)、recharge_total(充值总额)、footbath_revenue/spa_revenue/minor_revenue(足浴/SPA/小项业务收入)、cash/douyin/meituan/pos/alipay/wechat(支付渠道)。调用 get_template 看完整指标列表。
规则:基于工具查询的真实数据回答,不要编造数字;金额用¥加千分位;末尾给一句简短经营建议。`;

async function callDoubao(messages: ChatMessage[]) {
  const url = `${config.doubaoBaseUrl}/chat/completions`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.doubaoApiKey}` },
    body: JSON.stringify({ model: config.doubaoModel, messages, tools: AI_TOOLS, tool_choice: 'auto', temperature: 0.3 }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`豆包 API ${r.status}: ${t.slice(0, 300)}`);
  }
  return r.json();
}

// AI 未配置(缺 DOUBAO_API_KEY)专用错误,供抽取管线区分"未配置"与"调用失败"
export class NotConfigured extends Error {
  constructor(msg = 'AI 未配置:请在 server/.env 设置 DOUBAO_API_KEY') { super(msg); this.name = 'NotConfigured'; }
}

// 结构化输出:response_format json_object + temperature 0,供 AI 抽取(单轮,返回 JSON.parse 后的对象)。
// 与 callDoubao 区别:不带 tools、强制 JSON 输出、temperature 0、用 extractModel。
export async function callDoubaoJson(messages: ChatMessage[]): Promise<any> {
  if (!config.doubaoApiKey) throw new NotConfigured();
  const url = `${config.doubaoBaseUrl}/chat/completions`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.doubaoApiKey}` },
    body: JSON.stringify({ model: config.extractModel, messages, response_format: { type: 'json_object' }, temperature: 0 }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`豆包 API ${r.status}: ${t.slice(0, 300)}`);
  }
  const resp = await r.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = resp.choices?.[0]?.message?.content;
  if (!content) throw new Error('AI 未返回内容');
  try {
    return JSON.parse(content);
  } catch {
    throw new Error('AI 返回非合法 JSON');
  }
}

export async function chat(message: string, ctx: AiCtx): Promise<{ answer: string; configured: boolean; error?: string }> {
  if (!config.doubaoApiKey) {
    return {
      answer: 'AI 助手未配置:请在 server/.env 设置 DOUBAO_API_KEY(豆包 / 火山方舟 Ark),并按需设 DOUBAO_MODEL、DOUBAO_BASE_URL。',
      configured: false,
    };
  }
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt(ctx) },
    { role: 'user', content: message },
  ];
  for (let i = 0; i < 6; i++) {
    let resp: { choices?: Array<{ message: ChatMessage }> };
    try {
      resp = await callDoubao(messages);
    } catch (e: any) {
      return { answer: `调用 AI 失败:${e.message}`, configured: true, error: e.message };
    }
    const choice = resp.choices?.[0]?.message;
    if (!choice) return { answer: 'AI 未返回内容', configured: true };
    messages.push(choice);
    if (!choice.tool_calls?.length) return { answer: choice.content || '(无内容)', configured: true };
    for (const tc of choice.tool_calls) {
      const args = JSON.parse(tc.function?.arguments || '{}');
      let result: unknown;
      try { result = await executeTool(tc.function.name, args, ctx); }
      catch (e: any) { result = { error: e.message }; }
      messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
    }
  }
  return { answer: '分析步骤过多,已停止。请缩小问题范围。', configured: true };
}
