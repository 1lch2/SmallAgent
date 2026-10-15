import * as path from 'node:path';

/** 将相对路径解析到指定工作目录中。 */
export function resolvePath(p: string, cwd: string): string {
  return path.isAbsolute(p) ? p : path.join(cwd, p);
}

/** 判断目标路径是否位于指定目录内（含子目录），使用词法前缀比较。 */
export function isInsideDirectory(target: string, directory: string): boolean {
  const root = path.resolve(directory);
  const candidate = path.resolve(target);
  // Windows 路径比较不区分大小写，统一小写后比较可兼容盘符大小写差异。
  const caseInsensitive = process.platform === 'win32';
  const relativePath = path.relative(
    caseInsensitive ? root.toLowerCase() : root,
    caseInsensitive ? candidate.toLowerCase() : candidate
  );
  if (relativePath === '') return true;
  if (path.isAbsolute(relativePath) || relativePath === '..') return false;
  return !relativePath.startsWith(`..${path.sep}`);
}
