## 注释

- 所有导出的函数，接口，类型，类都必须编写 JSDoc 注释，简要介绍定义或者功能
- 所有注释使用中文编写

## 命名规范

- React UI 组件使用 PascalCase 命名格式 (e.g.: `UserProfile`、`NavBar`)

## React 风格

- 自定义 Hook 使用 `use` 前缀和 camelCase 命名（例如：`usePermission`）。
- Hook 必须在调用函数的顶层无条件调用，并保持每次调用顺序一致；禁止在条件、循环、条件表达式、try/catch/finally 或嵌套函数中调用。
- 需要根据 Hook 结果分支时，先在顶层调用并保存结果，再根据结果执行条件逻辑。

## 行为边界

- 除非主动要求，否则不要修改 `README.md`
- 除非主动要求，否则不编写单元测试
