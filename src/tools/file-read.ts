import * as fs from 'node:fs/promises';
import { usePermission } from '../hook/usePermission';
import type { ToolDefinition } from '../types';
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

/** 注册文件读取工具及其模型参数定义。 */
export const fileReadTool = {
  definition: {
    name: 'file_read',
    description:
      'Read a file inside the working directory. Path can be relative or absolute, but must resolve inside it.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to a file inside the working directory.' },
      },
      required: ['path'],
      additionalProperties: false,
    },
  } satisfies ToolDefinition,
  execute: fileRead,
};
