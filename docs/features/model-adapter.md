# OpenAI 兼容模型接口与 Token 用量

[返回功能索引](../feature-map.yaml)

覆盖状态：已核对 SDK 请求、消息转换及用量上报主链路。最近核对：2026-10-13。未验证真实端点兼容性或鉴权行为。

## 入口与关键实现

- [src/openai-llm.ts](../../src/openai-llm.ts)：`OpenAILLM` 实现 `LLM`；`toOpenAIMessage` 转换内部消息，`complete` 调用 `client.chat.completions.create`，转换首个响应 choice 的正文和工具调用。
- [src/types.ts](../../src/types.ts)：`CompletionRequest`、`AssistantMessage`、`ToolCall` 和 `LLM` 定义 Agent 与适配器之间的边界，不依赖 SDK 类型。
- [src/index.tsx](../../src/index.tsx)：读取端点、模型和密钥配置并创建适配器，配置入口见[启动与构建](cli-startup.md)。

## 调用链与状态边界

[Agent 循环](agent-loop.md) → `OpenAILLM.complete` → 非流式 Chat Completions 请求 → 内部助手消息。工具参数保留为原始 JSON 字符串，由 Agent 解析；工具消息通过 `tool_call_id` 对齐。

`usedTokens` 属于适配器实例，累加响应提供的 `usage.total_tokens`，经 `onTokenUsage` 和 `AgentUpdate` 传到[终端状态栏](terminal-ui.md)。响应未提供 usage 时不更新；没有 choice 时抛出错误，由 Agent 请求错误分支处理。

## 验证入口与待补充范围

现有检查入口为 `npm run typecheck`，真实请求从 `npm start` 发起。未发现适配器自动化测试；不同兼容端点、缺少鉴权配置时的 SDK 行为及实际用量返回均未运行核验。
