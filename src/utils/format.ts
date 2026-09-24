const TRUNCATE_LIMIT = 600;

/** 截断过长文本并附带原始长度提示。 */
export function truncate(text: string): string {
  if (text.length <= TRUNCATE_LIMIT) return text;
  return text.slice(0, TRUNCATE_LIMIT) + `\n... (truncated, ${text.length} chars total)`;
}

/** 将工具参数序列化为便于展示的文本。 */
export function formatArgs(args: unknown): string {
  try {
    return JSON.stringify(args) ?? String(args);
  } catch {
    return String(args);
  }
}
