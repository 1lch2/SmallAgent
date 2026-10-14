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
  { id: 'mimo-token-plan', name: '小米 MiMo（Token Plan）', baseURL: 'https://token-plan-cn.xiaomimimo.com/v1' },
  { id: 'kimi-api', name: 'Kimi（API）', baseURL: 'https://api.moonshot.cn/v1' },
  { id: 'kimi-coding-plan', name: 'Kimi（Coding Plan）', baseURL: 'https://api.kimi.com/coding/v1' },
  { id: 'openai', name: 'OpenAI（官方）', baseURL: 'https://api.openai.com/v1' },
  { id: 'openai-compatible', name: 'OpenAI Chat Completion兼容' },
];
