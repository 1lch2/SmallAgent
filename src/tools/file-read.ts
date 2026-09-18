import * as fs from 'node:fs/promises';
import { resolvePath } from '../utils/path';

export async function fileRead(args: Record<string, unknown>, cwd: string): Promise<string> {
  const target = resolvePath(String(args.path), cwd);
  return await fs.readFile(target, 'utf-8');
}
