import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { AssistantMessage, CompletionRequest, LLM, Message, ModelInfo } from './types';
import { errorMessage } from './utils/error';

/** 描述 OpenAI 兼容端点的密钥、地址和模型配置。 */
export interface OpenAILLMOptions {
  apiKey?: string;
  baseURL: string;
  model: ModelInfo;
}

function toOpenAIMessage(message: Message): ChatCompletionMessageParam {
  if (message.role === 'tool') {
    return { role: 'tool', tool_call_id: message.callId, content: message.content };
  }
  if (message.role === 'assistant') {
    return {
      role: 'assistant',
      content: message.content,
      ...(message.toolCalls?.length
        ? {
            tool_calls: message.toolCalls.map(call => ({
              id: call.id,
              type: 'function' as const,
              function: { name: call.name, arguments: call.arguments },
            })),
          }
        : {}),
    };
  }
  return { role: message.role, content: message.content };
}

/** OpenAI 兼容端点的请求、配置和协议转换只放在这里。 */
export class OpenAILLM implements LLM {
  private client: OpenAI;
  /** 当前模型的调用 ID、展示名称与上下文限制。 */
  model: ModelInfo;

  /** 根据连接配置创建 OpenAI 兼容模型适配器。 */
  constructor(opts: OpenAILLMOptions) {
    this.client = new OpenAI({ apiKey: opts.apiKey, baseURL: opts.baseURL });
    this.model = opts.model;
  }

  /** 请求模型并将响应转换为 Agent 使用的消息格式。 */
  async complete(request: CompletionRequest): Promise<AssistantMessage> {
    const response = await this.client.chat.completions
      .create({
        model: this.model.id,
        messages: request.messages.map(toOpenAIMessage),
        ...(request.tools.length
          ? { tools: request.tools.map(tool => ({ type: 'function' as const, function: tool })) }
          : {}),
      })
      .catch((error: unknown) => {
        const message = errorMessage(error);
        // 服务端可能在错误正文中回显凭据，避免将密钥传入界面。
        throw new Error(message.replaceAll(this.client.apiKey, '[已隐藏]'));
      });
    if (response.usage) {
      request.onTokenUsage?.({
        totalTokens: response.usage.total_tokens,
        promptTokens: response.usage.prompt_tokens,
        cachedTokens: response.usage.prompt_tokens_details?.cached_tokens ?? 0,
      });
    }
    const choice = response.choices[0];
    if (!choice) throw new Error('Model returned no choices.');

    const message = choice.message;
    return {
      role: 'assistant',
      content: message.content ?? '',
      ...(message.tool_calls?.length
        ? {
            toolCalls: message.tool_calls.map(call => ({
              id: call.id,
              name: call.function.name,
              arguments: call.function.arguments,
            })),
          }
        : {}),
    };
  }
}
