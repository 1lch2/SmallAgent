/** 从模型原文中按顺序拆出思考块和正式回复，忽略空白块。 */
export function splitAssistantText(content: string) {
  const blocks: { kind: 'assistant_text_thinking' | 'assistant_text_response'; text: string }[] = [];
  let offset = 0;

  for (const match of content.matchAll(/<think>([\s\S]*?)<\/think>/g)) {
    const response = content.slice(offset, match.index);
    if (response.trim()) blocks.push({ kind: 'assistant_text_response', text: response });
    if (match[1].trim()) blocks.push({ kind: 'assistant_text_thinking', text: match[1] });
    offset = match.index + match[0].length;
  }

  const response = content.slice(offset);
  if (response.trim()) blocks.push({ kind: 'assistant_text_response', text: response });
  return blocks;
}
