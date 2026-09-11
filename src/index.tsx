import 'dotenv/config';
import { useMemo, useState } from 'react';
import { Box, render, Text } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { Agent, type AgentUpdate } from './agent';

type Entry =
  | { type: 'user'; text: string }
  | { type: 'assistant'; text: string }
  | { type: 'tool_call'; name: string; args: unknown }
  | { type: 'tool_result'; text: string }
  | { type: 'error'; text: string };

const TRUNCATE_LIMIT = 600;

function truncate(text: string): string {
  if (text.length <= TRUNCATE_LIMIT) return text;
  return text.slice(0, TRUNCATE_LIMIT) + `\n... (truncated, ${text.length} chars total)`;
}

function formatArgs(args: unknown): string {
  try {
    return JSON.stringify(args);
  } catch {
    return String(args);
  }
}

export function App() {
  const [input, setInput] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [busy, setBusy] = useState(false);

  const agent = useMemo(() => {
    const baseURL = process.env.OPENAI_BASE_URL;
    const model = process.env.SMALLAGENT_MODEL;
    if (!baseURL) {
      throw new Error('OPENAI_BASE_URL is required. Set it in .env or as an environment variable.');
    }
    if (!model) {
      throw new Error('SMALLAGENT_MODEL is required. Set it in .env or as an environment variable.');
    }
    return new Agent({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL,
      model,
      cwd: process.cwd(),
    });
  }, []);

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
            {entry.type === 'user' && (
              <Box>
                <Text color="green">{'> '}</Text>
                <Text>{entry.text}</Text>
              </Box>
            )}
            {entry.type === 'assistant' && (
              <Box flexDirection="column">
                <Text color="cyan">assistant</Text>
                <Text>{entry.text}</Text>
              </Box>
            )}
            {entry.type === 'tool_call' && (
              <Text color="yellow">{`→ ${entry.name}(${formatArgs(entry.args)})`}</Text>
            )}
            {entry.type === 'tool_result' && (
              <Text color="gray">{truncate(entry.text)}</Text>
            )}
            {entry.type === 'error' && (
              <Text color="red">{`! ${entry.text}`}</Text>
            )}
          </Box>
        ))}
        {busy && (
          <Box>
            <Text color="magenta">
              <Spinner type="dots" />
            </Text>
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

try {
  render(<App />);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exit(1);
}