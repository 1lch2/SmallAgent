import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { getCurrentShellInfo, type ShellType } from '../utils/shell';
import type { PermissionMode } from './settings';
import { loadSkills, type SkillMetadata } from './skills';

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
  Use tools to read files, write files, run shell commands, and fetch web pages.
  <file_access>In workspace-write mode, only access files inside the working directory, except that file_read can also read the registered SKILL.md paths listed below and files under ~/.liberi other than its credential files. In full-access mode, workspace path restrictions are disabled.</file_access>
  <web_access>web_fetch turns a URL into Markdown and needs no extra configuration. It only reads server-rendered HTML and plain text; pages that need client-side JavaScript rendering, and responses that are not HTML or text, fail with the reason stated. Asking for the same URL again will not change that outcome. When the content exceeds the inline limit it is written to a temporary file whose path is returned, so read that file with file_read only if you need the full text.</web_access>
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

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildSkillsPrompt(skills: SkillMetadata[]): string {
  if (skills.length === 0) return '';
  const availableSkills = skills
    .map(
      skill => `    <skill>
      <name>${escapeXml(skill.name)}</name>
      <description>${escapeXml(skill.description)}</description>
      <path>${escapeXml(skill.path)}</path>
    </skill>`
    )
    .join('\n');
  return `\n\n<skills>
  <usage>
    The available skills below list metadata only. When a skill matches the task, use file_read to read its complete SKILL.md at the listed path before following its Markdown instructions.
    Resolve relative paths in a skill's instructions from the directory containing its SKILL.md. Read additional referenced files only as needed and within the configured permissions.
  </usage>
  <available_skills>
${availableSkills}
  </available_skills>
</skills>`;
}

/** 构建系统提示词，在工具后注入 skill 元数据，再追加用户及工作区 AGENTS.md。 */
export function buildSystemPrompt(
  cwd: string,
  permission: PermissionMode = 'workspace-write',
  skills: SkillMetadata[] = loadSkills(cwd)
): string {
  const shell = getCurrentShellInfo();
  const prompt =
    SYSTEM_PROMPT.replace('{cwd}', cwd)
      .replace('{currentDate}', getCurrentDate())
      .replace('{shell}', `${shell.type} (${basename(shell.path)})`)
      .replace('{shellUsage}', SHELL_USAGE[shell.type])
      .replace('{permission}', permission) + buildSkillsPrompt(skills);

  const instructions = [readInstructions(homedir()), readInstructions(cwd)]
    .filter(Boolean)
    .join('\n\n\n--- project-doc ---\n\n\n');
  return instructions ? `${prompt}\n\n${instructions}` : prompt;
}
