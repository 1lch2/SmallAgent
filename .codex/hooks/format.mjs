import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const prettier = fileURLToPath(
  new URL('../../node_modules/prettier/bin/prettier.cjs', import.meta.url)
);

// 格式化日志写入 stderr，保证 Stop hook 的 stdout 只有 JSON。
const result = spawnSync(process.execPath, [prettier, '--write', '.'], {
  cwd: repositoryRoot,
  stdio: ['ignore', 'pipe', 'pipe'],
  encoding: 'utf8',
});
if (result.stdout) process.stderr.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) throw result.error;
if (result.status !== 0) {
  console.error('Prettier 格式化失败，请修复后重新运行 npm run format。');
  process.exit(result.status ?? 1);
}
console.log('{}');
