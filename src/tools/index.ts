import { fileRead } from './file-read';
import { fileWrite } from './file-write';
import { terminalRun } from './terminal-run';
import { errorMessage } from '../utils/error';
import { ToolDefinition } from '../llm';

export const tools: ToolDefinition[] = [
  {
    name: 'file_read',
    description: 'Read the contents of a file. Path is relative to the working directory or absolute.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file to read.' },
      },
      required: ['path'],
      additionalProperties: false,
    },
  },
  {
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
  {
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
];

export async function executeTool(name: string, args: Record<string, unknown>, cwd: string): Promise<string> {
  try {
    switch (name) {
      case 'file_read':
        return await fileRead(args, cwd);
      case 'file_write':
        return await fileWrite(args, cwd);
      case 'terminal_run':
        return await terminalRun(args, cwd);
      default:
        return `Unknown tool: ${name}`;
    }
  } catch (err) {
    return `Error: ${errorMessage(err)}`;
  }
}
