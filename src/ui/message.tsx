import { Box, Text } from 'ink';
import { formatArgs, truncate } from '../utils/format';

/** 描述终端消息列表支持展示的条目类型。 */
export type Entry =
  | { type: 'user'; text: string }
  | { type: 'assistant_text_thinking'; text: string }
  | { type: 'assistant_text_response'; text: string }
  | { type: 'tool_call'; name: string; args: unknown }
  | { type: 'tool_result'; text: string }
  | { type: 'error'; text: string };

/** 根据消息类型展示用户输入、思考、正式回复和工具事件。 */
export function Message({ entry }: { entry: Entry }) {
  switch (entry.type) {
    case 'user':
      return (
        <Box flexDirection='column'>
          <Text color='green'>User</Text>
          <Text>{entry.text}</Text>
        </Box>
      );
    case 'assistant_text_thinking':
      return (
        <Text>
          <Text color='gray'>{'Thinking\n'}</Text>
          <Text dimColor>{entry.text}</Text>
        </Text>
      );
    case 'assistant_text_response':
      return (
        <Box flexDirection='column'>
          <Text color='cyan'>Agent</Text>
          <Text>{entry.text}</Text>
        </Box>
      );
    case 'tool_call':
      return <Text color='yellow'>{`→ ${entry.name}(${formatArgs(entry.args)})`}</Text>;
    case 'tool_result':
      return <Text color='gray'>{truncate(entry.text)}</Text>;
    case 'error':
      return <Text color='red'>{`! ${entry.text}`}</Text>;
  }
}
