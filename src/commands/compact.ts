import type { SlashCommand } from './types';

/** 注册上下文压缩命令，暂未接入执行。 */
export const compactCommand: SlashCommand = {
  name: '/compact',
  description: '压缩上下文',
};
