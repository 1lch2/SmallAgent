import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { providers } from './catalog';

/** 一个服务商保存的连接选项、当前模型及凭据。 */
export interface SavedConnection {
  providerId: string;
  baseURL: string;
  model: string;
  apiKey: string;
}

/** 本地保存的服务商连接及当前选择。 */
export interface ProviderSettings {
  selectedProviderId?: string;
  connections: SavedConnection[];
}

/** 持久配置与临时模型缓存的位置。 */
export interface ProviderStoragePaths {
  configFile: string;
  cacheDirectory: string;
}

/** 模型清单缓存，保留厂商返回顺序及数据来源。 */
export interface ModelCatalog {
  models: string[];
  source: 'api' | 'documentation';
  updatedAt: string;
}

/** 默认配置位于用户目录，模型缓存位于系统临时目录。 */
export const providerStoragePaths: ProviderStoragePaths = {
  configFile: join(homedir(), '.smallagent', 'providers.json'),
  cacheDirectory: join(tmpdir(), 'smallagent', 'models'),
};

async function writeJSON(file: string, data: unknown) {
  await mkdir(dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  await rename(temporary, file);
}

/** 读取保存的连接；首次启动没有配置时返回空清单。 */
export async function loadProviderSettings(paths = providerStoragePaths): Promise<ProviderSettings> {
  let text: string;
  try {
    text = await readFile(paths.configFile, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { connections: [] };
    throw new Error('无法读取本地 provider 配置。');
  }
  try {
    const data = JSON.parse(text) as ProviderSettings;
    if (!Array.isArray(data.connections) || (data.selectedProviderId !== undefined && typeof data.selectedProviderId !== 'string')) throw new Error();
    if (!data.connections.every((item) => providers.some((provider) => provider.id === item.providerId)
      && typeof item.baseURL === 'string' && typeof item.model === 'string' && typeof item.apiKey === 'string')) throw new Error();
    return data;
  } catch {
    throw new Error('本地 provider 配置格式无效。');
  }
}

/** 原子保存完整服务商配置及当前选择。 */
export async function saveProviderSettings(settings: ProviderSettings, paths = providerStoragePaths): Promise<void> {
  await writeJSON(paths.configFile, settings);
}

/** 保存连接选项并选中该服务商，不覆盖其他服务商的选项。 */
export async function saveProviderConnection(connection: SavedConnection, paths = providerStoragePaths): Promise<void> {
  const settings = await loadProviderSettings(paths);
  await saveProviderSettings({
    selectedProviderId: connection.providerId,
    connections: [...settings.connections.filter((item) => item.providerId !== connection.providerId), connection],
  }, paths);
}

function modelCacheFile(connection: Pick<SavedConnection, 'providerId' | 'baseURL' | 'apiKey'>, paths: ProviderStoragePaths) {
  const id = createHash('sha256').update(`${connection.providerId}\n${connection.baseURL}\n${connection.apiKey}`).digest('hex');
  return join(paths.cacheDirectory, `${id}.json`);
}

/** 更新当前连接的模型清单缓存；缓存不保存 API Key。 */
export async function saveModelCatalog(connection: SavedConnection, catalog: ModelCatalog, paths = providerStoragePaths): Promise<void> {
  await writeJSON(modelCacheFile(connection, paths), { providerId: connection.providerId, baseURL: connection.baseURL, ...catalog });
}

/** 读取当前连接的模型清单缓存；临时文件丢失或损坏时视为无缓存。 */
export async function loadModelCatalog(connection: SavedConnection, paths = providerStoragePaths): Promise<ModelCatalog | undefined> {
  try {
    const catalog = JSON.parse(await readFile(modelCacheFile(connection, paths), 'utf8')) as ModelCatalog;
    if (!Array.isArray(catalog.models) || !catalog.models.every((model) => typeof model === 'string')
      || !['api', 'documentation'].includes(catalog.source) || typeof catalog.updatedAt !== 'string') return undefined;
    return catalog;
  } catch {
    return undefined;
  }
}
