## 功能导航

- 查找、解释或修改项目功能实现前，使用项目级 [feature-map skill](.agents/skills/feature-map/SKILL.md)，先从 [docs/feature-map.yaml](docs/feature-map.yaml) 匹配功能，按需阅读其指向的 `docs/features/` 专题文档，再核对当前源码。
- 新增、变更、删除功能或重构影响导航映射时，在同一次任务中按该 skill 更新受影响条目；纯只读分析不修改文件。导航尚未完整收录，不为补齐导航扩大当前任务范围。

## 注释

- 所有导出的函数，接口，类型，类都必须编写 JSDoc 注释，简要介绍定义或者功能
- 所有注释使用中文编写

## 命名规范

- React UI 组件使用 PascalCase 命名格式 (e.g.: `UserProfile`、`NavBar`)

## React 风格

- 自定义 Hook 使用 `use` 前缀和 camelCase 命名（例如：`usePathValidation`）。
- Hook 必须在调用函数的顶层无条件调用，并保持每次调用顺序一致；禁止在条件、循环、条件表达式、try/catch/finally 或嵌套函数中调用。
- 需要根据 Hook 结果分支时，先在顶层调用并保存结果，再根据结果执行条件逻辑。
- UI 组件名所在文件同名，需要被引用的类型优先使用 interface 而不是 type。 组件 props 的 interface 命名遵循 `{组件名}Props` 的习惯。
- hook 统一组织在 src/hook 目录下
- 组件统一组织在 src/ui 目录下

## 行为边界

- 除非主动要求，否则不要修改 `README.md`
- 除非主动要求，否则不编写单元测试
- 不做无意义的封装或者嵌套，保持组件低耦合高内聚，用最直接的实现而不是工程上扩展最强的实现
