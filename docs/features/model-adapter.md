# OpenAI 兼容模型接口与 Token 用量

[返回功能索引](../feature-map.yaml)

覆盖状态：已核对 SDK 请求、消息转换及用量上报主链路。最近核对：2026-10-13。未验证真实端点兼容性或鉴权行为。

## 入口与关键实现

- [src/openai-llm.ts](../../src/openai-llm.ts)：`OpenAILLM` 实现 `LLM`；`toOpenAIMessage` 转换内部消息，`complete` 调用 `client.chat.completions.create`，转换首个响应 choice 的正文和工具调用。
- [src/types.ts](../../src/types.ts)：`CompletionRequest`、`AssistantMessage`、`ToolCall` 和 `LLM` 定义 Agent 与适配器之间的边界，不依赖 SDK 类型。
- [src/providers/connect.ts](../../src/providers/connect.ts)：按内置服务商或自定义端点查询模型列表、校验连接后创建适配器，配置入口见[Provider](providers.md)。启动不再读取模型环境变量。
- [src/ui/ProviderSession.tsx](../../src/ui/ProviderSession.tsx)：启动时只读取本地已选连接，直接使用保存的端点、模型和 Key 创建适配器，不调用连接校验流程。

## 调用链与状态边界

[Agent 循环](agent-loop.md) → `OpenAILLM.complete` → 非流式 Chat Completions 请求 → 内部助手消息。工具参数保留为原始 JSON 字符串，由 Agent 解析；工具消息通过 `tool_call_id` 对齐。

`tokenUsage` 属于适配器实例，按 OpenAI SDK 的标准字段累加 `usage.total_tokens`、`usage.prompt_tokens` 和 `usage.prompt_tokens_details.cached_tokens`，分别映射到内部 `TokenUsage` 的 `totalTokens`、`promptTokens` 和 `cachedTokens`。经 `onTokenUsage` 和 `AgentUpdate.usage` 传到[终端工具栏](terminal-ui.md)。缓存字段缺失时本次缓存量按 0 计算，响应未提供 usage 时不更新；缓存量已包含在输入和总用量中，不重复相加。没有 choice 时抛出错误，由 Agent 请求错误分支处理。

## 验证入口与待补充范围

现有检查入口为 `npm run typecheck`，真实请求从 `npm start` 发起。未发现适配器自动化测试；不同兼容端点、缺少鉴权配置时的 SDK 行为及实际用量返回均未运行核验。
