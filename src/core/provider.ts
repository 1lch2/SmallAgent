import OpenAI from 'openai';
import { OpenAILLM } from '../openai-llm';
import type { ModelCatalog, SavedConnection } from './settings';

/** 内置服务商的端点与模型列表备用来源。 */
export interface ProviderDefinition {
  id: string;
  name: string;
  baseURL?: string;
  modelsDocument?: string;
}

/** 按官方文档注册的 OpenAI Chat Completions 兼容服务商。 */
export const providers: readonly ProviderDefinition[] = [
  { id: 'deepseek', name: 'DeepSeek', baseURL: 'https://api.deepseek.com' },
  { id: 'minimax-api', name: 'MiniMax（API）', baseURL: 'https://api.minimax.cn/v1' },
  { id: 'minimax-token-plan', name: 'MiniMax（Token Plan）', baseURL: 'https://api.minimax.cn/v1' },
  {
    id: 'glm-api',
    name: '智谱GLM（API）',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    modelsDocument: 'https://docs.bigmodel.cn/cn/guide/start/model-overview.md',
  },
  {
    id: 'glm-token-plan',
    name: '智谱GLM（Coding Plan）',
    baseURL: 'https://open.bigmodel.cn/api/coding/paas/v4',
    modelsDocument: 'https://docs.bigmodel.cn/cn/coding-plan/latest-model.md',
  },
  { id: 'mimo-api', name: '小米 MiMo（API）', baseURL: 'https://api.xiaomimimo.com/v1' },
  {
    id: 'mimo-token-plan',
    name: '小米 MiMo（Token Plan）',
    baseURL: 'https://token-plan-cn.xiaomimimo.com/v1',
  },
  { id: 'kimi-api', name: 'Kimi（API）', baseURL: 'https://api.moonshot.cn/v1' },
  {
    id: 'kimi-coding-plan',
    name: 'Kimi（Coding Plan）',
    baseURL: 'https://api.kimi.com/coding/v1',
  },
  { id: 'openai', name: 'OpenAI（官方）', baseURL: 'https://api.openai.com/v1' },
  { id: 'openai-compatible', name: 'OpenAI Chat Completion兼容' },
];

/** 本地选项初始化或联网校验后创建的模型连接。 */
export interface ProviderConnection {
  options: SavedConnection;
  catalog?: ModelCatalog;
  llm: OpenAILLM;
}

/** 校验并规范化 OpenAI 兼容 API 的基础地址。 */
export function normalizeBaseURL(value: string): string {
  try {
    const url = new URL(value.trim());
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error();
    return url.href.replace(/\/$/, '');
  } catch {
    throw new Error('请输入有效的 HTTP 或 HTTPS API 基础地址。');
  }
}

async function modelsFromDocument(provider: ProviderDefinition): Promise<string[]> {
  const response = await fetch(provider.modelsDocument!, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`官方模型文档读取失败（HTTP ${response.status}）。`);
  const text = await response.text();
  const names =
    provider.id === 'glm-api'
      ? [
          ...text.matchAll(
            /^\s*\|\s*\[(GLM-[^\]]+)\]\(\/cn\/guide\/models\/(?:text|vlm|free)\/[^)]+\)/gm
          ),
        ]
          .map(match => match[1]!.toLowerCase())
          .filter(name => name !== 'glm-ocr')
      : [...text.matchAll(/\bglm-\d[\w.-]*/gi)].map(match => match[0].toLowerCase());
  return [...new Set(names)];
}

function connectionError(error: unknown, stage: string): Error {
  if (error instanceof OpenAI.APIError)
    return new Error(
      `${stage}失败${error.status ? `（HTTP ${error.status}）` : ''}。请检查端点、API Key 和套餐权限。`
    );
  return new Error(`${stage}失败，请检查网络及服务端状态。`);
}

/** 查询服务商模型清单，保留接口或官方文档的来源信息。 */
export async function fetchModelCatalog(
  provider: ProviderDefinition,
  apiKey: string,
  baseURL = provider.baseURL ?? ''
): Promise<ModelCatalog> {
  const key = apiKey.trim();
  if (!key) throw new Error('请输入 API Key。');
  const endpoint = normalizeBaseURL(provider.baseURL ?? baseURL);
  const client = new OpenAI({ apiKey: key, baseURL: endpoint, timeout: 20_000, maxRetries: 0 });
  let models: string[];
  let source: ModelCatalog['source'] = 'api';
  try {
    models = [];
    for await (const model of client.models.list()) {
      if (typeof model.id === 'string' && model.id.trim()) models.push(model.id);
    }
    models = [...new Set(models)];
  } catch (error) {
    if (
      provider.modelsDocument &&
      error instanceof OpenAI.APIError &&
      [404, 405, 501].includes(error.status ?? 0)
    ) {
      source = 'documentation';
      try {
        models = await modelsFromDocument(provider);
      } catch {
        throw new Error('模型列表接口不可用，且无法读取官方模型文档。');
      }
    } else {
      throw connectionError(error, '模型列表查询');
    }
  }
  if (!models.length) throw new Error('服务商未返回可用模型。');
  return { models, source, updatedAt: new Date().toISOString() };
}

/** 查询模型列表并验证首个模型，返回连接供会话层保存和激活。 */
export async function connectProvider(
  provider: ProviderDefinition,
  apiKey: string,
  baseURL = provider.baseURL ?? ''
): Promise<ProviderConnection> {
  const key = apiKey.trim();
  const endpoint = normalizeBaseURL(provider.baseURL ?? baseURL);
  const catalog = await fetchModelCatalog(provider, key, endpoint);
  const model = catalog.models[0]!;
  const client = new OpenAI({ apiKey: key, baseURL: endpoint, timeout: 20_000, maxRetries: 0 });
  try {
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'Reply OK.' }],
      max_tokens: 16,
      stream: false,
    });
    if (!response.choices?.length) throw new Error();
  } catch (error) {
    throw connectionError(error, '模型连接');
  }
  const options: SavedConnection = {
    providerId: provider.id,
    baseURL: endpoint,
    model,
    apiKey: key,
  };
  return { options, catalog, llm: new OpenAILLM({ apiKey: key, baseURL: endpoint, model }) };
}
