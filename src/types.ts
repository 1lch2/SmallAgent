/** Agent 使用的最小模型接口，不依赖具体 SDK。 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  /** 保留原始 JSON 字符串，由 agent 在执行工具时解析。 */
  arguments: string;
}

export interface AssistantMessage {
  role: 'assistant';
  content: string;
  toolCalls?: ToolCall[];
}

export type Message =
  | { role: 'system' | 'user'; content: string }
  | AssistantMessage
  | { role: 'tool'; callId: string; content: string };

export interface CompletionRequest {
  messages: Message[];
  tools: ToolDefinition[];
}

export interface LLM {
  complete(request: CompletionRequest): Promise<AssistantMessage>;
}
