import { Box, Text } from 'ink';
import { formatArgs, truncate } from '../utils/format';

function getFileName(args: unknown): string {
  if (
    typeof args !== 'object' ||
    args === null ||
    !('path' in args) ||
    typeof args.path !== 'string'
  ) {
    return 'unknown';
  }
  return args.path.split(/[\\/]/).filter(Boolean).pop() || 'unknown';
}

/** 描述终端消息列表支持展示的条目类型。 */
export type Entry =
  | { type: 'user'; text: string }
  | { type: 'assistant_text_thinking'; text: string }
  | { type: 'assistant_text_response'; text: string }
  | { type: 'tool_call'; name: string; args: unknown }
  | { type: 'tool_result'; name: string; args: Record<string, unknown>; text: string }
  | { type: 'error'; text: string };

/** 根据消息类型展示用户输入、思考、正式回复和工具事件。 */
export function Message({ entry }: { entry: Entry }) {
  switch (entry.type) {
    case 'user':
      return (
        <Box flexDirection="column">
          <Text color="green">User</Text>
          <Text>{entry.text}</Text>
        </Box>
      );
    case 'assistant_text_thinking':
      return (
        <Text>
          <Text color="gray">{'Thinking\n'}</Text>
          <Text dimColor>{entry.text}</Text>
        </Text>
      );
    case 'assistant_text_response':
      return (
        <Box flexDirection="column">
          <Text color="cyan">Agent</Text>
          <Text>{entry.text}</Text>
        </Box>
      );
    case 'tool_call': {
      if (entry.name === 'file_read' || entry.name === 'file_write') {
        const operation = entry.name === 'file_read' ? 'Read' : 'Write';
        return (
          <Text color="green" backgroundColor="black">
            {`→ ${operation}: ${getFileName(entry.args)} `}
          </Text>
        );
      }
      if (entry.name === 'terminal_run') {
        const command =
          typeof entry.args === 'object' &&
          entry.args !== null &&
          'command' in entry.args &&
          typeof entry.args.command === 'string'
            ? entry.args.command
            : '';
        return <Text color="blue" backgroundColor="black">{`$ ${command}`}</Text>;
      }
      return <Text color="yellow">{`→ ${entry.name}(${formatArgs(entry.args)})`}</Text>;
    }
    case 'tool_result': {
      if (entry.name === 'file_read' || entry.name === 'file_write') {
        const operation = entry.name === 'file_read' ? 'Read' : 'Write';
        return (
          <Text color="green" backgroundColor="black">
            {`→ ${operation}: ${getFileName(entry.args)} `}
          </Text>
        );
      }
      return <Text color="gray">{truncate(entry.text)}</Text>;
    }
    case 'error':
      return <Text color="red">{`! ${entry.text}`}</Text>;
  }
}
