import { useApp } from 'ink';
import type { SlashCommand } from '../core/commands';
import { useProviderSession } from './useProviderSession';

/** 组装应用内置命令，各命令通过闭包持有自身所需的能力。 */
export function useCommands(): readonly SlashCommand[] {
  const { exit } = useApp();
  const { openProviders, openModels, openConfig } = useProviderSession();

  return [
    { name: '/compact', description: '压缩上下文' },
    { name: '/config', description: 'Agent 设置', execute: openConfig },
    { name: '/model', description: '切换模型', execute: openModels },
    { name: '/provider', description: '连接模型服务商', execute: openProviders },
    { name: '/quit', description: '退出TUI', execute: () => exit() },
  ];
}
