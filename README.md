# Liberi Code

学习 Agent 开发的练手项目，别用。

## 快速开始

如果你真的很想品鉴下这个练手的毛坯，或者使用以后把我批判一番，那可以直接下载 release 的最新分发版本，用 node 运行压缩包里唯一一个 JS 文件就行。用完要删的话记得看看用户目录，把 `.liberi` 文件夹也删了。

如果你还有闲工夫 pull 代码，可以这么用。

```bash
npm install
npm start
```

输入任务，按 Enter 发送消息。

中文输入有问题，终端不显示当前输入字符，只能凭感觉敲字。在改了。

## 连接API

当前只支持 OpenAI Chat Completion 格式的 API 端点，可以通过内置命令 `/provider` 连接以下供应商或者自定义的API端点：

- DeepSeek
- MiniMax（API 和 Token Plan）
- 智谱 GLM（API 和 Coding Plan）
- 小米 MiMo（API 和 Token Plan）
- Kimi（API 和 Coding Plan）
- OpenAI（官方）
- OpenAI Chat Completion 兼容端点

Anthropic 格式和 OpenAI Responses 格式之后有空再搞吧，现在的又不是不能用。

## 工具

三个可用工具：

- **`file_read(path)`** — 读取文件（相对路径相对于当前工作目录解析）
- **`file_write(path, content)`** — 写入/覆盖文件
- **`terminal_run(command)`** — 从工作目录运行 shell 命令

典型 ReAct 循环：发送消息 → 如果模型返回工具调用，执行工具并将结果反馈回来 → 重复直到模型返回纯文本。

## UI

使用 Ink 开发 TUI，规范同 React，本项目约定也基本遵循一般的 React app 模式。

## 开发约定

Husky 会按照 Conventional Commit 规范检查 Commit 消息。

项目在 `.codex/hooks.json` 配置了 Codex `Stop` hook，每次任务结束时自动执行 Prettier 格式化，使用现有 `.prettierrc` 和 `.prettierignore`。首次使用时需信任项目，并在 Codex 的 `/hooks` 中审阅、信任该 hook；修改 hook 定义后需重新信任。

## VSCode 配置

开发前需要安装以下 VSCode 插件：

- [Prettier - Code formatter](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)（`esbenp.prettier-vscode`）
- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)（`dbaeumer.vscode-eslint`）

自动格式化配置，放置于项目级 VSCode 设置文件中 `.vscode/settings.json`

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "eslint.validate": ["typescript", "typescriptreact"],
  "js/ts.tsdk.path": "node_modules\\typescript\\lib"
}
```


VSCode 调试配置（`.vscode/launch.json`）：

```jsonc
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Liberi Code",
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
