import * as fs from 'node:fs/promises';
import { usePermission } from '../hook/usePermission';
import { resolvePath } from '../utils/path';

/** 在工作目录权限范围内读取文件内容。 */
export async function fileRead(args: Record<string, unknown>, cwd: string): Promise<string> {
  const target = resolvePath(String(args.path), cwd);
  const hasPermission = await usePermission(target);

  if (!hasPermission) {
    throw new Error(`权限不足：禁止读取工作目录以外的路径（${target}）。`);
  }
  return await fs.readFile(target, 'utf-8');
}
