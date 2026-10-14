import { exec, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { checkTerminalCommandPermission } from '../utils/command-permission/terminal-permission';
import { getBashEnvironment } from '../utils/command-permission/bash-paths';
import type { ToolDefinition } from '../types';
import { getCurrentShellInfo } from '../utils/shell';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

/** 在指定工作目录中执行命令；PowerShell 和 Bash 执行命令路径检查。 */
export async function terminalRun(args: Record<string, unknown>, cwd: string): Promise<string> {
  const command = String(args.command);
  const shell = getCurrentShellInfo();
  const hasPermission = await checkTerminalCommandPermission(command, cwd, shell);

  if (!hasPermission) {
    throw new Error(
      '权限不足：命令含有超出工作目录的路径，或无法静态确认路径的 Shell 语法。请使用直接的路径参数，避免动态路径和切换目录。'
    );
  }

  const options = { cwd, maxBuffer: 10 * 1024 * 1024, windowsHide: true };
  const { stdout, stderr } =
    shell.type === 'powershell'
      ? await execFileAsync(
          shell.path,
          [
            '-NoLogo',
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            `[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new();\n${command}`,
          ],
          options
        )
      : shell.type === 'bash'
        ? await execFileAsync(shell.path, ['--noprofile', '--norc', '-p', '-c', command], {
            ...options,
            env: getBashEnvironment(),
          })
        : await execAsync(command, { ...options, shell: shell.path });
  const out = (stdout ?? '').trim();
  const err = (stderr ?? '').trim();
  return (
    [out && `STDOUT:\n${out}`, err && `STDERR:\n${err}`].filter(Boolean).join('\n\n') ||
    '(no output)'
  );
}

/** 注册终端执行工具及其模型参数定义。 */
export const terminalRunTool = {
  definition: {
    name: 'terminal_run',
    description:
      'Run a shell command from the working directory. PowerShell and Bash commands undergo path validation against this directory; CMD and sh skip this check. Use direct literal path arguments; dynamic paths, assignments, directory changes and nested shells are rejected. Returns combined stdout and stderr.',
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
