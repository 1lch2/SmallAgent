import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { getCurrentShellInfo, type ShellType } from '../utils/shell';
import type { PermissionMode } from './settings';

// 系统提示词模板由此处统一维护，并注入运行环境信息和对应 Shell 的命令说明。
const SYSTEM_PROMPT = `You are a terminal agent named Liberi Code, developed by 1lch2.

## Requirements
- Always reply in the same language as the user's message.
- Be concise. When a task is complete, give a one or two line summary.
- If you are unsure, ask the user instead of guessing.

<environment_context>
  <cwd>{cwd}</cwd>
  <current_date>{currentDate}</current_date>
  <shell>{shell}</shell>
  <permission>{permission}</permission>
</environment_context>

<tools>
  Use tools to read files, write files, and run shell commands.
  <file_access>In workspace-write mode, only access files inside the working directory. In full-access mode, workspace path restrictions are disabled.</file_access>
  <shell_usage>
{shellUsage}
  </shell_usage>
</tools>`;

const SHELL_USAGE: Record<ShellType, string> = {
  powershell:
    "- Run PowerShell commands directly, such as `Get-ChildItem -Force` or `Get-Content -LiteralPath 'file.txt'`.\n- Quote paths with single quotes and separate multiple commands with `;`.",
  cmd: '- Run CMD commands directly, such as `dir /a` or `type "file.txt"`.\n- Quote paths with double quotes and chain commands with `&&`.',
  bash: "- Run Bash commands directly, such as `pwd`, `ls -la`, or `cat 'file.txt'`.\n- Quote paths with single quotes and chain commands with `&&`.",
  sh: "- Run POSIX shell commands directly, such as `pwd`, `ls -la`, or `cat 'file.txt'`.\n- Quote paths with single quotes and chain commands with `&&`.",
};

function getCurrentDate(): string {
  const now = new Date();
  const year = String(now.getFullYear()).padStart(4, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function readInstructions(directory: string): string {
  let instructions: string;
  try {
    instructions = readFileSync(join(directory, 'AGENTS.md'), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '';
    throw error;
  }

  return `# AGENTS.md instructions for ${directory}\n<INSTRUCTIONS>\n${instructions}\n</INSTRUCTIONS>`;
}

/** 构建默认系统提示词，并依次追加用户主目录和工作目录中的 AGENTS.md 指令。 */
export function buildSystemPrompt(
  cwd: string,
  permission: PermissionMode = 'workspace-write'
): string {
  const shell = getCurrentShellInfo();
  const prompt = SYSTEM_PROMPT.replace('{cwd}', cwd)
    .replace('{currentDate}', getCurrentDate())
    .replace('{shell}', `${shell.type} (${basename(shell.path)})`)
    .replace('{shellUsage}', SHELL_USAGE[shell.type])
    .replace('{permission}', permission);

  const instructions = [readInstructions(homedir()), readInstructions(cwd)]
    .filter(Boolean)
    .join('\n\n\n--- project-doc ---\n\n\n');
  return instructions ? `${prompt}\n\n${instructions}` : prompt;
}
