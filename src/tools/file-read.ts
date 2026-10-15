import * as fs from 'node:fs/promises';
import { resolve } from 'node:path';
import { usePathValidation } from '../hook/usePathValidation';
import type { ToolDefinition } from '../types';
import { isInsideDirectory, resolvePath } from '../utils/path';
import { SETTINGS_FILENAME, USER_DATA_DIRECTORY } from '../core/settings';
import type { PermissionMode } from '../core/settings';

/** 判断目标是否为用户目录下可读的文件，唯一排除根部保存凭据的设置文件。 */
function isReadableUserDataPath(target: string): boolean {
  if (!isInsideDirectory(target, USER_DATA_DIRECTORY)) return false;
  // 只排除词法上直接位于用户目录根部的凭据文件，子目录内的同名文件不受限制。
  return resolve(target) !== resolve(USER_DATA_DIRECTORY, SETTINGS_FILENAME);
}

/** 按权限模式读取文件，并允许只读访问会话已注册的 SKILL.md 与用户目录内容。 */
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
    !isReadableUserDataPath(target) &&
    !(await usePathValidation(target))
  ) {
    throw new Error(
      `权限不足：禁止读取工作目录以外的路径（${target}），仅额外允许 ~/.liberi 下的非凭据文件。`
    );
  }
  return await fs.readFile(target, 'utf-8');
}

/** 注册文件读取工具及其模型参数定义。 */
export const fileReadTool = {
  definition: {
    name: 'file_read',
    description:
      'Read a file. Relative paths resolve from the working directory; access follows the configured permission mode. Registered SKILL.md paths and files under ~/.liberi except its settings file are also readable in workspace-write mode.',
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
