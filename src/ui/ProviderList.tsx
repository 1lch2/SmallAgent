import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { providers } from '../providers/catalog';
import { useProviderSession } from '../hook/useProviderSession';
import { normalizeBaseURL } from '../providers/connect';
import { List } from './List';

/** 服务商页面是否需要等待当前对话结束。 */
export interface ProviderListProps {
  busy: boolean;
}

/** 展示服务商列表、端点与密钥输入，并验证连接后返回聊天界面。 */
export function ProviderList({ busy }: ProviderListProps) {
  const session = useProviderSession();
  const initialIndex = providers.findIndex((item) => item.id === session.settings.selectedProviderId);
  const [selectedIndex, setSelectedIndex] = useState(Math.max(0, initialIndex));
  const [step, setStep] = useState<'list' | 'endpoint' | 'key'>('list');
  const [apiKey, setApiKey] = useState('');
  const [baseURL, setBaseURL] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string>();
  const provider = providers[selectedIndex]!;
  const blocked = busy || session.loadingConfig || connecting;

  function selectProvider() {
    const saved = session.settings.connections.find((item) => item.providerId === provider.id);
    setApiKey(saved?.apiKey ?? '');
    setBaseURL(provider.baseURL ?? saved?.baseURL ?? '');
    setError(undefined);
    setStep(provider.baseURL ? 'key' : 'endpoint');
  }

  useInput((_input, key) => {
    if (key.escape && !connecting) {
      setError(undefined);
      setApiKey('');
      if (step === 'list') session.closeSelection();
      else setStep('list');
      return;
    }
  });

  async function submitKey(value: string) {
    if (blocked) return;
    if (!value.trim()) {
      setError('请输入 API Key。');
      return;
    }
    setConnecting(true);
    setError(undefined);
    try {
      await session.connect(provider, value, baseURL);
      setApiKey('');
    } catch (err) {
      setError(`连接失败：${err instanceof Error ? err.message : '未知错误。'}`);
    } finally {
      setConnecting(false);
    }
  }

  return (
    <Box flexDirection='column' paddingX={2} paddingY={1}>
      <Text bold>选择 Provider</Text>
      <Text dimColor>↑↓ 选择 · Enter 确认 · Esc 返回</Text>
      <List
        items={providers.map((item) => ({
          id: item.id,
          label: `${item.name}${session.connection?.options.providerId === item.id ? '（已连接）' : ''}`,
        }))}
        selectedIndex={selectedIndex}
        onChange={setSelectedIndex}
        onSelect={selectProvider}
        active={!blocked && step === 'list'}
      />
      {step !== 'list' && <Text dimColor>{provider.baseURL ?? baseURL}</Text>}
      {step === 'endpoint' && (
        <Box flexDirection='column'>
          <Text>输入 OpenAI Chat Completion 兼容 API 基础地址：</Text>
          <Box borderStyle='round' paddingX={1}>
            <TextInput
              value={baseURL}
              onChange={setBaseURL}
              focus={!blocked}
              onSubmit={(value) => {
                try {
                  setBaseURL(normalizeBaseURL(value));
                  setError(undefined);
                  setStep('key');
                } catch (err) {
                  setError(err instanceof Error ? err.message : '端点无效。');
                }
              }}
            />
          </Box>
        </Box>
      )}
      {step === 'key' && (
        <Box flexDirection='column'>
          <Text>输入 API Key：</Text>
          <Box borderStyle='round' paddingX={1}>
            <TextInput
              key={`${provider.id}-key`}
              value={apiKey}
              onChange={setApiKey}
              onSubmit={submitKey}
              mask='*'
              focus={!blocked}
            />
          </Box>
          <Text dimColor>连接成功后保存到本机，下次启动自动连接。</Text>
        </Box>
      )}
      {connecting && (
        <Text color='cyan'>
          <Spinner type='dots' /> 正在查询模型并验证连接...
        </Text>
      )}
      {busy && <Text color='yellow'>请等待当前对话结束后连接服务商。</Text>}
      {session.loadingConfig && <Text dimColor>正在读取本地配置...</Text>}
      {error && <Text color='red'>{error}</Text>}
    </Box>
  );
}
