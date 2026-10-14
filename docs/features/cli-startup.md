# CLI 启动与本地构建

[返回功能索引](../feature-map.yaml)

覆盖状态：已核对入口及启动、构建、退出主链路；构建和 Windows PowerShell PTY 退出检查通过。最近核对：2026-10-14。未执行安装包验收。

## 入口与关键实现

- [src/index.tsx](../../src/index.tsx)：使用 Ink 渲染 `ProviderSession` 包裹的 `App`；不加载 `.env`，也不检查模型、端点或密钥环境变量。
- [src/ui/ProviderSession.tsx](../../src/ui/ProviderSession.tsx)：首次启动允许未连接；有本地已选连接时直接使用保存的端点、模型和凭据，不发验证请求、查询模型或刷新缓存，详细保存和连接边界见[Provider](providers.md)。
- [package.json](../../package.json)：定义 Node.js 最低版本、开发脚本和 `smallagent` CLI 入口。
- [scripts/build.mjs](../../scripts/build.mjs)：使用 esbuild 将入口打包为 Node.js ESM 文件 `dist/smallagent.js`，保留外部包依赖并添加 CLI shebang。

## 调用链与边界

`npm start` → `tsx src/index.tsx` → `render(<ProviderSession><App /></ProviderSession>)` → 读取本地已选连接并初始化适配器与 Agent，或进入未连接状态。启动不执行联网连接校验。

启动时使用 `process.cwd()` 作为 Agent 工作目录；输出为 TTY 时清除可见内容和历史缓冲区。Ink 退出后入口等待卸载完成，暂停 stdin、恢复非 raw 输入模式，清除 TUI 可见内容和历史缓冲区并恢复光标；等待 stdout 写入完成后结束 CLI 进程，不等待残留请求或活动句柄。该流程共用于 `/quit` 和 Ctrl+C，非 TTY 输出不写入清屏序列。进程退出不保证已启动的外部子进程或远端任务被取消。模型连接见[模型适配](model-adapter.md)，终端渲染见[终端交互](terminal-ui.md)。

## 验证入口与待补充范围

现有命令为 `npm start`、`npm run typecheck` 和 `npm run build`；本专题没有对应的自动化测试入口。发布流程及安装包分发见[GitHub Actions 发布](release.md)，编辑器调试配置未纳入本专题。
