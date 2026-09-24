import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/** 检查路径是否位于当前工作目录内。 */
export async function usePermission(targetPath: string): Promise<boolean> {
  if (!targetPath.trim()) return false;

  let root: string;
  try {
    root = await fs.realpath(process.cwd());
  } catch {
    return false;
  }

  const target = path.resolve(targetPath);
  try {
    return isWithinRoot(root, await fs.realpath(target));
  } catch (error) {
    if (!isErrorCode(error, 'ENOENT')) return false;

    try {
      await fs.lstat(target);
      return false;
    } catch (statError) {
      if (!isErrorCode(statError, 'ENOENT')) return false;
    }

    try {
      const parent = await fs.realpath(path.dirname(target));
      return isWithinRoot(root, parent);
    } catch {
      return false;
    }
  }
}

function isWithinRoot(root: string, target: string): boolean {
  const relativePath = path.relative(root, target);
  return (
    relativePath === '' ||
    (relativePath !== '..' && !relativePath.startsWith(`..${path.sep}`) && !path.isAbsolute(relativePath))
  );
}

function isErrorCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}
