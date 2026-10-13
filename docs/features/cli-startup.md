# CLI 启动、环境配置与本地构建

[返回功能索引](../feature-map.yaml)

覆盖状态：已核对入口及启动、构建主链路。最近核对：2026-10-13。未执行实际启动、构建或安装包验收。

## 入口与关键实现

- [src/index.tsx](../../src/index.tsx)：加载 `dotenv/config`，检查 `OPENAI_BASE_URL`、`SMALLAGENT_MODEL`，传递可选的 `OPENAI_API_KEY`，创建 `OpenAILLM` 和 `Agent`，使用 Ink 渲染 `App`。初始化失败时输出错误并退出。
- [package.json](../../package.json)：定义 Node.js 最低版本、开发脚本和 `smallagent` CLI 入口。
- [scripts/build.mjs](../../scripts/build.mjs)：使用 esbuild 将入口打包为 Node.js ESM 文件 `dist/smallagent.js`，保留外部包依赖并添加 CLI shebang。

## 调用链与边界

`npm start` → `tsx src/index.tsx` → 模型适配器与 Agent 初始化 → `render(<App />)`。

启动时使用 `process.cwd()` 作为 Agent 工作目录；输出为 TTY 时清除可见内容和历史缓冲区。模型连接见[模型适配](model-adapter.md)，终端渲染见[终端交互](terminal-ui.md)。

## 验证入口与待补充范围

现有命令为 `npm start`、`npm run typecheck` 和 `npm run build`；本专题没有对应的自动化测试入口。发布流程、安装包分发与编辑器调试配置未纳入本专题。
