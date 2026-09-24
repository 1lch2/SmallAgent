import { basename } from 'node:path';
import { getCurrentShellPath } from '../utils/shell';

// 系统提示词模板由此处统一维护，构建时注入当前工作目录、日期和 Shell 类型。
const SYSTEM_PROMPT = `You are a terminal agent.

## System information
- Working directory: {cwd}
- Current date: {currentDate}
- Shell: {shell}

## Tools
- You have tools to read files, write files, and run shell commands.
- File tools can only access paths inside the working directory.

## Requirements
- Always reply in the same language as the user's message.
- Be concise. When a task is complete, give a one or two line summary.
- If you are unsure, ask the user instead of guessing.`;

function getCurrentDate(): string {
  const now = new Date();
  const year = String(now.getFullYear()).padStart(4, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCurrentShell(): string {
  return basename(getCurrentShellPath());
}

/** 根据工作目录、当前日期和命令解释器类型构建 Agent 的系统提示词。 */
export function buildSystemPrompt(cwd: string): string {
  return SYSTEM_PROMPT.replace('{cwd}', cwd)
    .replace('{currentDate}', getCurrentDate())
    .replace('{shell}', getCurrentShell());
}
