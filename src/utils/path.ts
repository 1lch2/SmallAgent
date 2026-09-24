import * as path from 'node:path';

/** 将相对路径解析到指定工作目录中。 */
export function resolvePath(p: string, cwd: string): string {
  return path.isAbsolute(p) ? p : path.join(cwd, p);
}
