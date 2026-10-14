import { Fragment, memo, useMemo, type ReactNode } from 'react';
import { Box, Text } from 'ink';
import { Marked, type MarkedToken, type Token, type Tokens } from 'marked';
import stringWidth from 'string-width';
import { sanitizeTerminalText } from '../utils/terminal-text';

/** 描述 Markdown 原文和扣除外层留白后的可用列宽。 */
export interface MarkdownProps {
  text: string;
  width: number;
}

// 不注册扩展，因此解析结果只包含 Marked 内置 token。
const parser = new Marked({ gfm: true, breaks: false });

function linkSuffix(token: Tokens.Link | Tokens.Image): string {
  return inlineText(token.tokens) === token.href ? '' : ` (${token.href})`;
}

// 表格测量与行内渲染使用相同的可见文本，避免链接地址等内容漏算宽度。
function inlineText(tokens: Token[]): string {
  return tokens
    .map((source): string => {
      const token = source as MarkedToken;
      switch (token.type) {
        case 'checkbox':
          return '';
        case 'br':
          return '\n';
        case 'link':
        case 'image':
          return inlineText(token.tokens) + linkSuffix(token);
        case 'codespan':
        case 'escape':
        case 'html':
          return token.text;
        default:
          return 'tokens' in token && token.tokens
            ? inlineText(token.tokens)
            : ('text' in token ? token.text : token.raw).replace(/\n/g, ' ');
      }
    })
    .join('');
}

function renderInline(tokens: Token[]): ReactNode {
  return tokens.map((source, index) => {
    const token = source as MarkedToken;
    let content: ReactNode;
    switch (token.type) {
      case 'checkbox':
        content = null;
        break;
      case 'strong':
        content = <Text bold>{renderInline(token.tokens)}</Text>;
        break;
      case 'em':
        content = <Text italic>{renderInline(token.tokens)}</Text>;
        break;
      case 'del':
        content = <Text strikethrough>{renderInline(token.tokens)}</Text>;
        break;
      case 'codespan':
        content = <Text underline>{token.text}</Text>;
        break;
      case 'br':
        content = '\n';
        break;
      case 'link':
      case 'image':
        content = (
          <>
            {renderInline(token.tokens)}
            {linkSuffix(token)}
          </>
        );
        break;
      case 'escape':
      case 'html':
        content = token.text;
        break;
      default:
        content =
          'tokens' in token && token.tokens
            ? renderInline(token.tokens)
            : ('text' in token ? token.text : token.raw).replace(/\n/g, ' ');
    }
    return <Fragment key={index}>{content}</Fragment>;
  });
}

function renderTable(table: Tokens.Table, width: number): ReactNode {
  const rows = [table.header, ...table.rows];
  const widths = table.header.map((_, column) => {
    let result = 1;
    for (const row of rows) {
      for (const line of inlineText(row[column].tokens).split('\n')) {
        result = Math.max(result, stringWidth(line));
      }
    }
    return result;
  });
  const minimumWidths = widths.map((value) => Math.min(2, value));
  const minimumContentWidth = minimumWidths.reduce((sum, value) => sum + value, 0);
  const padding = minimumContentWidth + (widths.length - 1) * 3 <= width ? 1 : 0;
  const separatorWidth = 1 + padding * 2;
  const availableWidth = Math.max(minimumContentWidth, width - (widths.length - 1) * separatorWidth);

  // 优先保留短列，将长列压缩到共同上限，避免逐字符缩减长文本。
  if (widths.reduce((sum, value) => sum + value, 0) > availableWidth) {
    let lower = 1;
    let upper = Math.max(...widths);
    while (lower < upper) {
      const limit = Math.ceil((lower + upper) / 2);
      const required = widths.reduce((sum, value, column) => sum + Math.max(minimumWidths[column], Math.min(value, limit)), 0);
      if (required <= availableWidth) lower = limit;
      else upper = limit - 1;
    }
    const naturalWidths = [...widths];
    for (let column = 0; column < widths.length; column++) {
      widths[column] = Math.max(minimumWidths[column], Math.min(widths[column], lower));
    }
    let remaining = availableWidth - widths.reduce((sum, value) => sum + value, 0);
    for (let column = 0; column < widths.length && remaining > 0; column++) {
      if (widths[column] < naturalWidths[column]) {
        widths[column]++;
        remaining--;
      }
    }
  }
  const tableWidth = widths.reduce((sum, value) => sum + value, 0) + (widths.length - 1) * separatorWidth;
  const separator = widths.map((value) => '─'.repeat(value)).join('─'.repeat(padding) + '┼' + '─'.repeat(padding));

  return (
    <Box flexDirection='column' width={tableWidth} flexShrink={0}>
      {rows.map((row, rowIndex) => (
        <Fragment key={rowIndex}>
          {rowIndex > 0 && <Text>{separator}</Text>}
          <Box>
            {row.map((cell, column) => (
                <Box
                  key={column}
                  width={widths[column] + (column > 0 ? 1 + padding : 0) + (column < widths.length - 1 ? padding : 0)}
                  flexShrink={0}
                  borderStyle='single'
                  borderLeft={column > 0}
                  borderTop={false}
                  borderBottom={false}
                  borderRight={false}
                  paddingLeft={column > 0 ? padding : 0}
                  paddingRight={column < widths.length - 1 ? padding : 0}
                  justifyContent={
                    table.align[column] === 'right'
                      ? 'flex-end'
                      : table.align[column] === 'center'
                        ? 'center'
                        : 'flex-start'
                  }
                >
                  <Text bold={rowIndex === 0}>{renderInline(cell.tokens)}</Text>
                </Box>
            ))}
          </Box>
        </Fragment>
      ))}
    </Box>
  );
}

function renderBlock(source: Token, width: number): ReactNode {
  const token = source as MarkedToken;
  switch (token.type) {
    case 'heading':
      return (
        <Text bold underline={token.depth === 1}>
          {renderInline(token.tokens)}
        </Text>
      );
    case 'paragraph':
    case 'text':
      return <Text>{token.tokens ? renderInline(token.tokens) : token.text}</Text>;
    case 'code':
      return (
        <Box flexDirection='column'>
          {token.lang && <Text dimColor>{token.lang}</Text>}
          <Text>{token.text.replace(/\t/g, '    ')}</Text>
        </Box>
      );
    case 'blockquote': {
      const inset = width >= 4 ? 2 : 0;
      return (
        <Box
          flexDirection='column'
          borderStyle={inset ? 'single' : undefined}
          borderTop={false}
          borderBottom={false}
          borderRight={false}
          paddingLeft={inset ? 1 : 0}
        >
          {renderBlocks(token.tokens, width - inset)}
        </Box>
      );
    }
    case 'list':
      return (
        <Box flexDirection='column'>
          {token.items.map((item, index) => {
            const bullet = token.ordered ? `${Number(token.start) + index}. ` : '• ';
            const marker = bullet + (item.task ? (item.checked ? '[x] ' : '[ ] ') : '');
            const markerWidth = stringWidth(marker);
            const stacked = width - markerWidth < 2;
            return (
              <Box key={index} flexDirection={stacked ? 'column' : 'row'} marginTop={token.loose && index > 0 ? 1 : 0}>
                <Box width={stacked ? width : markerWidth} flexShrink={0}>
                  <Text>{marker}</Text>
                </Box>
                <Box flexDirection='column' width={stacked ? width : width - markerWidth}>
                  {renderBlocks(item.tokens, stacked ? width : width - markerWidth, !item.loose)}
                </Box>
              </Box>
            );
          })}
        </Box>
      );
    case 'table':
      return renderTable(token, width);
    case 'hr':
      return <Text>{'─'.repeat(width)}</Text>;
    default:
      return <Text>{token.raw.replace(/\n$/, '')}</Text>;
  }
}

function renderBlocks(tokens: Token[], width: number, compact = false): ReactNode {
  return tokens
    .filter((token) => token.type !== 'space' && token.type !== 'def' && token.type !== 'checkbox')
    .map((token, index) => (
      <Box key={index} flexDirection='column' width={width} flexShrink={0} marginTop={index > 0 && !compact ? 1 : 0}>
        {renderBlock(token, width)}
      </Box>
    ));
}

/** 将 Markdown 原文渲染为 Ink 内容，仅在正文变化时重新解析，在列宽变化时重新布局。 */
export const Markdown = memo(function Markdown({ text, width }: MarkdownProps) {
  const tokens = useMemo(() => {
    const parsed = parser.lexer(sanitizeTerminalText(text));
    // 数字字符实体可能在解析时生成控制字符，进入 Ink 前再次处理所有可显示字段。
    parser.walkTokens(parsed, (token) => {
      token.raw = sanitizeTerminalText(token.raw);
      if ('text' in token) token.text = sanitizeTerminalText(token.text);
      if ('href' in token) token.href = sanitizeTerminalText(token.href);
      if ('lang' in token && token.lang) token.lang = sanitizeTerminalText(token.lang);
    });
    return parsed;
  }, [text]);
  const contentWidth = Math.max(1, width);
  return (
    <Box flexDirection='column' width={contentWidth}>
      {renderBlocks(tokens, contentWidth)}
    </Box>
  );
});
