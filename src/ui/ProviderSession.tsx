import { createContext, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Agent } from '../core/agent';
import type { ProviderDefinition } from '../providers/catalog';
import { providers } from '../providers/catalog';
import { connectProvider, fetchModelCatalog } from '../providers/connect';
import type { ProviderConnection } from '../providers/connect';
import { loadModelCatalog, loadProviderSettings, providerStoragePaths, saveModelCatalog, saveProviderConnection, saveProviderSettings } from '../providers/storage';
import type { ModelCatalog, ProviderSettings, ProviderStoragePaths } from '../providers/storage';
import { OpenAILLM } from '../openai-llm';

/** 连接、选项和页面状态的共享边界。 */
export interface ProviderSessionState {
  connection?: ProviderConnection;
  agent?: Agent;
  settings: ProviderSettings;
  view: 'chat' | 'providers' | 'models';
  loadingConfig: boolean;
  error?: string;
  openProviders: () => void;
  openModels: () => void;
  closeSelection: () => void;
  loadModels: () => Promise<ModelCatalog>;
  selectModel: (model: string) => Promise<void>;
  removeProvider: (providerId: string) => Promise<void>;
  connect: (provider: ProviderDefinition, apiKey: string, baseURL?: string) => Promise<void>;
}

/** 服务商会话共享上下文，由独立 Hook 读取。 */
export const ProviderSessionContext = createContext<ProviderSessionState | undefined>(undefined);

/** 服务商会话容器的子组件与存储位置。 */
export interface ProviderSessionProps {
  children: ReactNode;
  storagePaths?: ProviderStoragePaths;
}

/** 管理连接和页面状态，启动时只读取本地选项并初始化模型。 */
export function ProviderSession({ children, storagePaths = providerStoragePaths }: ProviderSessionProps) {
  const [connection, setConnection] = useState<ProviderConnection>();
  const [settings, setSettings] = useState<ProviderSettings>({ connections: [] });
  const [view, setView] = useState<ProviderSessionState['view']>('chat');
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [error, setError] = useState<string>();
  const agentRef = useRef<Agent>();

  function activate(next: ProviderConnection) {
    if (agentRef.current) agentRef.current.setLLM(next.llm);
    else agentRef.current = new Agent({ llm: next.llm, cwd: process.cwd() });
    setConnection(next);
  }

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      try {
        const saved = await loadProviderSettings(storagePaths);
        if (cancelled) return;
        setSettings(saved);
        const selected = saved.connections.find((item) => item.providerId === saved.selectedProviderId);
        if (selected) {
          activate({
            options: selected,
            llm: new OpenAILLM({ apiKey: selected.apiKey, baseURL: selected.baseURL, model: selected.model }),
          });
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '本地配置读取失败。');
      } finally {
        if (!cancelled) setLoadingConfig(false);
      }
    }
    void initialize();
    return () => {
      cancelled = true;
    };
  }, [storagePaths]);

  async function connect(provider: ProviderDefinition, apiKey: string, baseURL?: string) {
    const next = await connectProvider(provider, apiKey, baseURL, storagePaths);
    activate(next);
    setSettings((previous) => ({
      selectedProviderId: provider.id,
      connections: [...previous.connections.filter((item) => item.providerId !== provider.id), next.options],
    }));
    setError(undefined);
    setView('chat');
  }

  const loadModels = useCallback(async (): Promise<ModelCatalog> => {
    if (!connection) throw new Error('未连接任何模型，请先使用 /provider 连接服务商。');
    if (connection.catalog) return connection.catalog;
    const cached = await loadModelCatalog(connection.options, storagePaths);
    if (cached?.models.length) return cached;
    const provider = providers.find((item) => item.id === connection.options.providerId)!;
    const catalog = await fetchModelCatalog(provider, connection.options.apiKey, connection.options.baseURL);
    try {
      await saveModelCatalog(connection.options, catalog, storagePaths);
    } catch {
      throw new Error('模型列表已获取，但本地模型缓存保存失败。');
    }
    return catalog;
  }, [connection, storagePaths]);

  async function selectModel(model: string) {
    if (!connection) throw new Error('请先连接服务商。');
    if (model !== connection.options.model) {
      const options = { ...connection.options, model };
      try {
        await saveProviderConnection(options, storagePaths);
      } catch {
        throw new Error('模型选择保存失败，请检查本地配置文件。');
      }
      activate({ ...connection, options, llm: new OpenAILLM(options) });
      setSettings((previous) => ({
        ...previous,
        connections: previous.connections.map((item) => item.providerId === options.providerId ? options : item),
      }));
    }
    setView('chat');
  }

  async function removeProvider(providerId: string) {
    const saved = await loadProviderSettings(storagePaths);
    if (!saved.connections.some((item) => item.providerId === providerId)) return;
    const remaining = saved.connections.filter((item) => item.providerId !== providerId);
    const provider = providers.find((item) => remaining.some((option) => option.providerId === item.id));
    let next: ProviderConnection | undefined;
    if (provider) {
      const options = remaining.find((item) => item.providerId === provider.id)!;
      let catalog = connection?.options.providerId === provider.id ? connection.catalog : undefined;
      catalog ??= await loadModelCatalog(options, storagePaths);
      if (!catalog?.models.length) {
        catalog = await fetchModelCatalog(provider, options.apiKey, options.baseURL);
        await saveModelCatalog(options, catalog, storagePaths);
      }
      const selected = { ...options, model: catalog.models[0]! };
      next = { options: selected, catalog, llm: new OpenAILLM(selected) };
    }
    const updated: ProviderSettings = {
      selectedProviderId: next?.options.providerId,
      connections: remaining.map((item) => item.providerId === next?.options.providerId ? next.options : item),
    };
    try {
      await saveProviderSettings(updated, storagePaths);
    } catch {
      throw new Error('供应商配置删除失败，请检查本地配置文件。');
    }
    setSettings(updated);
    setError(undefined);
    if (next) activate(next);
    else {
      agentRef.current = undefined;
      setConnection(undefined);
      setView('chat');
    }
  }

  return (
    <ProviderSessionContext.Provider
      value={{
        connection,
        agent: agentRef.current,
        settings,
        view,
        loadingConfig,
        error,
        connect,
        loadModels,
        selectModel,
        removeProvider,
        openProviders: () => setView('providers'),
        openModels: () => setView('models'),
        closeSelection: () => setView('chat'),
      }}
    >
      {children}
    </ProviderSessionContext.Provider>
  );
}

