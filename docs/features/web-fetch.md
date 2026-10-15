# 网页抓取与正文提取

[返回功能索引](../feature-map.yaml)

覆盖状态：已核对工具注册、抓取与提取链路、内网地址判定和返回值组装；通过工具入口对真实公网响应验收静态文章页、纯文本、短 HTML 页和各类失败分支。最近核对：2026-10-15。非 UTF-8 站点、重定向、临时文件失败与 DNS 相关场景未运行验收。本轮不接入任何远程读取服务。

## 入口与关键实现

- [src/tools/web-fetch.ts](../../src/tools/web-fetch.ts)：注册 `web_fetch`；`webFetch` 解析参数、校验目标地址、调用抓取提取并组装返回文本，超长正文写入临时文件。工作区模式下无需额外权限，`execute` 忽略 `cwd` 与 `permission`。
- [src/utils/web-reader.ts](../../src/utils/web-reader.ts)：`readWebPage` 负责请求、跟随重定向、按编码解码与正文提取；`errorBodyPreview` 提供非成功响应的响应体预览。
- [src/utils/private-network.ts](../../src/utils/private-network.ts)：`isPrivateAddress` 与 `isPrivateHostname` 判定环回、私网、链路本地和本机命名空间，供工具层做访问前置校验。
- [src/utils/format.ts](../../src/utils/format.ts)：`truncateBytes` 按 UTF-8 字节截断文本，用于响应体预览和临时文件写入上限。
- [src/ui/Message.tsx](../../src/ui/Message.tsx)：`web_fetch` 的调用与结果都展示为单行青色摘要 `→ Fetch: {host}`。
- [src/ui/App.tsx](../../src/ui/App.tsx)：`web_fetch` 的结果事件不进入消息列表，避免长正文在终端重复渲染。

## 抓取链路与取值

`executeTool` → `webFetch` → `assertPublicUrl` → `readWebPage` → `requestWithRedirects` → `readBodyLimited` → `decodeBytes` → `extractArticle` → `buildContentOutput`。工具注册与异常转换由[公共分派器](agent-loop.md)负责，模型侧参数为 `url` 和可选 `timeout`。

`requestWithRedirects` 以 `redirect: 'manual'` 自行跟随重定向：最多 5 跳，每跳前通过 `onHop` 再次调用 `assertPublicUrl`，整体预算 25 秒，单请求超时取 `timeout` 与剩余预算的较小值，默认 15 秒、允许区间 1 至 60 秒。`readBodyLimited` 按字节累计响应体，超过 2 MiB 即中止并标记截断。

`decodeBytes` 依次按响应头 charset、BOM 和 HTML `<meta charset>` 确定编码，解码失败回退 UTF-8；这是必要步骤，因为 `Response.text()` 恒按 UTF-8 解码，非 UTF-8 中文站点会乱码。HTML 响应交给 `extractArticle`：用 linkedom 解析、注入 `<base>` 使相对链接与图片在序列化时补全为绝对地址，再用 `@mozilla/readability` 提取正文，正文不足 500 字符或解析异常时回退为整页转换并移除 `script`、`style`、`noscript`、`nav`、`aside`、`footer` 及 `header[role="banner"]`。纯文本、Markdown 与 JSON 等非 HTML 类型不做提取，直接透传。

`buildContentOutput` 在正文不超过 40 000 字符时内联返回；超过则写入用户目录下的 `~/.liberi/tmp/web/{host}-{url 哈希前 8 位}.md`，结果中给出预览、临时文件路径和总长度，写入失败时降级为按 4 MiB 上限截断的内联正文。目录位置由 [设置配置](settings.md) 的 `tmpDirectory` 统一提供，不写入系统临时目录，也不落在工作区权限之外。临时文件没有 TTL 清理。

返回文本包含标题、最终地址、正文和提取方式。正文不足 200 字符时判定为「无法提取有效正文」，错误文本说明常见原因（依赖客户端 JavaScript 渲染、需要登录、验证页）并声明本工具只支持服务端渲染的静态 HTML 与文本。非 2xx 响应不抛异常，而是返回 `HTTP 状态`、请求与最终地址、响应类型和最多 8 KiB 的响应体预览，便于模型自我纠正。

## 网络边界

`assertPublicUrl` 只允许 `http` 与 `https`，拒绝带用户名或密码的 URL；主机名为字面量 IP 时直接判定，为域名时先 `dns.promises.lookup` 再逐个复核实解析地址，命中环回、私网、链路本地（含云元数据地址）、运营商级 NAT 或本机命名空间即拒绝。域名解析到内网地址时同样拒绝，避免字符串层面的绕过。拒绝文本明确说明是安全策略而非网络故障。

请求固定发送 `User-Agent: liberi-code/{版本} (+仓库地址)`，版本号在运行时从 `package.json` 读取，失败回退 `unknown`；不伪装浏览器。本工具不做 robots.txt 校验：它是用户显式发起的单页读取，与浏览器打开页面的性质一致，也不做站内遍历。

## 调用链与边界

抓取没有复用文件工具的工作区路径检查，也不受 `permission` 模式影响；它只读取远端内容，写入目标是用户目录下的 `~/.liberi/tmp/web`，不新增任意路径写能力。已知残余风险：解析校验与实际连接之间存在 DNS rebinding 时间窗，完整方案需要自定义 undici 调度器，本轮未实现。

## 明确未实现

Playwright、puppeteer 等无头浏览器，Tavily、Jina、Firecrawl 等远程读取服务，MCP 客户端与 `web_search` 均不在本轮范围；`Settings` 未新增任何网页相关字段，没有远程服务配置入口。相关能力待后续专题。

## 验证入口与待补充范围

静态检查为 `npm run typecheck` 与 `npm run format:check`，交互入口为 `npm start`。本次通过 `webFetch` 工具入口和真实公网响应人工核验：静态中文文章页、英文文档页、纯文本与 Markdown 透传、超长正文写入临时文件、短 HTML 页与提取失败分支、404 状态预览、内网与云元数据地址拒绝、非法协议、带凭据 URL、无法解析域名、`localhost` 主机名，以及工具注册清单。未保留自动化测试。非 UTF-8 站点、真实重定向链、临时文件写入失败、域名解析到内网的场景、`npm start` 下的终端展示仍未运行验收。
