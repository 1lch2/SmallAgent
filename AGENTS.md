## 功能导航

- 查找、解释或修改项目功能实现前，使用项目级 [feature-map skill](.agents/skills/feature-map/SKILL.md)，先从 [docs/feature-map.yaml](docs/feature-map.yaml) 匹配功能，按需阅读其指向的 `docs/features/` 专题文档，再核对当前源码。
- 新增、变更、删除功能或重构影响导航映射时，在同一次任务中按该 skill 更新受影响条目；纯只读分析不修改文件。导航尚未完整收录，不为补齐导航扩大当前任务范围。

## 项目概况

- Liberi Code 是极简终端 CLI Agent，基于 Node.js（>=22）、TypeScript、React 和 Ink，通过 OpenAI Chat Completions 兼容接口调用模型。
- 核心流程为「用户输入 → 请求模型 → 执行工具并反馈结果 → 继续请求」，直到模型不再调用工具；目前提供 `file_read`、`file_write` 和 `terminal_run` 三个工具。
- `src/index.tsx` 负责读取环境配置并启动应用；`src/core/` 管理对话历史、Agent 循环和系统提示词；`src/openai-llm.ts` 负责模型接口适配。
- `src/ui/` 负责终端交互与消息展示；`src/tools/` 实现工具；`src/hook/usePermission.ts` 负责工作目录内的路径权限检查；`src/types.ts` 定义公共协议类型，`src/utils/` 提供辅助函数。
- 模型通过 `/provider` 选择内置服务商或自定义 OpenAI Chat Completion 端点，连接选项与 API Key 保存在 `~/.liberi/providers.json`，模型清单缓存在系统临时目录；启动无需环境变量。
- 常用命令：`npm start` 启动开发运行，`npm run typecheck` 检查类型，`npm run build` 构建 CLI 到 `dist/liberi-code.js`。

## 注释

- 所有导出的函数，接口，类型，类都必须编写 JSDoc 注释，简要介绍定义或者功能
- 所有注释使用中文编写

## 命名规范

- React UI 组件使用 PascalCase 命名格式 (e.g.: `UserProfile`、`NavBar`)

## React 风格

- 自定义 Hook 使用 `use` 前缀和 camelCase 命名（例如：`usePermission`）。
- Hook 必须在调用函数的顶层无条件调用，并保持每次调用顺序一致；禁止在条件、循环、条件表达式、try/catch/finally 或嵌套函数中调用。
- 需要根据 Hook 结果分支时，先在顶层调用并保存结果，再根据结果执行条件逻辑。
- UI 组件名所在文件同名，需要被引用的类型优先使用 interface 而不是 type。 组件 props 的 interface 命名遵循 `{组件名}Props` 的习惯。
- hook 统一组织在 src/hook 目录下
- 组件统一组织在 src/ui 目录下

## 行为边界

- 除非主动要求，否则不要修改 `README.md`
- 除非主动要求，否则不编写单元测试
- 不做无意义的封装或者嵌套，保持组件低耦合高内聚，用最直接的实现而不是工程上扩展最强的实现
