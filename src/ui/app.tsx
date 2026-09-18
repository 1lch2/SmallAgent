import { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import type { Agent, AgentUpdate } from '../agent';
import { Message, type Entry } from './message';

export function App({ agent }: { agent: Agent }) {
  const [input, setInput] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [busy, setBusy] = useState(false);

  function handleUpdate(u: AgentUpdate) {
    setEntries((prev) => {
      switch (u.kind) {
        case 'assistant_text':
          return [...prev, { type: 'assistant', text: u.text }];
        case 'tool_call':
          return [...prev, { type: 'tool_call', name: u.name, args: u.args }];
        case 'tool_result':
          return [...prev, { type: 'tool_result', text: u.output }];
        case 'error':
          return [...prev, { type: 'error', text: u.message }];
      }
    });
  }

  async function handleSubmit(value: string) {
    const text = value.trim();
    if (!text || busy) return;
    setInput('');
    setEntries((prev) => [...prev, { type: 'user', text }]);
    setBusy(true);
    try {
      await agent.send(text, handleUpdate);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box flexDirection="column" marginBottom={1}>
        {entries.map((entry, i) => (
          <Box key={i} flexDirection="column" marginBottom={1}>
            <Message entry={entry} />
          </Box>
        ))}
        {busy && (
          <Box>
            <Text color="magenta"><Spinner type="dots" /></Text>
            <Text> thinking...</Text>
          </Box>
        )}
      </Box>
      <Box borderStyle="round" borderColor="gray" paddingX={1}>
        <Text color="green">{'> '}</Text>
        <TextInput value={input} onChange={setInput} onSubmit={handleSubmit} />
      </Box>
    </Box>
  );
}
