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

## 布局

```
src/
  index.tsx   启动入口：读取配置、组装 Agent 和 LLM、挂载 UI
  agent.ts    对话历史、工具执行循环和 UI 事件
  llm.ts      模型接口与消息、工具类型（不依赖 SDK）
  openai-llm.ts OpenAI 兼容接口的请求和协议转换
  tools/
    index.ts        工具执行入口：分发调用、统一处理错误
    definitions.ts  工具名称、描述和参数定义
    file-read.ts    读取文件
    file-write.ts   写入文件
    terminal-run.ts 执行命令
  ui/
    app.tsx         输入、忙碌状态和消息列表
    message.tsx     单条消息展示及展示类型
    format.ts       参数格式化、工具输出截断
  utils/
    path.ts         路径解析
    error.ts        错误文本转换
```

Agent 通过构造参数接收 `LLM`，只调用 `complete({ messages, tools })`。
API key、端点、模型以及 OpenAI SDK 响应处理都留在 `OpenAILLM` 中。

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
