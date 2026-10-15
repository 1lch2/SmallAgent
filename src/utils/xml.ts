/** 转义 XML 文本节点中的 &、< 和 > 字符。 */
export function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
