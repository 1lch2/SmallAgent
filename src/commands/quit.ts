import { useApp } from 'ink';
import type { SlashCommand } from './types';

/** 创建退出命令，在命令自身接入 Ink 的退出能力。 */
export function useQuitCommand(): SlashCommand {
  const { exit } = useApp();

  return {
    name: '/quit',
    description: '退出tui',
    execute: () => exit(),
  };
}
