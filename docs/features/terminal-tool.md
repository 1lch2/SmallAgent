# Shell 命令执行与 PowerShell、Bash 路径检查

[返回功能索引](../feature-map.yaml)

覆盖状态：已核对命令分派、Shell 选择与路径检查主链路，并通过 Windows PowerShell 7、WSL Ubuntu 24.04 Bash 5.2 工具入口验收。最近核对：2026-10-14。其他 Shell 未运行验收。

## 入口与关键实现

- [src/tools/terminal-run.ts](../../src/tools/terminal-run.ts)：`terminalRunTool` 注册 `terminal_run`；`terminalRun` 检查权限后在指定工作目录执行命令。PowerShell 和 Bash 使用 `execFile`，CMD 与 sh 保留 `exec`。
- [src/utils/command-permission/terminal-permission.ts](../../src/utils/command-permission/terminal-permission.ts)：独立入口 `checkTerminalCommandPermission`；PowerShell 与 Bash 共用 `cwd` 真实路径权限根，逐项检查真实目标，不存在的路径向上查找最近存在的父目录，拒绝越界链接和断链。Bash 路径保留链接后的 `..` 供真实路径解析；递归复制、删除及目录移动还检查源目录子项。
- [src/utils/command-permission/powershell-paths.ts](../../src/utils/command-permission/powershell-paths.ts)：使用 PowerShell 原生 AST、静态参数绑定和常量读取识别路径，检查通配符匹配项、重定向及递归文件操作的子项。分析进程不执行传入命令。
- [src/utils/command-permission/bash-paths.ts](../../src/utils/command-permission/bash-paths.ts)：`getBashPaths` 用受限词法分析拒绝动态语法，通过 Bash `-n` 校验语法，仅在固定辅助命令中展开已确认的静态词和通配符；按常用命令参数角色识别路径。`getBashEnvironment` 清理会改变启动行为的环境变量与导出函数，供分析和实际执行共用。
- [src/utils/shell.ts](../../src/utils/shell.ts)：`getCurrentShellInfo` 在 Windows 优先选择 PowerShell 7，其次 Windows PowerShell，最后 CMD；非 Windows 优先已存在的 Bash，否则使用 `/bin/sh`。
- [src/core/prompt.ts](../../src/core/prompt.ts)：根据同一 Shell 选择函数生成命令用法说明，提示词入口见[Agent 循环](agent-loop.md)。

## 调用链与权限边界

`executeTool` → `terminalRun` → `checkTerminalCommandPermission` → `getPowerShellPaths` / `getBashPaths` → `execFile` / `exec`。工具注册及异常转换由[公共分派器](agent-loop.md)负责。

上述路径检查用于默认的 `workspace-write` 权限模式；`full-access` 跳过 `checkTerminalCommandPermission`，沿用同一命令执行入口和 Shell 启动选项。配置入口见[设置配置](settings.md)。本次通过 Agent 工具循环验证了 PowerShell 目录外读取在工作区模式下拒绝、完全许可模式下执行成功；新增模式未单独执行其他 Shell 验收。

PowerShell 支持常量路径、参数缩写及冒号形式、路径数组、通配符、重定向、常见读写和遍历 Cmdlet。字符串内容参数不按路径处理。变量路径、动态表达式、隐式管道路径、赋值、切换目录、动态命令名、方法调用及嵌套 Shell 等不能可靠静态确认的形式被拒绝；这也会拒绝部分合法的动态命令，应改写成直接的路径参数。解析和执行均不加载 profile，执行输出使用 UTF-8。

Bash 支持常量及引号路径、转义、通配符、`;` / `&&` / `||`、管道、文件重定向和文件描述符复制。识别 `cat`、`ls`、`head`、`tail`、`grep`、`rg`、`find`、`cp`、`mv`、`rm`、`sort`、`tee` 等常用命令的路径、文本和数值参数；普通 `echo` / `printf` 文本不误判为路径，未引用的通配符展开仍检查路径。拒绝变量、命令/进程替换、赋值、切换目录、嵌套 Shell、后台任务、控制结构、here-doc、花括号展开及无法识别的关键参数形式。跟随递归链接、`find -exec`、`xargs`、`sed` / `awk` 脚本等间接访问暂不支持；这会拒绝部分合法 Bash 命令。Bash 检查不依赖额外解析包，也不执行待审核命令。

Bash 分析与执行均使用 `--noprofile --norc -p`，并清理 `BASH_ENV`、`ENV`、Shell 选项、导出函数等继承启动状态，避免它们改变路径和命令含义。用户 PATH 保留；通过用户脚本主动改变环境或访问文件仍属于脚本内部行为。

这是命令路径预检查，不是操作系统沙箱。外部程序及允许执行的脚本内部访问、程序自定义参数协议、模块行为，以及检查与执行之间的文件系统变化不受完整隔离。未知外部程序仅检查静态显式路径和现存文件名；sh、CMD 跳过终端路径检查。结果组合为 STDOUT / STDERR 文本，没有输出时返回提示；执行异常经工具分派器转换为错误文本。

## 验证入口与待补充范围

静态检查入口为 `npm run typecheck` 和 `npm run build`。通过真实 `terminalRun` 入口验证了 PowerShell 与 WSL Bash 的读取、遍历、脚本执行、写入、复制、重定向及越界拒绝；Bash 还覆盖启动环境注入、递归源目录及链接后的父目录访问。临时验收文件和夹具在验证结束后移除。Windows PowerShell 5.1、CMD、sh、macOS 和完整 CLI/真实模型链路未运行验收。
