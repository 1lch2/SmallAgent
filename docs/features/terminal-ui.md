# 终端输入、消息展示与布局

[返回功能索引](../feature-map.yaml)

覆盖状态：已核对输入提交、事件展示和尺寸变化主链路。最近核对：2026-10-13。未进行真实终端交互验收。

## 入口与关键实现

- [src/ui/app.tsx](../../src/ui/app.tsx)：`App` 管理输入、展示条目、忙碌状态、Token 用量和终端行数；提交时调用 Agent，订阅并清理 stdout 的 `resize` 监听。
- [src/ui/message.tsx](../../src/ui/message.tsx)：`Entry` 定义展示类型，`Message` 渲染用户、思考、回复、工具摘要和错误。
- [src/utils/assistant-text.ts](../../src/utils/assistant-text.ts)：`splitAssistantText` 按完整 `<think>...</think>` 标签拆分正文与思考块，清除边界空行并忽略空白块；由 Agent 调用后推送 UI 事件。
- [src/utils/format.ts](../../src/utils/format.ts)：`truncate` 截断长工具输出，`formatArgs` 格式化通用工具参数。

## 调用链与状态边界

`TextInput.onSubmit` → `handleSubmit` → [Agent.send](agent-loop.md) → `handleUpdate` → 展示条目或用量状态 → `Message`。空白输入和忙碌时的提交被忽略，执行结束时在 `finally` 中恢复忙碌状态。

文件工具调用只展示文件名，`App` 不追加其结果事件，包含错误文本的文件工具结果也走这一过滤分支。命令调用展示命令文本，命令结果经截断显示。模型用量的计算归属见[模型适配](model-adapter.md)。

布局包含标题与工作目录、消息区、输入框，以及模型名和累计 Token 状态栏。最小高度随终端行数变化，长消息自然延伸；启动清屏入口见[启动与构建](cli-startup.md)。

## 验证入口与待补充范围

现有检查入口为 `npm run typecheck`，交互入口为 `npm start`。未发现组件测试或终端 E2E 入口；中文输入、终端缩放和长消息滚动的实际表现未运行核验。
