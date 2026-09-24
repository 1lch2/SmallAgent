import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { usePermission } from '../hook/usePermission';
import type { ToolDefinition } from '../types';

const execAsync = promisify(exec);

/** 检查命令中的显式路径权限后，在指定工作目录中执行命令。 */
export async function terminalRun(args: Record<string, unknown>, cwd: string): Promise<string> {
  const command = String(args.command);
  const pathAnalysis = extractCommandPaths(command, cwd);
  const hasPermission = await usePermission(pathAnalysis.paths);

  if (!pathAnalysis.isValid || !hasPermission) {
    throw new Error('权限不足：命令含有无法解析或超出工作目录的路径。');
  }

  const { stdout, stderr } = await execAsync(command, {
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

function extractCommandPaths(command: string, cwd: string): { paths: string[]; isValid: boolean } {
  const tokens = tokenizeCommand(command);
  if (!tokens) return { paths: [], isValid: false };

  const paths = new Set<string>();
  for (const token of tokens) {
    for (const candidate of getPathCandidates(token)) {
      if (!isPathLike(candidate) || /^https?:\/\//i.test(candidate)) continue;

      const resolvedPath = resolveCommandPath(candidate, cwd);
      if (!resolvedPath) return { paths: [...paths], isValid: false };
      paths.add(resolvedPath);
    }
  }

  return { paths: [...paths], isValid: true };
}

function tokenizeCommand(command: string): string[] | null {
  const tokens: string[] = [];
  const isWindows = process.platform === 'win32';
  let value = '';
  let quote: '"' | "'" | null = null;
  let hasValue = false;

  const pushValue = () => {
    if (hasValue) tokens.push(value);
    value = '';
    hasValue = false;
  };

  for (let index = 0; index < command.length; index += 1) {
    const character = command[index];

    if (quote) {
      if (character === quote) {
        quote = null;
      } else if (!isWindows && quote === '"' && character === '\\' && index + 1 < command.length) {
        value += command[++index];
      } else {
        value += character;
      }
      hasValue = true;
      continue;
    }

    if (!isWindows && character === '\\' && index + 1 < command.length) {
      value += command[++index];
      hasValue = true;
      continue;
    }
    if (isWindows && character === '^' && index + 1 < command.length) {
      value += command[++index];
      hasValue = true;
      continue;
    }
    if (character === '"' || (!isWindows && character === "'")) {
      quote = character;
      hasValue = true;
      continue;
    }
    if (/\s/.test(character)) {
      pushValue();
      continue;
    }
    if (';&|<>'.includes(character)) {
      pushValue();
      while (index + 1 < command.length && '&|<>'.includes(command[index + 1])) {
        const nextCharacter = command[index + 1];
        if (nextCharacter !== character || !['&', '|', '<', '>'].includes(character)) break;
        index += 1;
      }
      continue;
    }

    value += character;
    hasValue = true;
  }

  if (quote) return null;
  pushValue();
  return tokens;
}

function getPathCandidates(token: string): string[] {
  const candidates = [token];
  const equalsIndex = token.indexOf('=');
  if (equalsIndex >= 0) candidates.push(token.slice(equalsIndex + 1));

  const attachedOption = token.match(/^-{1,2}[A-Za-z][A-Za-z0-9_-]*(.+)$/);
  if (attachedOption) candidates.push(attachedOption[1].replace(/^=/, ''));

  return [...new Set(candidates)];
}

function isPathLike(value: string): boolean {
  if (/^file:\/\//i.test(value)) return true;
  return (
    path.isAbsolute(value) ||
    /^[A-Za-z]:/.test(value) ||
    /^\\\\/.test(value) ||
    /^~(?:[\\/]|$)/.test(value) ||
    /^\.{1,2}(?:[\\/]|$)/.test(value) ||
    /[\\/]/.test(value)
  );
}

function resolveCommandPath(value: string, cwd: string): string | null {
  if (/^file:\/\//i.test(value)) {
    try {
      return path.resolve(cwd, fileURLToPath(value));
    } catch {
      return null;
    }
  }

  if (value.startsWith('~')) {
    const home = process.env.USERPROFILE || process.env.HOME;
    if (!home || !/^~(?:[\\/]|$)/.test(value)) return null;
    value = path.join(home, value.slice(1).replace(/^[\\/]/, ''));
  }

  if (/[`$]/.test(value) || /%[^%]+%/.test(value)) return null;
  return path.resolve(cwd, value);
}

/** 注册终端执行工具及其模型参数定义。 */
export const terminalRunTool = {
  definition: {
    name: 'terminal_run',
    description:
      'Run a shell command from the working directory. Explicit path arguments are checked against this directory. Returns combined stdout and stderr.',
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
