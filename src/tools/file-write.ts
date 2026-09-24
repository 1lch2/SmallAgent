import * as fs from 'node:fs/promises';
import { usePermission } from '../hook/usePermission';
import { resolvePath } from '../utils/path';

/** 在工作目录权限范围内写入文件内容。 */
export async function fileWrite(args: Record<string, unknown>, cwd: string): Promise<string> {
  const target = resolvePath(String(args.path), cwd);
  const hasPermission = await usePermission(target);

  if (!hasPermission) {
    throw new Error(`权限不足：禁止写入工作目录以外的路径（${target}）。`);
  }
  await fs.writeFile(target, String(args.content), 'utf-8');
  return `Wrote ${target}`;
}
