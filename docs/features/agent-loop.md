# Agent 对话历史、工具循环与系统提示词

[返回功能索引](../feature-map.yaml)

覆盖状态：已核对入口、历史状态归属及模型与工具循环。最近核对：2026-10-15。

## 入口与关键实现

- [src/core/agent.ts](../../src/core/agent.ts)：统一定义 `BaseAgent`、`MainAgent` 与相关类型。`BaseAgent` 持有对话历史，默认只注入基本提示词，不加载工具、skill 或 AGENTS.md；`send` 驱动循环，通过 `AgentUpdate` 回调推送回复、思考、工具事件、用量和错误，工具定义与执行由子类接入。`MainAgent extends BaseAgent`，装配全部工具、skill 元数据、用户及工作区 AGENTS.md，并向工具分派器传递当前权限与已注册 skill 路径。
- [src/core/prompt.ts](../../src/core/prompt.ts)：`buildSystemPrompt` 只生成通用要求与工作目录、本地日期、Shell 环境；`buildToolsPrompt` 接收工具名称与描述，`buildSkillsPrompt` 接收 skill 元数据，`buildInstructionsPrompt` 读取并生成用户及工作区 AGENTS.md 指令，各部分由调用方独立组合。
- [src/core/compact.ts](../../src/core/compact.ts)：`buildCompactMessages` 生成独立总结提示词和按时间排列的历史 XML；`estimateContextTokens` 使用本地 js-tiktoken 的 o200k_base 估算序列化消息与工具定义的用量。
- [src/core/skills.ts](../../src/core/skills.ts)：`loadSkills` 发现工作区 `.agents/skills/` 与用户目录 `.liberi/skills/` 下的 SKILL.md，解析 frontmatter 的 `name`、`description` 并保存绝对 `path`；同名时保留工作区版本。
- [src/tools/index.ts](../../src/tools/index.ts)：注册四个工具，导出模型可见的 `tools`，由 `executeTool` 按名称分派；未知工具和执行异常转换为结果文本。
- [src/types.ts](../../src/types.ts)：定义模型无关的 `LLM`、消息和工具协议。
- [src/utils/error.ts](../../src/utils/error.ts)：统一将错误转换为文本。
- [src/utils/xml.ts](../../src/utils/xml.ts)：`escapeXml` 统一转义 XML 文本，供工具、skill 提示词及压缩历史序列化共用。

## 调用链与状态边界

`ProviderSession` 创建 `MainAgent`；`App.handleSubmit` → 继承的 `BaseAgent.send` → `llm.complete` → 记录助手消息、推送文本块 → 逐个调用 `MainAgent.executeTool` → 公共工具分派器 → 记录对应 `callId` 的工具结果 → 再次请求模型。没有工具调用时本轮结束。

工具参数的 JSON 解析失败时使用空对象。模型请求失败时推送 `error` 事件并结束本轮；工具失败文本仍进入历史并反馈模型。完整历史由 Agent 实例维护，UI 维护展示条目，两者职责不同。

`BaseAgent.model` 从当前 `LLM.model` 读取名称及上下文限制，不重复维护模型状态；`setLLM` 保留历史并切换这份元信息。数据来源见[模型适配](model-adapter.md)与[Provider](providers.md)。

MainAgent 初始化时接收权限模式，默认 `workspace-write`；每次工具执行向分派器传递当前模式。回合结束后可更新 `MainAgent.permission`，不修改系统提示词或历史；基本提示词不包含权限模式，工具行为说明由各自描述提供。配置入口见[设置配置](settings.md)。

MainAgent 在初始化时按“基本提示词 → 工具描述 → skill 元数据 → AGENTS.md”组合系统提示词；只在初始化时读取文件，不随文件修改刷新。工具提示词仅包含传入的工具名称与描述，不预设文件、Shell 或网页能力；Shell 用法及网页读取说明随对应工具描述提供。

Skill 元数据在 MainAgent 初始化时加载一次并注入 `<skills>`，只包含 `name`、`description`、`path`，不注入 Markdown 正文；使用指引要求模型先用 `file_read` 读取对应的完整 SKILL.md。

同一份注册结果同时用于提示词与工具读取许可，规则见[文件读写](file-tools.md)。

## 上下文压缩

`/compact` → `App.handleCompact` → `ProviderSession.createCompactLLM` → `BaseAgent.compact`。总结模型来自当前 Provider 的 `subagentModel` 配置；未配置、未找到、容量未知或容量不足时使用当前模型。容量判断同时参考最近一次主请求用量与总结输入的本地估算。

压缩保留原系统消息及最新用户回合的完整助手、工具调用与结果，仅将更早历史替换为总结。总结请求使用独立系统提示词，用户消息包含 `<history>` 中的 `user`、`assistant`、`tool_call`、`tool_result` 节点；助手思考块由 [stripAssistantThinking](../../src/utils/assistant-text.ts) 移除，节点正文经过 XML 转义。总结请求不携带工具，也不执行工具调用。

成功后同步替换 Agent 历史与终端早期条目，本地估算新上下文长度，保留主请求的缓存数据，待下次主请求返回时校正。总结失败或无有效正文时保留原历史和用量；没有早期用户回合时不发起总结。相邻两次压缩之间没有新增回合时不重复总结。

模型调用见[模型适配](model-adapter.md)，文本拆分与事件展示见[终端交互](terminal-ui.md)，具体工具见[文件读写](file-tools.md)、[命令执行](terminal-tool.md)及[网页抓取](web-fetch.md)。
