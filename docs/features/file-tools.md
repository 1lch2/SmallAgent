# 文件读写与工作目录路径权限

[返回功能索引](../feature-map.yaml)

覆盖状态：已核对工具注册、读写入口与共享路径检查。最近核对：2026-10-13。未执行文件操作或权限场景验收。

## 入口与关键实现

- [src/tools/file-read.ts](../../src/tools/file-read.ts)：`fileReadTool` 注册 `file_read`；`fileRead` 解析目标路径、检查权限并读取 UTF-8 文本。
- [src/tools/file-write.ts](../../src/tools/file-write.ts)：`fileWriteTool` 注册 `file_write`；`fileWrite` 检查路径后以 UTF-8 创建或覆盖文件，不创建父目录。
- [src/utils/path.ts](../../src/utils/path.ts)：`resolvePath` 将相对路径关联到调用方传入的 `cwd`。
- [src/hook/usePermission.ts](../../src/hook/usePermission.ts)：`usePermission` 是异步路径权限函数，不是 React Hook；以 `process.cwd()` 的真实路径为根，检查一个或多个路径。
- [src/tools/index.ts](../../src/tools/index.ts)：工具注册与错误文本转换，公共分派流程见[Agent 循环](agent-loop.md)。

## 调用链与权限边界

`executeTool` → `fileRead` / `fileWrite` → `resolvePath` → `usePermission` → `fs.readFile` / `fs.writeFile`。

已存在路径通过 `realpath` 检查真实目标是否在根内；目标不存在时检查其父目录真实路径，目标存在但无法解析的情况拒绝访问。权限失败通过异常交给分派器转换为模型可见文本。

路径解析使用 Agent 传入的 `cwd`，权限根使用进程工作目录；当前[启动入口](cli-startup.md)将两者设为同一目录。文件写入前先读取是工具描述中的模型指令，执行函数没有强制这一顺序。该权限函数也被[命令执行](terminal-tool.md)复用。

## 验证入口与待补充范围

现有静态检查入口为 `npm run typecheck`，模型工具入口为 `npm start`。未发现对应自动化测试；目录外路径、符号链接、文件不存在及写入失败等实际行为未运行核验。
