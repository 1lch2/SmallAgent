# Provider 连接、模型选择与本地配置

[返回功能索引](../feature-map.yaml)

覆盖状态：已核对注册、选择、校验、保存、删除及本地启动初始化主链路，并通过本地 HTTP 服务与 Ink 模拟终端的 E2E 检查。最近核对：2026-10-14。未使用各厂商真实 API Key 验收全部端点。

## 入口与关键实现

- [src/providers/catalog.ts](../../src/providers/catalog.ts)：`providers` 注册内置服务商及自定义选项，包含 MiMo API／Token Plan、Kimi API／Coding Plan 和 OpenAI 官方；均使用 OpenAI Chat Completions 格式，自定义项不预设端点。API 与套餐使用独立 ID 保存配置及凭据。
- [src/hook/useCommands.ts](../../src/hook/useCommands.ts)：应用命令列表注册 `/provider` 和 `/model`，将会话的 `openProviders`、`openModels` 绑定为执行回调；`App` 将列表传给输入组件，由 [src/core/commands.ts](../../src/core/commands.ts) 通用分发器匹配执行。
- [src/ui/ProviderSession.tsx](../../src/ui/ProviderSession.tsx)：`ProviderSession` 管理连接、选项和页面状态；启动只读取用户目录配置，使用已保存端点、模型和 API Key 初始化适配器，不请求接口、不读取或刷新模型缓存、不改写配置。缺少已选连接时保持未连接状态。
- [src/hook/useProviderSession.ts](../../src/hook/useProviderSession.ts)：`useProviderSession` 提供共享状态读取入口，Hook 与 UI 组件分别归属 `src/hook` 和 `src/ui`。
- [src/ui/ProviderList.tsx](../../src/ui/ProviderList.tsx)：上下键选择服务商，回车展开输入；列表状态双按 D 删除选中项的已保存配置，区分已连接与已配置项。内置项输入 API Key；自定义项先输入基础地址，再输入 API Key。Key 使用掩码显示，连接失败保留页面供重试，Esc 返回列表或聊天。
- [src/ui/List.tsx](../../src/ui/List.tsx)：Provider 和模型页面共用的受控列表；接收标识、显示文本、选中位置及回调，负责上下键循环导航和回车确认，不依赖服务商会话。
- [src/ui/ModelList.tsx](../../src/ui/ModelList.tsx)：读取当前 Provider 的模型清单，默认定位并标记当前模型；确认保存后返回聊天，Esc 取消。加载或保存时禁用选择，当前对话结束前禁止切换；卸载后忽略未完成的清单读取结果。
- [src/providers/connect.ts](../../src/providers/connect.ts)：`fetchModelCatalog` 使用 SDK `models.list()` 或既有官方文档备用流程获取模型。主动通过 `/provider` 连接时，`connectProvider` 获取清单、选首个模型并发送最小 Chat Completions 请求校验，成功后保存；启动不调用这一流程。
- [src/providers/storage.ts](../../src/providers/storage.ts)：读写配置和临时模型清单，`saveProviderSettings` 原子保存完整配置，连接保存与配置删除共用该入口。写入通过临时文件重命名完成。文件以 `0600` 模式创建；Windows 文件访问受当前用户目录的 ACL 控制。
- [src/ui/App.tsx](../../src/ui/App.tsx)：根据会话展示聊天、`ProviderList` 或 `ModelList`；未连接时禁止发送模型请求，当前回合结束后才能切换连接或模型。切换使用 `Agent.setLLM` 保留历史，重置用量统计。

## 删除供应商配置

在 `/provider` 列表中选中已配置项，连续按两次 D（大小写均可）删除。第一次显示确认提示，移动选项或按其他键取消；API Key 和端点输入阶段不处理删除，对话忙碌、配置加载、连接和删除期间禁用删除。删除配置不移除内置供应商选项，之后仍可重新连接；不包含凭据的临时模型缓存保留。

`ProviderList` → `ProviderSession.removeProvider`：读取已保存配置并排除选中项，按 `providers` 的界面顺序找到剩余已配置供应商的第一项，优先读取其内存或磁盘模型清单，缺失时查询并缓存；使用清单的第一个模型。将删除结果、当前供应商和新模型一次保存成功后更新会话，列表定位到新供应商并保留当前聊天历史。即使删除的不是当前供应商，也按这一规则重新选择。

没有剩余配置时清空当前连接与 Agent 引用，返回 chat TUI，工具栏恢复“未连接任何模型”提示；界面已有消息保留，后续重新连接会创建新的 Agent 对话。清单查询或保存失败时不提交删除、不替换当前连接，停留列表显示错误，可重新双按 D 重试。

## 模型选择

`/model` → `ModelList` → `ProviderSession.loadModels`：优先使用当前连接的内存清单，再读取当前账号的磁盘缓存；缓存缺失或为空时调用 `fetchModelCatalog` 查询并保存。该流程仅在打开模型页面后运行，不改变启动时只读本地配置的行为。未连接时提示先使用 `/provider`；查询失败可 Esc 返回后重新进入。

上下键选择，回车调用 `ProviderSession.selectModel`：先保存选中模型，再替换当前适配器和连接状态，返回聊天；持久化失败时保留原连接与页面，可再次回车重试。确认当前模型只返回聊天，不重置连接或用量。Esc 取消不改变所选模型。App 和 Agent 保持挂载，消息与对话历史继续保留。

列表沿用 Provider 返回或文档记录的模型清单，不逐个探测模型权限；切换模型不发送额外校验消息，实际调用权限和兼容性由下一次聊天请求确认。

## 内置清单与官方来源

| Provider | Chat Completions 基础地址 | 模型清单 |
| --- | --- | --- |
| DeepSeek | `https://api.deepseek.com` | `GET /models` |
| MiniMax API | `https://api.minimax.cn/v1` | `GET /models` |
| MiniMax Token Plan | `https://api.minimax.cn/v1` | `GET /models` |
| GLM API | `https://open.bigmodel.cn/api/paas/v4` | 优先 `GET /models`，明确不支持时读取官方文档 |
| GLM Token Plan | `https://open.bigmodel.cn/api/coding/paas/v4` | 优先 `GET /models`，明确不支持时读取官方文档 |
| 小米 MiMo API | `https://api.xiaomimimo.com/v1` | `GET /models` |
| 小米 MiMo Token Plan | `https://token-plan-cn.xiaomimimo.com/v1` | 沿用兼容接口 `GET /models`，待真实套餐凭据验收 |
| Kimi API | `https://api.moonshot.cn/v1` | `GET /models` |
| Kimi Coding Plan | `https://api.kimi.com/coding/v1` | 沿用兼容接口 `GET /models`，待真实套餐凭据验收 |
| OpenAI 官方 | `https://api.openai.com/v1` | `GET /models` |
| OpenAI Chat Completion | 用户输入 | `GET /models` |

来源：[DeepSeek 接入](https://api-docs.deepseek.com/)、[DeepSeek 模型清单](https://api-docs.deepseek.com/api/list-models/)、[MiniMax OpenAI SDK](https://platform.minimax.cn/docs/api-reference/text-openai-api)、[MiniMax 模型清单](https://platform.minimax.cn/docs/api-reference/models/openai/list-models)、[MiniMax 套餐接入](https://platform.minimax.cn/docs/m-plan/other-tools)、[GLM OpenAI 兼容](https://docs.bigmodel.cn/cn/guide/develop/openai/introduction)、[GLM 套餐端点](https://docs.bigmodel.cn/cn/coding-plan/latest-model)、[OpenAI 模型列表协议](https://developers.openai.com/api/reference/resources/models/methods/list)。MiniMax 使用中国区端点，API 与套餐通过不同 Key 区分。GLM 的 Token Plan 选项对应厂商命名的 Coding Plan。

GLM 官方 OpenAPI 没有公开模型列表定义。仅在标准接口返回 404、405 或 501 时，按本任务确认的范围读取官方 Markdown 清单：普通 API 使用[模型概览](https://docs.bigmodel.cn/cn/guide/start/model-overview)，套餐使用[套餐模型说明](https://docs.bigmodel.cn/cn/coding-plan/latest-model)。解析文本及对话多模态模型，排除 OCR 等独立接口模型。缓存记录 `source: documentation`，不把该来源写成模型 API 返回；401、403、超时和网络失败不触发文档备用。

新增端点来源：[MiMo 首次调用 API](https://mimo.mi.com/docs/zh-CN/quick-start/summary/first-api-call)、[MiMo 模型列表](https://mimo.mi.com/docs/zh-CN/api/model/list-models)、[Kimi 官方接入与平台对比](https://www.kimi.com/code/docs/en/)、[OpenAI 模型列表](https://developers.openai.com/api/reference/resources/models/methods/list)。MiMo Token Plan 和 Kimi 使用中国区端点；其他区域可通过自定义兼容选项配置。套餐须使用对应套餐凭据。新增选项复用现有模型查询及首模型验证流程，不保证接口返回的所有模型均支持当前聊天与工具调用协议。

## 保存与缓存边界

- `~/.liberi/providers.json` 保存服务商 ID、端点、选中模型、API Key，以及当前选中的服务商。成功连接、确认新模型或删除配置时更新；删除仅移除目标配置，并更新自动选中的供应商与模型。Key 按用户要求保存在本机配置中。
- `os.tmpdir()/liberi-code/models/<连接摘要>.json` 保存模型 ID 清单、来源、端点和更新时间，不保存 API Key。摘要包含连接凭据以隔离不同账号的缓存。主动连接时重新获取并更新清单；`loadModelCatalog` 提供本地读取入口，启动不依赖缓存是否存在。
- 首个模型必须通过 Chat Completions 校验；接口失败、列表为空、模型无权限或保存失败均显示连接失败，不改变当前已连接的模型。
- 校验请求的输出限制为 16 token，仅确认调用成功；实际聊天使用现有适配器。错误提示不转发服务端原始正文，避免服务端回显凭据。
- 本地已保存的连接在启动时直接使用，不表示该次启动已验证凭据仍有效；请求失败由正常对话错误分支提示。适配器过滤错误正文中回显的 API Key。
- `/compact` 继续只注册。页面卸载不取消已有请求；退出 CLI 会在 Ink 卸载后清理终端并结束进程，详见[终端交互](terminal-ui.md)。

## 验证入口

静态检查为 `npm run typecheck` 和 `npm run build`，交互入口为 `npm start`。开发期间已使用本地 HTTP 服务和模拟终端核验连接及本地启动行为，仓库不保留该验证脚本；真实厂商连接与终端表现仍需通过实际运行验收。
