import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const [tag, releasesFile, notesFile] = process.argv.slice(2);
const repositoryURL = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}`;
const currentRef = `refs/tags/${tag}`;
const releases = JSON.parse(readFileSync(releasesFile, 'utf8'))
  .flat()
  .filter((release) => !release.draft && release.tag_name !== tag)
  .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at));

// 只从当前版本历史中选择已发布的 Release，避免补发旧版本时选到未来版本。
let previousTag;
for (const release of releases) {
  const result = spawnSync('git', ['merge-base', '--is-ancestor', `refs/tags/${release.tag_name}`, currentRef], {
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  if (result.status === 0) {
    previousTag = release.tag_name;
    break;
  }
  if (result.status !== 1) throw new Error(result.stderr || '无法检查 Release tag 的提交历史。');
}

const range = previousTag ? `refs/tags/${previousTag}..${currentRef}` : currentRef;
const log = execFileSync('git', ['log', '--reverse', '--format=%H%x09%s', range, '--'], { encoding: 'utf8' });
const groups = { feat: [], fix: [] };
for (const line of log.trim().split('\n')) {
  const separator = line.indexOf('\t');
  if (separator < 0) continue;
  const sha = line.slice(0, separator);
  const subject = line.slice(separator + 1);
  // 支持 feat、fix 的可选 scope 和破坏性变更标记，不收录 merge/chore 等提交。
  const match = /^(feat|fix)(?:\([^\r\n)]+\))?!?:\s+.+/i.exec(subject);
  if (!match) continue;
  const escaped = subject.replace(/[\\`*_{}\[\]<>]/g, '\\$&');
  groups[match[1].toLowerCase()].push(`- ${escaped} ([${sha.slice(0, 7)}](${repositoryURL}/commit/${sha}))`);
}

const sections = ['## 更新内容'];
for (const [type, title] of [
  ['feat', '新功能（feat）'],
  ['fix', '问题修复（fix）'],
]) {
  if (groups[type].length) sections.push(`### ${title}\n\n${groups[type].join('\n')}`);
}
if (!groups.feat.length && !groups.fix.length) sections.push('本次发布没有 feat 或 fix 提交。');
sections.push(
  previousTag
    ? `[完整变更](${repositoryURL}/compare/${encodeURIComponent(previousTag)}...${encodeURIComponent(tag)})`
    : '首次发布，以上列出截至当前版本的全部 feat 和 fix 提交。',
);
writeFileSync(notesFile, `${sections.join('\n\n')}\n`);
console.log(`Release notes: ${previousTag ?? '初始提交'} -> ${tag}`);
