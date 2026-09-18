/**
 * Agent 核心：标准的 ReAct 循环。
 *
 * 核心思想：
 *
 * 1. Agent 持有状态，调用方无状态。
 *    Agent 实例维护完整对话历史；每次 `send()` 把用户输入并入上下文，
 *    然后驱动模型直到本轮结束。UI 只需持有一个 Agent 引用，
 *    不用自己管理上下文窗口。
 *
 * 2. 历史不变式（最容易踩坑的地方）。
 *    一旦某条 assistant 消息带有 `toolCalls`，它的每一条调用
 *    都必须跟随一条 `role: 'tool'` 的消息，且 `callId` 一一对应。
 *    本轮循环严格按
 *    "assistant → tool* → assistant → ..." 的顺序追加，
 *    保证下一次请求的 messages 永远自洽。
 *
 * 3. 终止条件：模型不再返回 `toolCalls`。
 *    模型不打算调工具时会只输出文本——这就是循环出口。
 *
 * 4. 用回调推送事件，而不是靠返回值。
 *    一次 `send()` 会按时间顺序产生多条事件（assistant_text、tool_call、
 *    tool_result、error）。事件产生即回调，UI 可以在循环进行中增量渲染，
 *    不必等整个回合结束。
 *
 * 5. 错误当事件处理，不抛异常。
 *    网络错误 / 模型异常不应该让对话崩掉——回调一条 `error` 事件然后
 *    安静返回，用户可以继续发下一条消息。
 *
 * 6. 非流式请求。
 *    每次 `llm.complete()` 一次性拿到完整响应，比流式实现简单很多。
 *    当前阶段优先可读性，延迟不是瓶颈。
 */
import type { AssistantMessage, LLM, Message } from './llm';
import { executeTool, tools } from './tools';
import { errorMessage } from './utils/error';

export interface AgentOptions {
  llm: LLM;
  cwd: string;
}

// UI 拿到的事件流。一轮 send() 会按时间顺序触发若干次回调。
export type AgentUpdate =
  | { kind: 'assistant_text'; text: string }
  | { kind: 'tool_call'; name: string; args: unknown; callId: string }
  | { kind: 'tool_result'; callId: string; output: string }
  | { kind: 'error'; message: string };

// 系统提示词常量：直接告诉模型 cwd，让它发出的相对路径无歧义；
// 同时约束输出节奏——终端界面空间紧，长篇大论会很难读。
// {cwd} 占位符在构造 Agent 时替换为实际工作目录。
const SYSTEM_PROMPT =
  'You are a terminal agent.' +
  'Your working directory is {cwd}. ' +
  'You have tools to read files, write files, and run shell commands. ' +
  'Be concise. When a task is complete, give a one or two line summary. ' +
  'If you are unsure, ask the user instead of guessing.';

export class Agent {
  private llm: LLM;
  private cwd: string;
  private history: Message[] = [];

  constructor(opts: AgentOptions) {
    this.llm = opts.llm;
    this.cwd = opts.cwd;
    this.history.push({
      role: 'system',
      content: SYSTEM_PROMPT.replace('{cwd}', this.cwd),
    });
  }

  async send(userInput: string, onUpdate: (u: AgentUpdate) => void): Promise<void> {
    this.history.push({ role: 'user', content: userInput });

    // 循环骨架：请求模型 → 若它要调工具，执行并把结果追加进历史 → 再请求。
    while (true) {
      let msg: AssistantMessage;
      try {
        msg = await this.llm.complete({
          messages: this.history,
          tools,
        });
      } catch (err) {
        // API 错误转为事件，不抛——本轮中止，但 Agent 实例保持可用，
        // 用户可以继续发下一条消息。
        onUpdate({ kind: 'error', message: errorMessage(err) });
        return;
      }

      const toolCalls = msg.toolCalls;

      // 先记录模型回复与工具调用，后面的工具结果按调用 ID 对齐。
      this.history.push({
        role: 'assistant',
        content: msg.content ?? '',
        ...(toolCalls && toolCalls.length > 0 ? { toolCalls } : {}),
      });

      if (msg.content) {
        onUpdate({ kind: 'assistant_text', text: msg.content });
      }

      // 出口判断：模型没要工具 → 本轮结束。
      if (!toolCalls || toolCalls.length === 0) {
        return;
      }

      // 逐个执行工具调用，每个调用 ID 都有一条对应结果。
      for (const call of toolCalls) {
        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(call.arguments) as Record<string, unknown>;
        } catch {
          parsed = {};
        }

        onUpdate({
          kind: 'tool_call',
          name: call.name,
          args: parsed,
          callId: call.id,
        });

        const output = await executeTool(call.name, parsed, this.cwd);

        onUpdate({ kind: 'tool_result', callId: call.id, output });
        this.history.push({
          role: 'tool',
          callId: call.id,
          content: output,
        });
      }
    }
  }
}
