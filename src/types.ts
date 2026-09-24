/** 描述可注册给模型调用的工具及其参数格式。 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** 描述模型发起的单个工具调用。 */
export interface ToolCall {
  id: string;
  name: string;
  /** 保留原始 JSON 字符串，由 agent 在执行工具时解析。 */
  arguments: string;
}

/** 描述模型返回的助手消息及其可选工具调用。 */
export interface AssistantMessage {
  role: 'assistant';
  content: string;
  toolCalls?: ToolCall[];
}

/** 描述发送给模型的对话消息。 */
export type Message =
  | { role: 'system' | 'user'; content: string }
  | AssistantMessage
  | { role: 'tool'; callId: string; content: string };

/** 描述一次模型补全请求所需的消息和工具定义。 */
export interface CompletionRequest {
  messages: Message[];
  tools: ToolDefinition[];
}

/** 定义与具体 SDK 无关的模型补全能力。 */
export interface LLM {
  /** 根据对话消息和工具定义生成助手回复。 */
  complete(request: CompletionRequest): Promise<AssistantMessage>;
}
