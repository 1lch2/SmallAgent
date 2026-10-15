# Agent 设置与统一配置文件

[返回功能索引](../feature-map.yaml)

覆盖状态：已核对命令入口、设置读写与模型选择链路，并通过 Ink 模拟终端检查。最近核对：2026-10-14。未实现 subagent 执行功能，未使用真实服务商或真实终端验收。

## 入口与关键实现

- [src/hook/useCommands.ts](../../src/hook/useCommands.ts)：注册 `/config`，执行会话的 `openConfig`。
- [src/ui/ConfigList.tsx](../../src/ui/ConfigList.tsx)：通过通用 List 展示 `subagent model` 和 `permission`、灰色说明与当前值；回车打开对应选择页，Esc 返回聊天。
- [src/ui/PermissionList.tsx](../../src/ui/PermissionList.tsx)：展示“工作区写入”和“完全许可”，默认选中当前模式；回车保存并返回设置页，Esc 取消，对话忙碌时禁止确认切换。显示名称由 `permissionLabels` 提供，对应持久化值为 `workspace-write` / `full-access`。
- [src/ui/List.tsx](../../src/ui/List.tsx)：`ListItem` 提供 `label`、可选 `comment` 与 `value`。标签与灰色说明靠左，中间保留一个空格；值靠列表右侧对齐并保留右侧留白。含值的列表宽度上限为 100 列，并随父容器缩小，避免在宽终端中将值推至终端最右侧；没有值时沿用父容器宽度。
- [src/ui/ModelList.tsx](../../src/ui/ModelList.tsx)：`target="subagent"` 复用当前 Provider 的模型清单，并按已保存的 subagent 模型定位；回车保存后返回设置页，Esc 取消并返回设置页。没有连接时提示先使用 `/provider`。
- [src/ui/ProviderSession.tsx](../../src/ui/ProviderSession.tsx)：维护设置、页面和连接；`selectSubagentModel` 保存模型，不切换当前聊天模型或创建 subagent；`selectPermission` 保存权限模式后调用 `Agent.setPermission`，启动时也向 Agent 传入保存的模式。
- [src/core/settings.ts](../../src/core/settings.ts)：全局配置管理入口，统一 Agent 设置、Provider 连接保存、模型缓存和临时产物位置。`Settings` 保存当前 Provider、连接、可选 `subagentModel` 和 `permission`；缺少权限字段时默认为 `workspace-write`，另一有效值为 `full-access`。`loadSettings` 和 `saveSettings` 统一读写 `~/.liberi/settings.json`，内部 `writeJSON` 供配置及模型缓存共用原子 JSON 写入。`tmpDirectory` 定义为 `~/.liberi/tmp`，`StoragePaths` 与 `storagePaths` 在此基础上给出 `configFile` 与 `cacheDirectory`（`~/.liberi/tmp/models`）。

## 保存与行为边界

默认设置文件为用户主目录下的 `~/.liberi/settings.json`。文件缺失时读取同目录旧 `providers.json`，二者均缺失时返回空连接清单。启动只读取，不迁移写入；下次保存设置、连接或模型时写入新文件，保留旧文件。已有 `settings.json` 的读取或格式错误正常报告，不回退到旧文件。

落在用户目录之外的临时产物统一改放 `~/.liberi/tmp`，不再写入系统临时目录：模型清单缓存为 `~/.liberi/tmp/models`，网页正文临时文件为 `~/.liberi/tmp/web`。原有系统临时目录中的缓存不再被读取，需要时按缺少缓存重新获取。除用户主目录外，运行期不新增工作区以外的写入位置。临时产物没有 TTL 清理。

Provider 保存连接、切换聊天模型或删除连接时保留 `subagentModel`；设置 subagent 模型时保留已有 Provider 配置。`subagentModel` 仅保存模型名称，当前使用已连接 Provider 的清单，不包含独立 subagent Provider 配置或运行能力。

`permission` 的说明为“agent权限审批模式”。“工作区写入”保留现有文件真实路径与 Shell 命令路径检查；“完全许可”跳过这些工作区限制，但文件操作和命令执行仍受当前操作系统权限约束。没有新增逐次交互审批流程。模式保存保留 Provider 和 subagent 设置，切换不重置 Agent 历史或 Token 用量。工具执行边界见[文件读写](file-tools.md)与[命令执行](terminal-tool.md)。读取旧值 `workspace` 时转换为 `workspace-write`，后续保存使用新 key，启动不改写文件。

模型清单来源和缓存边界见 [Provider](providers.md)。聊天回合进行中仍可打开设置页，但模型选择页沿用等待当前回合结束后确认的规则。

## 验证入口

静态检查为 `npm run typecheck`，交互入口为 `npm start`。本次使用临时目录和模拟终端检查 `/config`、保存与取消、重启恢复、旧配置读取、Provider 操作保留设置及宽窄列表布局；验证脚本不保留，真实终端表现未核验。

权限模式另通过模拟终端与实际 Agent 工具循环验证默认值、保存、取消、重启恢复、忙碌时禁止切换、目录外文件读写及 PowerShell 命令的拒绝／放行，以及 Toolbar 颜色和原用量文本。新增模式未单独运行 Bash、CMD 或 sh 验收。
