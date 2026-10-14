# 文件读写与工作目录路径权限

[返回功能索引](../feature-map.yaml)

覆盖状态：已核对工具注册、读写入口与共享路径检查；通过 Agent 工具循环验证工作区模式拒绝目录外读写、完全许可模式放行。最近核对：2026-10-14。符号链接等其他场景未在本次运行验收。

## 入口与关键实现

- [src/tools/file-read.ts](../../src/tools/file-read.ts)：`fileReadTool` 注册 `file_read`；`fileRead` 解析目标路径、检查权限并读取 UTF-8 文本。
- [src/tools/file-write.ts](../../src/tools/file-write.ts)：`fileWriteTool` 注册 `file_write`；`fileWrite` 检查路径后以 UTF-8 创建或覆盖文件，不创建父目录。
- [src/utils/path.ts](../../src/utils/path.ts)：`resolvePath` 将相对路径关联到调用方传入的 `cwd`。
- [src/hook/usePathValidation.ts](../../src/hook/usePathValidation.ts)：`usePathValidation` 是异步路径权限函数，不是 React Hook；以 `process.cwd()` 的真实路径为根，检查一个或多个路径。
- [src/tools/index.ts](../../src/tools/index.ts)：工具注册与错误文本转换，公共分派流程见[Agent 循环](agent-loop.md)。

## 调用链与权限边界

`executeTool` → `fileRead` / `fileWrite` → `resolvePath` → 工作区模式下 `usePathValidation` → `fs.readFile` / `fs.writeFile`。`permission` 默认 `workspace-write`；`full-access` 跳过路径检查，仍使用同样的路径解析与文件读写，实际访问受操作系统权限限制。配置入口见[设置配置](settings.md)。

已存在路径通过 `realpath` 检查真实目标是否在根内；目标不存在时检查其父目录真实路径，目标存在但无法解析的情况拒绝访问。权限失败通过异常交给分派器转换为模型可见文本。

路径解析使用 Agent 传入的 `cwd`，权限根使用进程工作目录；当前[启动入口](cli-startup.md)将两者设为同一目录。文件写入前先读取是工具描述中的模型指令，执行函数没有强制这一顺序。[命令执行](terminal-tool.md)使用独立的终端命令校验，在工作区模式下检查 PowerShell 和 Bash 命令，不复用此函数。

## 验证入口与待补充范围

现有静态检查入口为 `npm run typecheck`，模型工具入口为 `npm start`。未保留自动化测试；本次在临时目录验证目录外文件的拒绝与放行，符号链接、文件不存在及写入失败等其他行为未运行核验。
