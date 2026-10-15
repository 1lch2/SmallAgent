const TRUNCATE_LIMIT = 600;

/** 截断过长文本并附带原始长度提示。 */
export function truncate(text: string): string {
  if (text.length <= TRUNCATE_LIMIT) return text;
  return text.slice(0, TRUNCATE_LIMIT) + `\n... (truncated, ${text.length} chars total)`;
}

/** 按 UTF-8 字节数截断文本，不切在多字节字符中间。 */
export function truncateBytes(text: string, maxBytes: number): string {
  const buffer = Buffer.from(text, 'utf8');
  if (buffer.byteLength <= maxBytes) return text;
  // 回退到不含替换字符的最长有效前缀。
  let end = maxBytes;
  while (end > 0 && (buffer[end]! & 0xc0) === 0x80) end--;
  return buffer.subarray(0, end).toString('utf8');
}

/** 将工具参数序列化为便于展示的文本。 */
export function formatArgs(args: unknown): string {
  try {
    return JSON.stringify(args) ?? String(args);
  } catch {
    return String(args);
  }
}
