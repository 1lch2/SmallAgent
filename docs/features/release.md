# GitHub Actions 发布与 Release Notes

[返回功能索引](../feature-map.yaml)

覆盖状态：已核对工作流及说明生成脚本，使用临时 Git 仓库与当前仓库历史完成本地生成检查。最近核对：2026-10-14。未触发 GitHub Actions 或创建线上 Release。

## 入口与关键实现

- [.github/workflows/release.yml](../../.github/workflows/release.yml)：推送 `v*` tag 后运行 Ubuntu 发布任务，全量检出历史，检查 tag 属于 `master` 历史，安装依赖、检查类型、构建并通过 `npm pack` 生成安装包。发布前检查 tag 与 `package.json` 版本一致，已有同名 Release 时跳过。
- [scripts/release-notes.mjs](../../scripts/release-notes.mjs)：读取 GitHub Release 列表和本地 Git 历史，为本次 tag 生成分类 Markdown；参数依次为 tag、Release 列表 JSON 文件和输出 Markdown 文件。提交链接使用工作流提供的 `GITHUB_SERVER_URL` 与 `GITHUB_REPOSITORY`。
- [package.json](../../package.json)：提供版本及打包范围；CLI 构建见[启动与构建](cli-startup.md)。

## 发布说明生成规则

工作流用 `gh api --paginate --slurp` 获取全部 Release，再调用生成脚本。过滤草稿和本次 tag，按发布时间倒序选择 tag 是当前 tag 祖先的首个 Release，包含预发布版本；没有 Release 的普通 tag 不作为比较基准。不在当前历史中的版本跳过；缺失或无效的 Release tag 导致失败，不静默生成错误范围。

有基准时读取 `previousTag..currentTag`，排除前一个版本已有提交；没有可用基准时读取截至本次 tag 的全部历史。按提交标题筛选 `feat:`、`fix:`，支持可选 scope、`!` 标记和大小写变体，按 Git 日志反向顺序列出，分为“新功能（feat）”和“问题修复（fix）”。保留原标题并附提交链接，不收录其他类型；有基准时附完整 diff 链接，无匹配提交时明确说明。

最终使用 `gh release create --notes-file` 发布说明并上传 `.tgz`，替代 GitHub 默认的 `--generate-notes`。现有 Release 不会被重跑覆盖。本流程创建 GitHub Release，不发布 npm registry。

## 边界

`node scripts/release-notes.mjs <tag> <releases.json> <notes.md>` 只读取 Git 历史并写入输出文件，不发布 Release；发布动作由工作流完成。
