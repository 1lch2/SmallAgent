# Shell 命令执行与 PowerShell、Bash 路径检查

[返回功能索引](../feature-map.yaml)

覆盖状态：已核对命令分派、Shell 选择与路径检查主链路。最近核对：2026-10-15。

## 入口与关键实现

- [src/tools/terminal-run.ts](../../src/tools/terminal-run.ts)：`terminalRunTool` 注册 `terminal_run`；`terminalRun` 检查权限后在指定工作目录执行命令。PowerShell 和 Bash 使用 `execFile`，CMD 与 sh 保留 `exec`。
- [src/utils/command-permission/terminal-permission.ts](../../src/utils/command-permission/terminal-permission.ts)：独立入口 `checkTerminalCommandPermission`，为 PowerShell 和 Bash 分派路径检查。
- [src/utils/command-permission/powershell-paths.ts](../../src/utils/command-permission/powershell-paths.ts)：用 PowerShell 原生 AST 与静态参数绑定识别路径，分析进程不执行传入命令。
- [src/utils/command-permission/bash-paths.ts](../../src/utils/command-permission/bash-paths.ts)：`getBashPaths` 用受限词法分析识别路径；`getBashEnvironment` 清理会改变启动行为的环境变量与导出函数，供分析和实际执行共用。
- [src/utils/shell.ts](../../src/utils/shell.ts)：`getCurrentShellInfo` 在 Windows 优先选择 PowerShell 7，其次 Windows PowerShell，最后 CMD；非 Windows 优先已存在的 Bash，否则使用 `/bin/sh`。
- [src/core/prompt.ts](../../src/core/prompt.ts)：根据同一 Shell 选择函数生成命令用法说明，提示词入口见[Agent 循环](agent-loop.md)。

## 权限边界

`executeTool` → `terminalRun` → `checkTerminalCommandPermission` → `getPowerShellPaths` / `getBashPaths` → `execFile` / `exec`。工具注册及异常转换由[公共分派器](agent-loop.md)负责。

路径检查用于默认的 `workspace-write` 模式：以工作目录真实路径为根逐项检查目标路径，不存在的路径向上查找最近存在的父目录，拒绝越界链接、断链和无法静态确认的动态形式。`full-access` 跳过该检查，沿用同一执行入口和 Shell 启动选项。配置入口见[设置配置](settings.md)。

检查只覆盖静态可确认的路径。变量路径、动态表达式、赋值、切换目录、嵌套 Shell、命令替换等会被拒绝，因此部分合法命令需要改写成直接的路径参数。Bash 的递归链接、`find -exec`、`xargs` 等间接访问暂不支持。未知外部程序只检查静态显式路径；sh 与 CMD 跳过路径检查。

这是命令路径预检查，不是操作系统沙箱：外部程序与脚本内部的文件访问、程序自定义参数协议，以及检查与执行之间的文件系统变化都不受完整隔离。执行结果组合为 STDOUT / STDERR 文本，异常经工具分派器转换为错误文本。
