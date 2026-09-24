# SmallAgent

纯自娱自乐的极简的终端代理工具。只有最基础能力：读写文件，运行命令。

目前没有 Skill 或 MCP 接入。文件工具只允许访问工作目录内、且当前进程具有相应读写权限的路径；`terminal_run` 可以执行任意 shell 命令，仍可能访问或删除其他文件，请谨慎使用。

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
修改 agent 逻辑时可以注入固定回复，无需配置端点或访问网络：

```ts
import { Agent } from './src/agent';
import type { LLM } from './src/llm';

const llm: LLM = {
  async complete({ messages }) {
    return { role: 'assistant', content: `收到 ${messages.length} 条消息` };
  },
};
const agent = new Agent({ llm, cwd: process.cwd() });
await agent.send('hello', console.log);
```

替换模型服务时实现同一个 `LLM` 接口即可，agent 和工具代码不需要依赖新服务的 SDK。

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
