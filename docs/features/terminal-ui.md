# 终端输入、消息展示与布局

[返回功能索引](../feature-map.yaml)

覆盖状态：已核对输入提交、事件展示和尺寸变化主链路，斜杠菜单已通过 Ink 模拟输入输出流交互检查。最近核对：2026-10-13。未进行真实终端交互验收。

## 入口与关键实现

- [src/ui/app.tsx](../../src/ui/app.tsx)：`App` 管理输入、展示条目、忙碌状态、Token 用量和终端行数；提交时调用 Agent，订阅并清理 stdout 的 `resize` 监听。
- [src/ui/CommandInput.tsx](../../src/ui/CommandInput.tsx)：`CommandInput` 使用共享命令注册表，管理输入框下方的斜杠菜单、前缀筛选、循环上下键导航、Tab／回车补全，并在补全后将光标移至末尾。
- [src/commands/types.ts](../../src/commands/types.ts)：`SlashCommand` 定义命令名称、说明与可选的无参 `execute`；命令自行接入执行所需的能力。
- [src/commands/useCommands.ts](../../src/commands/useCommands.ts)：`useCommands` 在顶层调用 `useQuitCommand`，汇总注册命令并返回菜单所用的 `commands` 和统一分发函数 `executeCommand`；按名称匹配后调用命令自身的 `execute`，不包含具体命令的执行操作，`App` 不参与命令处理。
- [src/commands/compact.ts](../../src/commands/compact.ts)、[src/commands/model.ts](../../src/commands/model.ts)：分别注册 `/compact`（压缩上下文）、`/model`（切换模型），暂无执行逻辑。
- [src/commands/quit.ts](../../src/commands/quit.ts)：`useQuitCommand` 在命令文件内接入 Ink `useApp`，返回 `/quit`（退出tui）声明与 `execute` 实现，由其调用 `exit` 退出并卸载 TUI。
- [src/ui/message.tsx](../../src/ui/message.tsx)：`Entry` 定义展示类型，`Message` 渲染用户、思考、回复、工具摘要和错误。
- [src/utils/assistant-text.ts](../../src/utils/assistant-text.ts)：`splitAssistantText` 按完整 `<think>...</think>` 标签拆分正文与思考块，清除边界空行并忽略空白块；由 Agent 调用后推送 UI 事件。
- [src/utils/format.ts](../../src/utils/format.ts)：`truncate` 截断长工具输出，`formatArgs` 格式化通用工具参数。

## 调用链与状态边界

输入首字符为 `/` 且尚无空白字符时，按输入前缀筛选已注册命令；仅输入 `/` 时列出全部命令。输入变化时默认选中第一条匹配项，输入完整命令时选中对应命令。上下键在匹配结果中循环导航，Tab／回车只补全所选命令并追加一个空格，菜单随之收起，不提交消息。没有匹配项时显示“无匹配命令”，上下键、Tab 和回车不补全或提交。首字符不是 `/` 的输入不触发菜单。

补全后再次回车提交时，`CommandInput` 调用 `useCommands` 返回的分发函数，按首个词查找注册命令并调用其可选 `execute`。已注册命令被消费，不进入 `App.handleSubmit`，也不发送给模型；未命中命令的输入交给 `App` 处理。`/quit` 退出 TUI，`/compact`、`/model` 继续只注册。命令不受 `App` 的忙碌判断影响，因此模型执行中也可退出 TUI；退出不取消正在进行的模型请求或工具执行。

`TextInput.onSubmit` → `handleSubmit` → [Agent.send](agent-loop.md) → `handleUpdate` → 展示条目或用量状态 → `Message`。空白输入和忙碌时的提交被忽略，执行结束时在 `finally` 中恢复忙碌状态。

文件工具调用只展示文件名，`App` 不追加其结果事件，包含错误文本的文件工具结果也走这一过滤分支。命令调用展示命令文本，命令结果经截断显示。模型用量的计算归属见[模型适配](model-adapter.md)。

布局包含标题与工作目录、消息区、输入框，以及模型名和累计 Token 状态栏。最小高度随终端行数变化，长消息自然延伸；启动清屏入口见[启动与构建](cli-startup.md)。

## 验证入口与待补充范围

现有检查入口为 `npm run typecheck`，交互入口为 `npm start`。未发现组件测试或终端 E2E 入口；中文输入、终端缩放和长消息滚动的实际表现未运行核验。
