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
 *    一次 `send()` 会按时间顺序产生思考、回复、工具调用、工具结果和错误事件。
 *    事件产生即回调，UI 可以在循环进行中增量渲染，
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
import type { AssistantMessage, LLM, Message, TokenUsage, ToolDefinition } from '../types';
import { executeTool, tools } from '../tools';
import { errorMessage } from '../utils/error';
import { splitAssistantText } from '../utils/assistant-text';
import {
  buildInstructionsPrompt,
  buildSkillsPrompt,
  buildSystemPrompt,
  buildToolsPrompt,
} from './prompt';
import type { PermissionMode } from './settings';
import { loadSkills } from './skills';

/** 初始化基础 Agent 所需的模型与工作目录。 */
export interface BaseAgentOptions {
  llm: LLM;
  cwd: string;
}

/** 初始化主 Agent 所需的模型、工作目录与工具权限。 */
export interface MainAgentOptions extends BaseAgentOptions {
  permission?: PermissionMode;
}

/** 描述 Agent 按处理顺序推送给界面的更新事件。 */
export type AgentUpdate =
  | { kind: 'assistant_text_thinking'; text: string }
  | { kind: 'assistant_text_response'; text: string }
  | { kind: 'tool_call'; name: string; args: unknown; callId: string }
  | {
      kind: 'tool_result';
      callId: string;
      name: string;
      args: Record<string, unknown>;
      output: string;
    }
  | { kind: 'token_usage'; usage: TokenUsage }
  | { kind: 'error'; message: string };

/** 持有对话历史与基本提示词，提供不预加载工具和 skill 的 ReAct 循环。 */
export class BaseAgent {
  private llm: LLM;
  protected readonly cwd: string;
  protected tools: ToolDefinition[] = [];
  private history: Message[] = [];

  /** 创建基础 Agent，默认注入基本提示词，也允许子类传入完整提示词。 */
  constructor(opts: BaseAgentOptions, systemPrompt = buildSystemPrompt(opts.cwd)) {
    this.llm = opts.llm;
    this.cwd = opts.cwd;
    this.history.push({
      role: 'system',
      content: systemPrompt,
    });
  }

  /** 切换模型连接并保留当前对话历史；应在当前回合结束后调用。 */
  setLLM(llm: LLM): void {
    this.llm = llm;
  }

  /** 由子类接入工具执行，基础 Agent 不提供具体工具。 */
  protected async executeTool(name: string, _args: Record<string, unknown>): Promise<string> {
    return `Unknown tool: ${name}`;
  }

  /** 发送用户输入，并按处理过程推送 Agent 更新事件。 */
  async send(userInput: string, onUpdate: (u: AgentUpdate) => void): Promise<void> {
    this.history.push({ role: 'user', content: userInput });

    // 循环骨架：请求模型 → 若它要调工具，执行并把结果追加进历史 → 再请求。
    while (true) {
      let msg: AssistantMessage;
      try {
        msg = await this.llm.complete({
          messages: this.history,
          tools: this.tools,
          onTokenUsage: usage => onUpdate({ kind: 'token_usage', usage }),
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

      for (const block of splitAssistantText(msg.content)) {
        onUpdate(block);
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

        const output = await this.executeTool(call.name, parsed);

        onUpdate({ kind: 'tool_result', callId: call.id, name: call.name, args: parsed, output });
        this.history.push({
          role: 'tool',
          callId: call.id,
          content: output,
        });
      }
    }
  }
}

/** 继承基础循环，装配全部工具、skill 和用户及工作区指令的主 Agent。 */
export class MainAgent extends BaseAgent {
  /** 当前工具执行权限；应在当前回合结束后更新。 */
  permission: PermissionMode;
  private readonly skillPaths: string[];

  /** 加载主 Agent 的完整能力并初始化系统提示词。 */
  constructor(opts: MainAgentOptions) {
    const skills = loadSkills(opts.cwd);
    super(
      opts,
      buildSystemPrompt(opts.cwd) +
        buildToolsPrompt(tools) +
        buildSkillsPrompt(skills) +
        buildInstructionsPrompt(opts.cwd)
    );
    this.tools = tools;
    this.permission = opts.permission ?? 'workspace-write';
    this.skillPaths = skills.map(skill => skill.path);
  }

  /** 使用当前权限与已注册 skill 路径执行主 Agent 的工具。 */
  protected override async executeTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<string> {
    return executeTool(name, args, this.cwd, this.permission, this.skillPaths);
  }
}
