import { Box, Text } from 'ink';
import { formatArgs, truncate } from '../utils/format';

export type Entry =
  | { type: 'user'; text: string }
  | { type: 'assistant'; text: string }
  | { type: 'tool_call'; name: string; args: unknown }
  | { type: 'tool_result'; text: string }
  | { type: 'error'; text: string };

export function Message({ entry }: { entry: Entry }) {
  switch (entry.type) {
    case 'user':
      return (
        <Box>
          <Text color="green">{'> '}</Text>
          <Text>{entry.text}</Text>
        </Box>
      );
    case 'assistant':
      return (
        <Box flexDirection="column">
          <Text color="cyan">assistant</Text>
          <Text>{entry.text}</Text>
        </Box>
      );
    case 'tool_call':
      return <Text color="yellow">{`→ ${entry.name}(${formatArgs(entry.args)})`}</Text>;
    case 'tool_result':
      return <Text color="gray">{truncate(entry.text)}</Text>;
    case 'error':
      return <Text color="red">{`! ${entry.text}`}</Text>;
  }
}
