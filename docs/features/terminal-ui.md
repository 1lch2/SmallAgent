# 终端输入、消息展示与布局

[返回功能索引](../feature-map.yaml)

覆盖状态：已核对输入提交、事件展示和尺寸变化主链路，斜杠菜单已通过 Ink 模拟输入输出流交互检查。最近核对：2026-10-13。未进行真实终端交互验收。

## 入口与关键实现

- [src/ui/App.tsx](../../src/ui/App.tsx)：`App` 管理输入、展示条目、忙碌状态、Token 用量和终端行数；提交时调用 Agent，订阅并清理 stdout 的 `resize` 监听。
- [src/ui/ProviderList.tsx](../../src/ui/ProviderList.tsx)：独立服务商选择和凭据输入界面，由 `/provider` 切换进入；状态和连接归属见[Provider](providers.md)。聊天组件保持挂载，切回时保留消息和历史。
- [src/ui/Toolbar.tsx](../../src/ui/Toolbar.tsx)：`Toolbar` 通过 `ToolbarProps` 接收模型名称和累计 `TokenUsage`，展示总用量、缓存命中 token 数及命中率；总量和缓存量共用格式，一万以下显示带千位分隔符的整数，从一万起使用“万”、一亿起使用“亿”，保留一位小数；不依赖 App 或 Agent，窄终端可换行。
- [src/ui/CommandInput.tsx](../../src/ui/CommandInput.tsx)：`CommandInput` 通过 `CommandInputProps.commands` 接收命令列表，菜单与执行共用该列表，不依赖 Provider 会话或内置命令。管理输入框下方的斜杠菜单、前缀筛选、循环上下键导航、Tab／回车补全，并在补全后将光标移至末尾。
- [src/core/commands.ts](../../src/core/commands.ts)：`SlashCommand` 定义名称、说明和可选无参执行回调；`executeCommand` 接收列表和输入，按首词匹配并执行，返回是否消费输入。不注册具体功能，也不定义功能能力集合。
- [src/hook/useCommands.ts](../../src/hook/useCommands.ts)：应用内置命令的组装入口，顶层接入 Ink 退出和会话页面能力，通过闭包注册 `/compact`、`/model`、`/provider`、`/quit`；仅 `/compact` 继续只注册。`App` 调用该 Hook 并将列表传给 `CommandInput`，不参与命令匹配或分发。
- [src/ui/Message.tsx](../../src/ui/Message.tsx)：`Entry` 定义展示类型，`Message` 渲染用户、思考、回复、工具摘要和错误。
- [src/utils/assistant-text.ts](../../src/utils/assistant-text.ts)：`splitAssistantText` 按完整 `<think>...</think>` 标签拆分正文与思考块，清除边界空行并忽略空白块；由 Agent 调用后推送 UI 事件。
- [src/utils/format.ts](../../src/utils/format.ts)：`truncate` 截断长工具输出，`formatArgs` 格式化通用工具参数。

## 调用链与状态边界

输入首字符为 `/` 且尚无空白字符时，按输入前缀筛选已注册命令；仅输入 `/` 时列出全部命令。输入变化时默认选中第一条匹配项，输入完整命令时选中对应命令。上下键在匹配结果中循环导航，Tab／回车只补全所选命令并追加一个空格，菜单随之收起，不提交消息。没有匹配项时显示“无匹配命令”，上下键、Tab 和回车不补全或提交。首字符不是 `/` 的输入不触发菜单。

补全后再次回车提交时，`CommandInput` 将传入的列表与输入交给 `executeCommand`，按首个词查找注册命令并调用其可选 `execute`。已注册命令被消费，不进入 `App.handleSubmit`，也不发送给模型；未命中命令的输入交给 `App` 处理。`/quit` 退出 TUI，`/compact` 继续只注册，`/model` 打开当前 Provider 的模型选择页。命令不受 `App` 的忙碌判断影响，因此模型执行中也可退出 TUI；退出不取消正在进行的模型请求或工具执行。

新增命令时在应用组装入口提供名称、说明和执行闭包即可；所需功能依赖留在该入口或命令自身实现中，无需修改通用协议、分发器或输入组件。

注册命令提交后清空输入。未连接时 `Toolbar` 显示“未连接任何模型”及 `/provider` 提示，普通消息不会请求模型。`/provider` 打开列表页，当前回合结束前禁止确认连接；成功后返回聊天并重置用量，失败保留原连接。`/model` 使用相同的 [List](../../src/ui/List.tsx) 组件展示模型，默认选中当前模型，上下键选择、回车保存并返回聊天，Esc 取消；当前回合结束前禁止确认切换。连接与模型选择详见[Provider](providers.md)。

`TextInput.onSubmit` → `handleSubmit` → [Agent.send](agent-loop.md) → `handleUpdate` → 展示条目或用量状态 → `Message`。空白输入和忙碌时的提交被忽略，执行结束时在 `finally` 中恢复忙碌状态。

文件工具调用只展示文件名，`App` 不追加其结果事件，包含错误文本的文件工具结果也走这一过滤分支。命令调用展示命令文本，命令结果经截断显示。模型用量的计算归属见[模型适配](model-adapter.md)。

布局包含标题与工作目录、消息区、输入框，以及独立 `Toolbar` 展示的模型名、累计总 Token、缓存命中量和命中率。命中率为累计缓存命中量除以累计输入用量，输入用量为 0 时显示 0.0%；不平均各请求的百分比。最小高度随终端行数变化，长消息自然延伸；启动清屏入口见[启动与构建](cli-startup.md)。

## 验证入口与待补充范围

现有检查入口为 `npm run typecheck`，交互入口为 `npm start`。未发现组件测试或终端 E2E 入口；中文输入、终端缩放和长消息滚动的实际表现未运行核验。
