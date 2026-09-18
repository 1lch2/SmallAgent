import * as fs from 'node:fs/promises';
import { resolvePath } from '../utils/path';

export async function fileWrite(args: Record<string, unknown>, cwd: string): Promise<string> {
  const target = resolvePath(String(args.path), cwd);
  await fs.writeFile(target, String(args.content), 'utf-8');
  return `Wrote ${target}`;
}
