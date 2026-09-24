# SmallAgent

纯自娱自乐的极简 CLI Agent。只有最基础能力：读写文件，运行命令。

目前通过权限hook限制工具调用范围为当前工作目录，但依然可能乱写你的文件，不要让任何模型或者 harness 调用这里的工具搞一些你不知道的事。

## 快速开始

```bash
npm install
cp .env.example .env       # 然后填写你的 API key / 端点 / 模型
npm start
```

输入任务，按 Enter 执行。按 `Ctrl+C` 退出。

中文输入有问题，终端不显示当前输入字符，只能凭感觉敲字。

## 配置

所有配置都通过环境变量进行（在项目根目录的 `.env` 文件也可以）：

| 变量               | 必需 | 说明                                                   |
| ------------------ | ---- | ------------------------------------------------------ |
| `OPENAI_BASE_URL`  | 是   | 任意 OpenAI Chat Completion 兼容端点                   |
| `SMALLAGENT_MODEL` | 是   | 传递给聊天完成 API 的模型 ID。无默认值。               |
| `OPENAI_API_KEY`   | 否   | 端点鉴权用的 key。本地服务等不需要鉴权的端点可以不设； |

## 工具

三个可用工具：

- **`file_read(path)`** — 读取文件（相对路径相对于当前工作目录解析）
- **`file_write(path, content)`** — 写入/覆盖文件
- **`terminal_run(command)`** — 从工作目录运行 shell 命令

代理的运行循环如下：发送 → 如果模型返回工具调用，执行它们并将结果反馈回来 → 重复直到模型返回纯文本。

## UI

使用 Ink 开发 TUI，规范同 React，本项目约定也基本遵循一般的 React app 模式。

## Scripts

- `npm start` — 运行代理
- `npm run typecheck` — 进行类型检查但不输出结果

## VSCode 调试配置

项目提供以下 VSCode 调试配置（`.vscode/launch.json`）：

```jsonc
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run SmallAgent",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "tsx",
      "program": "${workspaceFolder}/src/index.tsx",
      "envFile": "${workspaceFolder}/.env",
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen",
      "skipFiles": ["<node_internals>/**", "node_modules/**"],
    },
  ],
}
```
