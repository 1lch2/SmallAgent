# Agent 对话历史、工具循环与系统提示词

[返回功能索引](../feature-map.yaml)

覆盖状态：已核对入口、历史状态归属及模型与工具循环；权限模式已通过模拟模型驱动的实际工具回合检查。最近核对：2026-10-15。未执行真实模型服务的回合验收。

## 入口与关键实现

- [src/core/agent.ts](../../src/core/agent.ts)：`Agent` 持有对话历史，`send` 追加用户消息并驱动循环，通过 `AgentUpdate` 回调推送回复、思考、工具事件、用量和错误。
- [src/core/prompt.ts](../../src/core/prompt.ts)：`buildSystemPrompt` 在 Agent 初始化时注入工作目录、宿主本地日期和实际用于执行命令的 Shell 信息，并依次读取用户主目录（`homedir()`）和工作目录根部的 `AGENTS.md`。每份内容按 `# AGENTS.md instructions for {目录}` 与独立的 `<INSTRUCTIONS>` 块包裹，追加到默认提示词末尾；两份文件都存在时，用前后各两个空行的 `--- project-doc ---` 分隔。缺失的文件跳过，其他读取错误继续抛出。内容在初始化时读取，不随文件修改自动刷新。
- [src/core/skills.ts](../../src/core/skills.ts)：`loadSkills` 发现工作区 `.agents/skills/<目录>/SKILL.md` 和用户主目录 `.liberi/skills/<目录>/SKILL.md`，解析 YAML frontmatter 中的非空 `name`、`description` 并保存绝对 `path`。两个目录都加载，按 `name` 去重并优先保留工作区版本，不依赖目录名；缺失目录或文件跳过，无效 frontmatter 发出警告并跳过，其他读取错误抛出。
- [src/tools/index.ts](../../src/tools/index.ts)：注册四个工具，导出模型可见的 `tools`，由 `executeTool` 按名称分派；未知工具和执行异常转换为结果文本。
- [src/types.ts](../../src/types.ts)：定义模型无关的 `LLM`、消息和工具协议。
- [src/utils/error.ts](../../src/utils/error.ts)：统一将错误转换为文本。

## 调用链与状态边界

`App.handleSubmit` → `Agent.send` → `llm.complete` → 记录助手消息、推送文本块 → 逐个 `executeTool` → 记录对应 `callId` 的工具结果 → 再次请求模型。没有工具调用时本轮结束。

工具参数的 JSON 解析失败时使用空对象。模型请求失败时推送 `error` 事件并结束本轮；工具失败文本仍进入历史并反馈模型。完整历史由 Agent 实例维护，UI 维护展示条目，两者职责不同。

Agent 初始化时接收权限模式，默认 `workspace-write`；每次工具执行向分派器传递当前模式。`setPermission` 在回合结束后更新模式及系统提示词的 `<permission>` 标记，保留历史和已读取的 AGENTS.md 内容。配置入口见[设置配置](settings.md)。

Skill 元数据在 Agent 初始化时加载一次。`buildSystemPrompt` 在 `<tools>` 后、AGENTS.md 指令前注入 `<skills>`，其中 `<available_skills>` 的各个 `<skill>` 仅包含 XML 转义后的 `name`、`description`、`path`，不注入 Markdown 正文；没有可用 skill 时不追加该块。使用指引要求模型在任务匹配时先通过 `file_read` 读取对应的完整 SKILL.md，再按正文执行，相关相对路径以 SKILL.md 所在目录为基准，其他文件按需读取并遵循现有权限。

同一份注册结果同时用于提示词与工具读取许可。工作区权限下，`file_read` 可额外只读访问注册列表中的 SKILL.md；被工作区版本覆盖的用户 skill 不加入列表，用户 skill 的其他文件也不自动放行，写入权限不变。切换模型或权限时保留已注册列表，目录变动需要新建 Agent 才能重新发现。

模型调用见[模型适配](model-adapter.md)，文本拆分与事件展示见[终端交互](terminal-ui.md)，具体工具见[文件读写](file-tools.md)、[命令执行](terminal-tool.md)及[网页抓取](web-fetch.md)。

## 验证入口与待补充范围

现有静态检查入口为 `npm run typecheck`，交互入口为 `npm start`。未保留本专题对应的自动化测试；权限工具回合检查见[设置配置](settings.md)，真实模型异常和多轮上下文仍需实际服务验收。
