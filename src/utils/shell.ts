import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** 获取当前平台实际用于执行终端命令的 Shell 可执行文件路径。 */
export function getCurrentShellPath(): string {
  if (process.platform !== 'win32') return '/bin/sh';

  const powershell7Path = join(
    process.env.ProgramFiles ?? 'C:\\Program Files',
    'PowerShell',
    '7',
    'pwsh.exe',
  );
  if (existsSync(powershell7Path)) return powershell7Path;

  const windowsRoot = process.env.SystemRoot ?? process.env.WINDIR ?? 'C:\\Windows';
  const powershell5Path = join(
    windowsRoot,
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe',
  );
  if (existsSync(powershell5Path)) return powershell5Path;

  return process.env.ComSpec ?? 'cmd.exe';
}
