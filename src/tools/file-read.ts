import * as fs from 'node:fs/promises';
import { resolve } from 'node:path';
import { usePathValidation } from '../hook/usePathValidation';
import type { ToolDefinition } from '../types';
import { resolvePath } from '../utils/path';
import type { PermissionMode } from '../core/settings';

/** 按权限模式读取文件，并允许只读访问会话已注册的 SKILL.md。 */
export async function fileRead(
  args: Record<string, unknown>,
  cwd: string,
  permission: PermissionMode = 'workspace-write',
  readableSkillPaths: readonly string[] = []
): Promise<string> {
  const target = resolvePath(String(args.path), cwd);
  if (
    permission === 'workspace-write' &&
    !readableSkillPaths.includes(resolve(target)) &&
    !(await usePathValidation(target))
  ) {
    throw new Error(`权限不足：禁止读取工作目录以外的路径（${target}）。`);
  }
  return await fs.readFile(target, 'utf-8');
}

/** 注册文件读取工具及其模型参数定义。 */
export const fileReadTool = {
  definition: {
    name: 'file_read',
    description:
      'Read a file. Relative paths resolve from the working directory; access follows the configured permission mode. Registered SKILL.md paths are also readable in workspace-write mode.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative or absolute path to a file.' },
      },
      required: ['path'],
      additionalProperties: false,
    },
  } satisfies ToolDefinition,
  execute: fileRead,
};
