import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { AssistantMessage, CompletionRequest, LLM, Message } from './types';

/** 描述 OpenAI 兼容端点的密钥、地址和模型配置。 */
export interface OpenAILLMOptions {
  apiKey?: string;
  baseURL: string;
  model: string;
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
            tool_calls: message.toolCalls.map((call) => ({
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
  private model: string;

  /** 根据连接配置创建 OpenAI 兼容模型适配器。 */
  constructor(opts: OpenAILLMOptions) {
    this.client = new OpenAI({ apiKey: opts.apiKey, baseURL: opts.baseURL });
    this.model = opts.model;
  }

  /** 请求模型并将响应转换为 Agent 使用的消息格式。 */
  async complete(request: CompletionRequest): Promise<AssistantMessage> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: request.messages.map(toOpenAIMessage),
      tools: request.tools.map((tool) => ({ type: 'function', function: tool })),
    });
    const choice = response.choices[0];
    if (!choice) throw new Error('Model returned no choices.');

    const message = choice.message;
    return {
      role: 'assistant',
      content: message.content ?? '',
      ...(message.tool_calls?.length
        ? {
            toolCalls: message.tool_calls.map((call) => ({
              id: call.id,
              name: call.function.name,
              arguments: call.function.arguments,
            })),
          }
        : {}),
    };
  }
}
