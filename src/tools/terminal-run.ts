import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { ToolDefinition } from '../types';

const execAsync = promisify(exec);

/** 在指定工作目录中执行终端命令。 */
export async function terminalRun(args: Record<string, unknown>, cwd: string): Promise<string> {
  const { stdout, stderr } = await execAsync(String(args.command), {
    cwd,
    maxBuffer: 10 * 1024 * 1024,
    shell: process.platform === 'win32' ? undefined : '/bin/sh',
  });
  const out = (stdout ?? '').trim();
  const err = (stderr ?? '').trim();
  return [out && `STDOUT:\n${out}`, err && `STDERR:\n${err}`]
    .filter(Boolean)
    .join('\n\n') || '(no output)';
}

/** 注册终端执行工具及其模型参数定义。 */
export const terminalRunTool = {
  definition: {
    name: 'terminal_run',
    description:
      'Run a shell command from the working directory. Returns combined stdout and stderr. Use for any command-line operations.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The shell command to execute.' },
      },
      required: ['command'],
      additionalProperties: false,
    },
  } satisfies ToolDefinition,
  execute: terminalRun,
};
