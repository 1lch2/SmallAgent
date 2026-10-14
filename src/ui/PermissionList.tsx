import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { permissionLabels } from '../core/settings';
import type { PermissionMode } from '../core/settings';
import { useProviderSession } from '../hook/useProviderSession';
import { List } from './List';

/** 权限模式选择页面的对话忙碌状态。 */
export interface PermissionListProps {
  busy: boolean;
}

/** 选择并保存权限审批模式，保存或取消后返回设置页。 */
export function PermissionList({ busy }: PermissionListProps) {
  const session = useProviderSession();
  const [selectedIndex, setSelectedIndex] = useState(
    session.settings.permission === 'workspace-write' ? 0 : 1
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const blocked = busy || session.loadingConfig || saving;

  useInput((_input, key) => {
    if (key.escape && !saving) session.openConfig();
  });

  async function select(permission: PermissionMode) {
    if (blocked) return;
    setSaving(true);
    setError(undefined);
    try {
      await session.selectPermission(permission);
    } catch (err) {
      setError(err instanceof Error ? err.message : '权限模式保存失败。');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text bold>权限审批模式</Text>
      <Text dimColor>↑↓ 选择 · Enter 保存 · Esc 返回</Text>
      <List
        items={[
          { id: 'workspace-write', label: permissionLabels['workspace-write'] },
          { id: 'full-access', label: permissionLabels['full-access'] },
        ]}
        selectedIndex={selectedIndex}
        onChange={setSelectedIndex}
        onSelect={item => {
          void select(item.id as PermissionMode);
        }}
        active={!blocked}
      />
      {saving && <Text dimColor>正在保存权限模式...</Text>}
      {busy && <Text color="yellow">请等待当前对话结束后切换权限模式。</Text>}
      {error && <Text color="red">{error}</Text>}
    </Box>
  );
}
