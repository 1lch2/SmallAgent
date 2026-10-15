# Agent 对话历史、工具循环与系统提示词

[返回功能索引](../feature-map.yaml)

覆盖状态：已核对入口、历史状态归属及模型与工具循环。最近核对：2026-10-15。

## 入口与关键实现

- [src/core/agent.ts](../../src/core/agent.ts)：统一定义 `BaseAgent`、`MainAgent` 与相关类型。`BaseAgent` 持有对话历史，默认只注入基本提示词，不加载工具、skill 或 AGENTS.md；`send` 驱动循环，通过 `AgentUpdate` 回调推送回复、思考、工具事件、用量和错误，工具定义与执行由子类接入。`MainAgent extends BaseAgent`，装配全部工具、skill 元数据、用户及工作区 AGENTS.md，并向工具分派器传递当前权限与已注册 skill 路径。
- [src/core/prompt.ts](../../src/core/prompt.ts)：`buildSystemPrompt` 只生成通用要求与工作目录、本地日期、Shell 环境；`buildToolsPrompt` 接收工具名称与描述，`buildSkillsPrompt` 接收 skill 元数据，`buildInstructionsPrompt` 读取并生成用户及工作区 AGENTS.md 指令，各部分由调用方独立组合。
- [src/core/skills.ts](../../src/core/skills.ts)：`loadSkills` 发现工作区 `.agents/skills/` 与用户目录 `.liberi/skills/` 下的 SKILL.md，解析 frontmatter 的 `name`、`description` 并保存绝对 `path`；同名时保留工作区版本。
- [src/tools/index.ts](../../src/tools/index.ts)：注册四个工具，导出模型可见的 `tools`，由 `executeTool` 按名称分派；未知工具和执行异常转换为结果文本。
- [src/types.ts](../../src/types.ts)：定义模型无关的 `LLM`、消息和工具协议。
- [src/utils/error.ts](../../src/utils/error.ts)：统一将错误转换为文本。

## 调用链与状态边界

`ProviderSession` 创建 `MainAgent`；`App.handleSubmit` → 继承的 `BaseAgent.send` → `llm.complete` → 记录助手消息、推送文本块 → 逐个调用 `MainAgent.executeTool` → 公共工具分派器 → 记录对应 `callId` 的工具结果 → 再次请求模型。没有工具调用时本轮结束。

工具参数的 JSON 解析失败时使用空对象。模型请求失败时推送 `error` 事件并结束本轮；工具失败文本仍进入历史并反馈模型。完整历史由 Agent 实例维护，UI 维护展示条目，两者职责不同。

`BaseAgent.model` 从当前 `LLM.model` 读取名称及上下文限制，不重复维护模型状态；`setLLM` 保留历史并切换这份元信息。数据来源见[模型适配](model-adapter.md)与[Provider](providers.md)。

MainAgent 初始化时接收权限模式，默认 `workspace-write`；每次工具执行向分派器传递当前模式。回合结束后可更新 `MainAgent.permission`，不修改系统提示词或历史；基本提示词不包含权限模式，工具行为说明由各自描述提供。配置入口见[设置配置](settings.md)。

MainAgent 在初始化时按“基本提示词 → 工具描述 → skill 元数据 → AGENTS.md”组合系统提示词；只在初始化时读取文件，不随文件修改刷新。工具提示词仅包含传入的工具名称与描述，不预设文件、Shell 或网页能力；Shell 用法及网页读取说明随对应工具描述提供。

Skill 元数据在 MainAgent 初始化时加载一次并注入 `<skills>`，只包含 `name`、`description`、`path`，不注入 Markdown 正文；使用指引要求模型先用 `file_read` 读取对应的完整 SKILL.md。

同一份注册结果同时用于提示词与工具读取许可，规则见[文件读写](file-tools.md)。

模型调用见[模型适配](model-adapter.md)，文本拆分与事件展示见[终端交互](terminal-ui.md)，具体工具见[文件读写](file-tools.md)、[命令执行](terminal-tool.md)及[网页抓取](web-fetch.md)。
