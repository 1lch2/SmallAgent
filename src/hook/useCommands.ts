import { compactCommand } from '../commands/compact';
import { modelCommand } from '../commands/model';
import { useQuitCommand } from '../commands/quit';
import type { SlashCommand } from '../commands/types';

/** 注册命令并提供统一分发入口；菜单和执行共用同一组命令。 */
export function useCommands() {
  const quitCommand = useQuitCommand();
  const commands: readonly SlashCommand[] = [compactCommand, modelCommand, quitCommand];

  function executeCommand(input: string): boolean {
    const name = input.trim().split(/\s/)[0];
    const command = commands.find((item) => item.name === name);
    if (!command) return false;
    command.execute?.();
    return true;
  }

  return { commands, executeCommand };
}
