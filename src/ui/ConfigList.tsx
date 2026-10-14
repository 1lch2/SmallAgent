import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useProviderSession } from '../hook/useProviderSession';
import { List } from './List';
import { permissionLabels } from '../core/settings';

/** 使用通用列表展示 Agent 设置，选择配置项后进入对应编辑页面。 */
export function ConfigList() {
  const session = useProviderSession();
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((_input, key) => {
    if (key.escape) session.closeSelection();
  });

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text bold>Agent 设置</Text>
      <Text dimColor>↑↓ 选择 · Enter 配置 · Esc 返回</Text>
      <List
        items={[
          {
            id: 'subagent-model',
            label: 'subagent model',
            comment: '用于配置 subagent 所使用的模型',
            value: session.settings.subagentModel ?? '未设置',
          },
          {
            id: 'permission',
            label: 'permission',
            comment: 'agent 权限审批模式',
            value: permissionLabels[session.settings.permission],
          },
        ]}
        selectedIndex={selectedIndex}
        onChange={setSelectedIndex}
        onSelect={item => {
          if (item.id === 'permission') session.openPermissions();
          else session.openSubagentModels();
        }}
        active={!session.loadingConfig}
      />
      <Text dimColor>从当前 Provider 的模型清单选择；subagent 功能尚未实现。</Text>
      {session.loadingConfig && <Text dimColor>正在读取本地配置...</Text>}
      {session.error && <Text color="red">{session.error}</Text>}
    </Box>
  );
}
