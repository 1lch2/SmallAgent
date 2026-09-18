import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export async function terminalRun(args: Record<string, unknown>, cwd: string): Promise<string> {
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
