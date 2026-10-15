# 网页抓取与正文提取

[返回功能索引](../feature-map.yaml)

覆盖状态：已核对工具注册、抓取入口与返回文本组装。最近核对：2026-10-15。

## 入口与关键实现

- [src/tools/web-fetch.ts](../../src/tools/web-fetch.ts)：注册 `web_fetch`；`webFetch` 解析参数、校验目标地址、调用抓取提取并组装返回文本。工作区模式下无需额外权限。
- [src/utils/web-reader.ts](../../src/utils/web-reader.ts)：`readWebPage` 负责请求、跟随重定向、解码与正文提取；`errorBodyPreview` 提供非成功响应的响应体预览。
- [src/utils/private-network.ts](../../src/utils/private-network.ts)：`isPrivateAddress` 与 `isPrivateHostname` 判定环回、私网、链路本地和本机命名空间，供工具层做访问前置校验。
- [src/utils/format-text.ts](../../src/utils/format-text.ts)：`truncateBytes` 按 UTF-8 字节截断文本。
- [src/ui/Message.tsx](../../src/ui/Message.tsx)：`web_fetch` 的调用与结果都展示为单行青色摘要 `→ Fetch: {host}`。
- [src/ui/App.tsx](../../src/ui/App.tsx)：`web_fetch` 的结果事件不进入消息列表。

工具注册与异常转换由[公共分派器](agent-loop.md)负责，模型侧参数为 `url` 和可选 `timeout`。

## 行为要点

- 只处理服务端渲染的 HTML、纯文本与 Markdown。依赖客户端 JavaScript 渲染、需要登录或非文本类型的响应直接失败，并在错误文本中说明原因。
- 目标地址只允许 `http` 与 `https`，内网、环回与链路本地地址一律拒绝，重定向的每一跳都重新校验。
- 正文超过内联上限时写入 `~/.liberi/tmp/web/`，结果中返回预览与临时文件路径；目录位置由[设置配置](settings.md)的 `TMP_DIRECTORY` 统一提供。该目录同时是[文件读写](file-tools.md)的例外目录，可被模型读回。
- 非 2xx 响应不抛异常，而是返回状态、地址、响应类型与响应体预览，便于模型自我纠正。
- 抓取不复用文件工具的工作区路径检查，也不受 `permission` 模式影响。

## 范围

实现位于 `src/tools/` 与 `src/utils/`，不读取 `~/.liberi/settings.json`，没有自己的配置项与设置界面。
