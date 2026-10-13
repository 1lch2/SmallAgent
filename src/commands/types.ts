/** 斜杠命令的注册信息与可选执行逻辑。 */
export interface SlashCommand {
  name: `/${string}`;
  description: string;
  execute?: () => void;
}
