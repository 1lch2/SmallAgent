import * as fs from 'node:fs/promises';
import { usePathValidation } from '../hook/usePathValidation';
import type { ToolDefinition } from '../types';
import { resolvePath } from '../utils/path';
import type { PermissionMode } from '../core/settings';

/** 按权限模式检查路径并写入文件内容。 */
export async function fileWrite(
  args: Record<string, unknown>,
  cwd: string,
  permission: PermissionMode = 'workspace'
): Promise<string> {
  const target = resolvePath(String(args.path), cwd);
  if (permission === 'workspace' && !(await usePathValidation(target))) {
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
      'Create or overwrite a file according to the configured permission mode. Always read the file first when modifying an existing file.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative or absolute path to a file.' },
        content: { type: 'string', description: 'Full content to write to the file.' },
      },
      required: ['path', 'content'],
      additionalProperties: false,
    },
  } satisfies ToolDefinition,
  execute: fileWrite,
};
