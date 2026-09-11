import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { ChatCompletionTool } from 'openai/resources/chat/completions';

const execAsync = promisify(exec);

export const tools: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'file_read',
      description:
        'Read the contents of a file. Path is relative to the working directory or absolute.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file to read.' },
        },
        required: ['path'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'file_write',
      description:
        'Write content to a file, creating or overwriting it. Always read the file first when modifying an existing file.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file to write.' },
          content: { type: 'string', description: 'Full content to write to the file.' },
        },
        required: ['path', 'content'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
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
    },
  },
];

function resolvePath(p: string, cwd: string): string {
  return path.isAbsolute(p) ? p : path.join(cwd, p);
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  cwd: string,
): Promise<string> {
  try {
    switch (name) {
      case 'file_read': {
        const target = resolvePath(String(args.path), cwd);
        return await fs.readFile(target, 'utf-8');
      }
      case 'file_write': {
        const target = resolvePath(String(args.path), cwd);
        await fs.writeFile(target, String(args.content), 'utf-8');
        return `Wrote ${target}`;
      }
      case 'terminal_run': {
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
      default:
        return `Unknown tool: ${name}`;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `Error: ${message}`;
  }
}