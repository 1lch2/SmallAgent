# Shell 命令执行与显式路径检查

[返回功能索引](../feature-map.yaml)

覆盖状态：已核对命令分派、Shell 选择与显式路径检查主链路。最近核对：2026-10-13。未执行命令或跨平台验收。

## 入口与关键实现

- [src/tools/terminal-run.ts](../../src/tools/terminal-run.ts)：`terminalRunTool` 注册 `terminal_run`；`terminalRun` 提取命令路径、检查权限，并使用 `child_process.exec` 在指定工作目录执行命令。
- [src/utils/shell.ts](../../src/utils/shell.ts)：`getCurrentShellInfo` 在 Windows 优先选择 PowerShell 7，其次 Windows PowerShell，最后 CMD；非 Windows 优先已存在的 Bash，否则使用 `/bin/sh`。
- [src/hook/usePermission.ts](../../src/hook/usePermission.ts)：共享的工作目录路径检查，具体职责见[文件读写](file-tools.md)。
- [src/core/system-prompt.ts](../../src/core/system-prompt.ts)：根据同一 Shell 选择函数生成命令用法说明，提示词入口见[Agent 循环](agent-loop.md)。

## 调用链与权限边界

`executeTool` → `terminalRun` → `extractCommandPaths` → `usePermission` → `execAsync`。工具注册及异常转换由[公共分派器](agent-loop.md)负责。

内部定位符号：`tokenizeCommand` 处理引号与 Shell 转义；`getPathCandidates` 提取参数候选；`isPathLike` 识别显式路径；`resolveCommandPath` 处理相对路径、文件 URL 和主目录路径。HTTP URL 跳过检查，无法解析的路径或越出根目录的路径被拒绝。

检查对象是命令文本中可识别的显式路径，不能据此断言任意命令的文件访问都被隔离；没有识别到路径时仍可执行命令。结果组合为 STDOUT / STDERR 文本，没有输出时返回提示；执行异常经工具分派器转换为错误文本。

## 验证入口与待补充范围

现有静态检查入口为 `npm run typecheck`，模型工具入口为 `npm start`。未发现命令工具自动化测试；Shell 转义、动态表达式、各平台路径和执行失败等运行场景未核验。
