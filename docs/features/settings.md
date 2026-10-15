# Agent 设置与统一配置文件

[返回功能索引](../feature-map.yaml)

覆盖状态：已核对命令入口、设置读写、模型选择与总结模型链路。最近核对：2026-10-15。subagent model 用于上下文总结，未接入独立子任务 Agent。

## 入口与关键实现

- [src/hook/useCommands.ts](../../src/hook/useCommands.ts)：注册 `/config`，执行会话的 `openConfig`。
- [src/ui/ConfigList.tsx](../../src/ui/ConfigList.tsx)：通过通用 List 展示 `subagent model` 和 `permission`、灰色说明与当前值；回车打开对应选择页，Esc 返回聊天。
- [src/ui/PermissionList.tsx](../../src/ui/PermissionList.tsx)：展示“工作区写入”和“完全许可”，默认选中当前模式；回车保存并返回设置页，Esc 取消，对话忙碌时禁止确认切换。显示名称由 `PERMISSION_LABELS` 提供，对应持久化值为 `workspace-write` / `full-access`。
- [src/ui/List.tsx](../../src/ui/List.tsx)：通用列表组件，`ListItem` 提供 `label`、可选 `comment` 与 `value`。
- [src/ui/ModelList.tsx](../../src/ui/ModelList.tsx)：`target="subagent"` 复用当前 Provider 的模型清单，并按已保存的 subagent 模型定位；回车保存后返回设置页，Esc 取消并返回设置页。没有连接时提示先使用 `/provider`。
- [src/ui/ProviderSession.tsx](../../src/ui/ProviderSession.tsx)：维护设置、页面和连接；`selectSubagentModel` 保存总结模型，`createCompactLLM` 按当前 Provider 的端点和凭据创建独立总结适配器，不切换聊天模型；`selectPermission` 保存模式后更新 `MainAgent.permission`，启动时也向 MainAgent 传入保存的模式。
- [src/core/settings.ts](../../src/core/settings.ts)：全局配置管理入口，统一 Agent 设置、Provider 连接保存、模型缓存和临时产物位置。`Settings` 保存当前 Provider、连接、可选 `subagentModel` 和 `permission`；`loadSettings` 与 `saveSettings` 读写 `~/.liberi/settings.json`。`USER_DATA_DIRECTORY`、`SETTINGS_FILENAME`、`SETTINGS_FILE`、`TMP_DIRECTORY`、`STORAGE_PATHS` 与 `PERMISSION_LABELS` 提供存储位置和界面名称常量。

## 保存与行为边界

默认设置文件为用户主目录下的 `~/.liberi/settings.json`，也是用户目录中唯一保存 Agent 配置与凭据的文件；缺少 `permission` 时按 `workspace-write` 处理。启动只读取，不迁移写入；下一次保存设置、连接或模型时写入文件。该文件同时是[文件读取](file-tools.md)唯一排除的凭据文件。

`loadSettings` 在读取时将旧内置 Provider ID 转换为对应的 models.dev ID，同时转换已选供应商标识；保留端点、模型 ID、凭据及其他设置，下次保存时使用新 ID。模型名称与上下文限制保存在模型清单缓存中，不写入凭据配置。

模型清单缓存与网页正文临时文件统一放在 `~/.liberi/tmp` 下，运行时不在工作区以外新增其他写入位置。临时产物没有清理机制。

Provider 保存连接、切换聊天模型或删除连接时保留 `subagentModel`；设置总结模型时保留已有 Provider 配置。`subagentModel` 保存当前 Provider 清单中的模型 ID，供 `/compact` 使用；没有独立 subagent Provider 配置或子任务执行能力。总结时的容量判断与回退见[上下文压缩](agent-loop.md)。

`permission` 的“工作区写入”保留文件真实路径与 Shell 命令路径检查；“完全许可”跳过这些限制，但仍受操作系统权限约束。模式保存保留 Provider 和 subagent 设置，切换不重置 Agent 历史或 Token 用量。读取旧值 `workspace` 时转换为 `workspace-write`，后续保存使用新 key。工具执行边界见[文件读写](file-tools.md)与[命令执行](terminal-tool.md)。

模型清单来源和缓存边界见 [Provider](providers.md)。聊天回合进行中仍可打开设置页。
