import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** 支持的终端 Shell 类型。 */
export type ShellType = 'powershell' | 'cmd' | 'bash' | 'sh';

/** 当前终端 Shell 的类型和可执行文件路径。 */
export interface ShellInfo {
  type: ShellType;
  path: string;
}

/** 获取当前平台实际用于执行终端命令的 Shell 信息。 */
export function getCurrentShellInfo(): ShellInfo {
  if (process.platform !== 'win32') {
    const bashPath = ['/bin/bash', '/usr/bin/bash'].find((candidate) => existsSync(candidate));
    return bashPath ? { type: 'bash', path: bashPath } : { type: 'sh', path: '/bin/sh' };
  }

  const powershell7Path = join(
    process.env.ProgramFiles || 'C:\\Program Files',
    'PowerShell',
    '7',
    'pwsh.exe',
  );
  if (existsSync(powershell7Path)) return { type: 'powershell', path: powershell7Path };

  const windowsRoot = process.env.SystemRoot || process.env.WINDIR || 'C:\\Windows';
  const powershell5Path = join(
    windowsRoot,
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe',
  );
  if (existsSync(powershell5Path)) return { type: 'powershell', path: powershell5Path };

  return { type: 'cmd', path: process.env.ComSpec || 'cmd.exe' };
}
