import { useEffect, useState } from 'react';
import { Box, Text, useStdout } from 'ink';
import Spinner from 'ink-spinner';
import { AgentUpdate } from '../core/agent';
import { Entry, Message } from './Message';
import { version } from '../../package.json';
import { CommandInput } from './CommandInput';
import { Toolbar } from './Toolbar';
import type { TokenUsage } from '../types';
import { useProviderSession } from '../hook/useProviderSession';
import { ProviderList } from './ProviderList';
import { ModelList } from './ModelList';
import { useCommands } from '../hook/useCommands';

/** 管理终端输入和消息列表，并展示 Agent 的输出事件。 */
export function App() {
  const session = useProviderSession();
  const commands = useCommands();
  const { agent, connection } = session;
  const { stdout } = useStdout();
  const [terminalRows, setTerminalRows] = useState(stdout.rows ?? 0);
  const [input, setInput] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [busy, setBusy] = useState(false);
  const [tokenUsage, setTokenUsage] = useState<TokenUsage>({ totalTokens: 0, promptTokens: 0, cachedTokens: 0 });

  useEffect(() => {
    setTokenUsage({ totalTokens: 0, promptTokens: 0, cachedTokens: 0 });
  }, [connection]);

  useEffect(() => {
    const handleResize = () => setTerminalRows(stdout.rows ?? 0);
    stdout.on('resize', handleResize);
    return () => {
      stdout.off('resize', handleResize);
    };
  }, [stdout]);

  function handleUpdate(u: AgentUpdate) {
    if (u.kind === 'token_usage') {
      setTokenUsage(u.usage);
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
    if (!agent || !connection) {
      setEntries((previous) => [...previous, { type: 'error', text: '未连接任何模型，请使用 /provider 连接服务商。' }]);
      return;
    }
    setInput('');
    setEntries((prev) => [...prev, { type: 'user', text }]);
    setBusy(true);
    try {
      await agent.send(text, handleUpdate);
    } finally {
      setBusy(false);
    }
  }

  if (session.view === 'providers') return <ProviderList busy={busy} />;
  if (session.view === 'models') return <ModelList busy={busy} />;

  return (
    // 为 Ink 重绘后的换行保留一行；仅设置最小高度，让长消息自然延伸。
    <Box flexDirection='column' paddingX={1} minHeight={Math.max(0, terminalRows - 1)}>
      {!entries.some((entry) => entry.type === 'user') && (
        <Box flexDirection='column' flexShrink={0} paddingLeft={1}>
          <Text wrap='truncate-end'>
            <Text bold>{'>_ Small Agent'}</Text>
            <Text dimColor>{` (v${version})`}</Text>
          </Text>
          <Box paddingLeft={3}>
            <Text dimColor wrap='truncate-end'>
              {process.cwd()}
            </Text>
          </Box>
        </Box>
      )}
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
        <CommandInput value={input} onChange={setInput} onSubmit={handleSubmit} commands={commands} />
        {session.loadingConfig && <Text dimColor>正在读取本地配置...</Text>}
        {session.error && <Text color='yellow'>{session.error} 使用 /provider 重新连接。</Text>}
        <Toolbar model={connection?.options.model} usage={tokenUsage} />
      </Box>
    </Box>
  );
}
