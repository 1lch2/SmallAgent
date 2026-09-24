import * as fs from 'node:fs/promises';
import { usePermission } from '../hook/usePermission';
import type { ToolDefinition } from '../types';
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

/** 注册文件写入工具及其模型参数定义。 */
export const fileWriteTool = {
  definition: {
    name: 'file_write',
    description:
      'Write inside the working directory, creating or overwriting a file. Always read the file first when modifying an existing file.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to a file inside the working directory.' },
        content: { type: 'string', description: 'Full content to write to the file.' },
      },
      required: ['path', 'content'],
      additionalProperties: false,
    },
  } satisfies ToolDefinition,
  execute: fileWrite,
};
