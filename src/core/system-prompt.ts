import { basename } from 'node:path';
import { getCurrentShellInfo, type ShellType } from '../utils/shell';

// 系统提示词模板由此处统一维护，并注入运行环境信息和对应 Shell 的命令说明。
const SYSTEM_PROMPT = `You are a terminal agent.

## System information
- Working directory: {cwd}
- Current date: {currentDate}
- Shell: {shell}

## Tools
- You have tools to read files, write files, and run shell commands.
- File tools can only access paths inside the working directory.

## Shell usage
{shellUsage}

## Requirements
- Always reply in the same language as the user's message.
- Be concise. When a task is complete, give a one or two line summary.
- If you are unsure, ask the user instead of guessing.`;

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

/** 根据工作目录、当前日期和命令解释器类型构建 Agent 的系统提示词。 */
export function buildSystemPrompt(cwd: string): string {
  const shell = getCurrentShellInfo();
  return SYSTEM_PROMPT.replace('{cwd}', cwd)
    .replace('{currentDate}', getCurrentDate())
    .replace('{shell}', `${shell.type} (${basename(shell.path)})`)
    .replace('{shellUsage}', SHELL_USAGE[shell.type]);
}
