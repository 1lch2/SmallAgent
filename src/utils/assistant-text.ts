/** 从模型原文中按顺序拆分思考块与回复正文，去除各块头尾空行并忽略空白块。 */
export function splitAssistantText(content: string) {
  const blocks: { kind: 'assistant_text_thinking' | 'assistant_text_response'; text: string }[] = [];
  let offset = 0;

  for (const match of content.matchAll(/<think>([\s\S]*?)<\/think>/g)) {
    const response = trimBoundaryBlankLines(content.slice(offset, match.index));
    if (response.trim()) blocks.push({ kind: 'assistant_text_response', text: response });
    const thinking = trimBoundaryBlankLines(match[1]);
    if (thinking.trim()) blocks.push({ kind: 'assistant_text_thinking', text: thinking });
    offset = match.index + match[0].length;
  }

  const response = trimBoundaryBlankLines(content.slice(offset));
  if (response.trim()) blocks.push({ kind: 'assistant_text_response', text: response });
  return blocks;
}

function trimBoundaryBlankLines(text: string): string {
  return text
    .replace(/^(?:[ \t]*(?:\r\n|\n|\r))+/, '')
    .replace(/(?:(?:\r\n|\n|\r)[ \t]*)+$/, '');
}
