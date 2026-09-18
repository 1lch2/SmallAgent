import { fileRead } from './file-read';
import { fileWrite } from './file-write';
import { terminalRun } from './terminal-run';
import { errorMessage } from '../utils/error';

export { tools } from './definitions';

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  cwd: string,
): Promise<string> {
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
