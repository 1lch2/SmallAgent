# Liberi Code

学习 Agent 开发练手项目，别用。

## 快速开始

```bash
npm install
cp .env.example .env       # 然后填写你的 API key / 端点 / 模型
npm start
```

输入任务，按 Enter 执行。按 `Ctrl+C` 退出。

中文输入有问题，终端不显示当前输入字符，只能凭感觉敲字。

## 连接API

当前支持 OpenAI Chat Completion 格式的 API 端点，可以通过内置命令 `/provider` 连接以下供应商或者自定义的API端点：

- DeepSeek
- MiniMax（API 和 Token Plan）
- 智谱 GLM（API 和 Coding Plan）
- 小米 MiMo（API 和 Token Plan）
- Kimi（API 和 Coding Plan）
- OpenAI（官方）
- OpenAI Chat Completion 兼容端点

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
- `npm run format` — 使用项目 Prettier 配置格式化文件
- `npm run format:check` — 检查文件格式

## 开发约定

`npm install` 会安装项目依赖并通过 Husky 注册 Git hook。提交信息使用 Conventional Commits 基础格式：`type: 描述`，支持可选 scope 和破坏性变更标记，例如 `feat(provider): 添加供应商`、`fix!: 修复连接行为`。只检查类型和描述是否符合基础结构，不限制类型列表、大小写或消息长度。

项目在 `.codex/hooks.json` 配置了 Codex `Stop` hook，每次任务结束时自动执行 Prettier 格式化，使用现有 `.prettierrc` 和 `.prettierignore`。首次使用时需信任项目，并在 Codex 的 `/hooks` 中审阅、信任该 hook；修改 hook 定义后需重新信任。

## VSCode 配置

开发前请安装以下 VSCode 插件：

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


项目提供以下 VSCode 调试配置（`.vscode/launch.json`）：

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
