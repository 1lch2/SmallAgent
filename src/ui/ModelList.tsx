import { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import { useProviderSession } from '../hook/useProviderSession';
import { providers } from '../providers/catalog';
import { List } from './List';

/** 模型选择页面是否需要等待当前对话结束。 */
export interface ModelListProps {
  busy: boolean;
}

/** 展示当前服务商的模型，保存选择后返回聊天界面。 */
export function ModelList({ busy }: ModelListProps) {
  const session = useProviderSession();
  const { connection, loadModels, loadingConfig } = session;
  const [models, setModels] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const blocked = busy || loadingConfig || loading || saving;
  const provider = providers.find(item => item.id === connection?.options.providerId);

  useEffect(() => {
    if (loadingConfig) return;
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    loadModels()
      .then(catalog => {
        if (cancelled) return;
        setModels(catalog.models);
        setSelectedIndex(Math.max(0, catalog.models.indexOf(connection!.options.model)));
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadModels, connection, loadingConfig]);

  useInput((_input, key) => {
    if (key.escape && !saving) session.closeSelection();
  });

  async function select(model: string) {
    if (blocked) return;
    setSaving(true);
    setError(undefined);
    try {
      await session.selectModel(model);
    } catch (err) {
      setError(err instanceof Error ? err.message : '模型切换失败。');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text bold>选择模型{provider ? ` · ${provider.name}` : ''}</Text>
      <Text dimColor>↑↓ 选择 · Enter 确认 · Esc 返回</Text>
      <List
        items={models.map(model => ({
          id: model,
          label: `${model}${model === connection?.options.model ? '（当前）' : ''}`,
        }))}
        selectedIndex={selectedIndex}
        onChange={setSelectedIndex}
        onSelect={item => {
          void select(item.id);
        }}
        active={!blocked}
      />
      {loading && (
        <Text color="cyan">
          <Spinner type="dots" /> 正在读取模型列表...
        </Text>
      )}
      {saving && (
        <Text color="cyan">
          <Spinner type="dots" /> 正在保存模型选择...
        </Text>
      )}
      {busy && <Text color="yellow">请等待当前对话结束后切换模型。</Text>}
      {error && <Text color="red">{error}</Text>}
    </Box>
  );
}
