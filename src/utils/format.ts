const TRUNCATE_LIMIT = 600;

export function truncate(text: string): string {
  if (text.length <= TRUNCATE_LIMIT) return text;
  return text.slice(0, TRUNCATE_LIMIT) + `\n... (truncated, ${text.length} chars total)`;
}

export function formatArgs(args: unknown): string {
  try {
    return JSON.stringify(args) ?? String(args);
  } catch {
    return String(args);
  }
}
