/** 将错误值转换为可展示的文本消息。 */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
