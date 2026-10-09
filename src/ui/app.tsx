import { useEffect, useState } from 'react';
import { Box, Text, useStdout } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { Agent, AgentUpdate } from '../core/agent';
import { Entry, Message } from './message';
import { version } from '../../package.json';

/** 管理终端输入和消息列表，并展示 Agent 的输出事件。 */
export function App({ agent, model }: { agent: Agent; model: string }) {
  const { stdout } = useStdout();
  const [terminalRows, setTerminalRows] = useState(stdout.rows ?? 0);
  const [input, setInput] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [busy, setBusy] = useState(false);
  const [usedTokens, setUsedTokens] = useState(0);

  useEffect(() => {
    const handleResize = () => setTerminalRows(stdout.rows ?? 0);
    stdout.on('resize', handleResize);
    return () => {
      stdout.off('resize', handleResize);
    };
  }, [stdout]);

  function handleUpdate(u: AgentUpdate) {
    if (u.kind === 'token_usage') {
      setUsedTokens(u.usedTokens);
      return;
    }
    if (u.kind === 'tool_result' && (u.name === 'file_read' || u.name === 'file_write')) return;

    setEntries((prev) => {
      switch (u.kind) {
        case 'assistant_text_thinking':
        case 'assistant_text_response':
          return [...prev, { type: u.kind, text: u.text }];
        case 'tool_call':
          return [...prev, { type: 'tool_call', name: u.name, args: u.args }];
        case 'tool_result':
          return [...prev, { type: 'tool_result', name: u.name, args: u.args, text: u.output }];
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
    // 为 Ink 重绘后的换行保留一行；仅设置最小高度，让长消息自然延伸。
    <Box flexDirection='column' paddingX={1} minHeight={Math.max(0, terminalRows - 1)}>
      <Box flexDirection='column' flexShrink={0} paddingLeft={1}>
        <Text wrap='truncate-end'>
          <Text bold>{'>_ Small Agent'}</Text>
          <Text dimColor>{` (v${version})`}</Text>
        </Text>
        <Box paddingLeft={3}>
          <Text dimColor wrap='truncate-end'>{process.cwd()}</Text>
        </Box>
      </Box>
      <Box flexDirection='column' flexGrow={1} flexShrink={0} marginBottom={1}>
        {entries.map((entry, i) => (
          <Box key={i} flexDirection='column' marginBottom={1}>
            <Message entry={entry} />
          </Box>
        ))}
        {busy && (
          <Box>
            <Text color='magenta'>
              <Spinner type='dots' />
            </Text>
            <Text> Thinking...</Text>
          </Box>
        )}
      </Box>
      <Box flexDirection='column' flexShrink={0}>
        <Box borderStyle='round' borderColor='gray' paddingX={1}>
          <Text color='green'>{'> '}</Text>
          <TextInput value={input} onChange={setInput} onSubmit={handleSubmit} showCursor />
        </Box>
        <Box width='100%' justifyContent='space-between'>
          <Text color='gray'>{model}</Text>
          <Text color='gray'>{`${(usedTokens / 1000).toFixed(1)}k tokens`}</Text>
        </Box>
      </Box>
    </Box>
  );
}
