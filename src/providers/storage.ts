import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { loadSettings, saveSettings, settingsFile, writeJSON } from '../core/settings';
import type { SavedConnection } from '../core/settings';

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
  configFile: settingsFile,
  cacheDirectory: join(tmpdir(), 'liberi-code', 'models'),
};

/** 保存连接选项并选中该服务商，不覆盖其他服务商的选项。 */
export async function saveProviderConnection(
  connection: SavedConnection,
  paths = providerStoragePaths
): Promise<void> {
  const settings = await loadSettings(paths.configFile);
  await saveSettings(
    {
      ...settings,
      selectedProviderId: connection.providerId,
      connections: [
        ...settings.connections.filter(item => item.providerId !== connection.providerId),
        connection,
      ],
    },
    paths.configFile
  );
}

function modelCacheFile(
  connection: Pick<SavedConnection, 'providerId' | 'baseURL' | 'apiKey'>,
  paths: ProviderStoragePaths
) {
  const id = createHash('sha256')
    .update(`${connection.providerId}\n${connection.baseURL}\n${connection.apiKey}`)
    .digest('hex');
  return join(paths.cacheDirectory, `${id}.json`);
}

/** 更新当前连接的模型清单缓存；缓存不保存 API Key。 */
export async function saveModelCatalog(
  connection: SavedConnection,
  catalog: ModelCatalog,
  paths = providerStoragePaths
): Promise<void> {
  await writeJSON(modelCacheFile(connection, paths), {
    providerId: connection.providerId,
    baseURL: connection.baseURL,
    ...catalog,
  });
}

/** 读取当前连接的模型清单缓存；临时文件丢失或损坏时视为无缓存。 */
export async function loadModelCatalog(
  connection: SavedConnection,
  paths = providerStoragePaths
): Promise<ModelCatalog | undefined> {
  try {
    const catalog = JSON.parse(
      await readFile(modelCacheFile(connection, paths), 'utf8')
    ) as ModelCatalog;
    if (
      !Array.isArray(catalog.models) ||
      !catalog.models.every(model => typeof model === 'string') ||
      !['api', 'documentation'].includes(catalog.source) ||
      typeof catalog.updatedAt !== 'string'
    )
      return undefined;
    return catalog;
  } catch {
    return undefined;
  }
}
