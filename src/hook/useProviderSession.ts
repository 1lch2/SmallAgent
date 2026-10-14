import { useContext } from 'react';
import { ProviderSessionContext } from '../ui/ProviderSession';
import type { ProviderSessionState } from '../ui/ProviderSession';

/** 获取服务商会话；命令与界面共用这一入口，不依赖 App。 */
export function useProviderSession(): ProviderSessionState {
  const session = useContext(ProviderSessionContext);
  if (!session) throw new Error('ProviderSession 尚未接入。');
  return session;
}
