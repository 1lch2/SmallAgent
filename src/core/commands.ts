/** 斜杠命令的名称、说明与可选执行逻辑。 */
export interface SlashCommand {
  name: `/${string}`;
  description: string;
  execute?: () => void;
}

/** 按输入首词执行列表中的命令，返回输入是否被已注册命令消费。 */
export function executeCommand(commands: readonly SlashCommand[], input: string): boolean {
  const name = input.trim().split(/\s/)[0];
  const command = commands.find(item => item.name === name);
  if (!command) return false;
  command.execute?.();
  return true;
}
