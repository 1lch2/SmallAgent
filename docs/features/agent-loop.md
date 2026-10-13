# Agent 对话历史、工具循环与系统提示词

[返回功能索引](../feature-map.yaml)

覆盖状态：已核对入口、历史状态归属及模型与工具循环。最近核对：2026-10-13。未执行真实模型或工具回合验收。

## 入口与关键实现

- [src/core/agent.ts](../../src/core/agent.ts)：`Agent` 持有对话历史，`send` 追加用户消息并驱动循环，通过 `AgentUpdate` 回调推送回复、思考、工具事件、用量和错误。
- [src/core/system-prompt.ts](../../src/core/system-prompt.ts)：`buildSystemPrompt` 在 Agent 初始化时注入工作目录、宿主本地日期和实际用于执行命令的 Shell 信息。
- [src/tools/index.ts](../../src/tools/index.ts)：注册三个工具，导出模型可见的 `tools`，由 `executeTool` 按名称分派；未知工具和执行异常转换为结果文本。
- [src/types.ts](../../src/types.ts)：定义模型无关的 `LLM`、消息和工具协议。
- [src/utils/error.ts](../../src/utils/error.ts)：统一将错误转换为文本。

## 调用链与状态边界

`App.handleSubmit` → `Agent.send` → `llm.complete` → 记录助手消息、推送文本块 → 逐个 `executeTool` → 记录对应 `callId` 的工具结果 → 再次请求模型。没有工具调用时本轮结束。

工具参数的 JSON 解析失败时使用空对象。模型请求失败时推送 `error` 事件并结束本轮；工具失败文本仍进入历史并反馈模型。完整历史由 Agent 实例维护，UI 维护展示条目，两者职责不同。

模型调用见[模型适配](model-adapter.md)，文本拆分与事件展示见[终端交互](terminal-ui.md)，具体工具见[文件读写](file-tools.md)及[命令执行](terminal-tool.md)。

## 验证入口与待补充范围

现有静态检查入口为 `npm run typecheck`，交互入口为 `npm start`。未发现本专题对应的自动化测试；模型异常、连续工具调用与多轮上下文需要通过实际回合验证。
