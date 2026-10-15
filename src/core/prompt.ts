import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { getCurrentShellInfo } from '../utils/shell';
import { escapeXml } from '../utils/xml';
import type { ToolDefinition } from '../types';
import type { SkillMetadata } from './skills';

// 基本系统提示词只包含通用要求与运行环境，能力和项目指令由调用方另行注入。
const SYSTEM_PROMPT = `You are a terminal agent named Liberi Code, developed by 1lch2.

## Requirements
- Always reply in the same language as the user's message.
- Be concise. When a task is complete, give a one or two line summary.
- If you are unsure, ask the user instead of guessing.

<environment_context>
  <cwd>{cwd}</cwd>
  <current_date>{currentDate}</current_date>
  <shell>{shell}</shell>
</environment_context>`;

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

/** 根据传入的工具名称与描述生成提示词，不加载或预设工具。 */
export function buildToolsPrompt(
  tools: readonly Pick<ToolDefinition, 'name' | 'description'>[]
): string {
  if (tools.length === 0) return '';
  const descriptions = tools
    .map(
      tool => `  <tool>
    <name>${escapeXml(tool.name)}</name>
    <description>${escapeXml(tool.description)}</description>
  </tool>`
    )
    .join('\n');
  return `\n\n<tools>
${descriptions}
</tools>`;
}

/** 根据传入的 skill 元数据生成提示词，不加载 skill 正文。 */
export function buildSkillsPrompt(skills: readonly SkillMetadata[]): string {
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
    Resolve relative paths in a skill's instructions from the directory containing its SKILL.md. Read additional referenced files only as needed.
  </usage>
  <available_skills>
${availableSkills}
  </available_skills>
</skills>`;
}

/** 构建只包含通用要求、工作目录、本地日期和 Shell 信息的基本系统提示词。 */
export function buildSystemPrompt(cwd: string): string {
  const shell = getCurrentShellInfo();
  return SYSTEM_PROMPT.replace('{cwd}', cwd)
    .replace('{currentDate}', getCurrentDate())
    .replace('{shell}', `${shell.type} (${basename(shell.path)})`);
}

/** 读取并生成用户主目录与工作区根部的 AGENTS.md 指令，保留原有分隔顺序。 */
export function buildInstructionsPrompt(cwd: string): string {
  const instructions = [readInstructions(homedir()), readInstructions(cwd)]
    .filter(Boolean)
    .join('\n\n\n--- project-doc ---\n\n\n');
  return instructions ? `\n\n${instructions}` : '';
}
