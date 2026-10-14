import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { providers } from './provider';

/** Agent 工具的工作区限制模式。 */
export type PermissionMode = 'workspace-write' | 'full-access';

/** 权限审批模式对应的界面名称。 */
export const permissionLabels: Record<PermissionMode, string> = {
  'workspace-write': '工作区写入',
  'full-access': '完全许可',
};

/** 一个服务商保存的连接选项、当前模型及凭据。 */
export interface SavedConnection {
  providerId: string;
  baseURL: string;
  model: string;
  apiKey: string;
}

/** 用户目录中统一保存的 Agent 设置和服务商连接。 */
export interface Settings {
  selectedProviderId?: string;
  connections: SavedConnection[];
  subagentModel?: string;
  permission: PermissionMode;
}

/** 用户目录中的统一设置文件。 */
export const settingsFile = join(homedir(), '.liberi', 'settings.json');

/** 通过临时文件重命名原子保存 JSON，以 0600 模式创建文件。 */
async function writeJSON(file: string, data: unknown): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  await rename(temporary, file);
}

/** 读取统一设置；新文件缺失时读取旧服务商配置，首次启动返回空清单。 */
export async function loadSettings(file = settingsFile): Promise<Settings> {
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('无法读取本地设置。');
    try {
      text = await readFile(join(dirname(file), 'providers.json'), 'utf8');
    } catch (legacyError) {
      if ((legacyError as NodeJS.ErrnoException).code === 'ENOENT')
        return { connections: [], permission: 'workspace-write' };
      throw new Error('无法读取旧服务商配置。');
    }
  }
  try {
    const data = JSON.parse(text) as Omit<Settings, 'permission'> & {
      permission?: PermissionMode | 'workspace';
    };
    if (data.permission === 'workspace') data.permission = 'workspace-write';
    if (
      !Array.isArray(data.connections) ||
      (data.selectedProviderId !== undefined && typeof data.selectedProviderId !== 'string') ||
      (data.subagentModel !== undefined && typeof data.subagentModel !== 'string') ||
      (data.permission !== undefined &&
        !['workspace-write', 'full-access'].includes(data.permission))
    )
      throw new Error();
    if (
      !data.connections.every(
        item =>
          providers.some(provider => provider.id === item.providerId) &&
          typeof item.baseURL === 'string' &&
          typeof item.model === 'string' &&
          typeof item.apiKey === 'string'
      )
    )
      throw new Error();
    return { ...data, permission: data.permission ?? 'workspace-write' };
  } catch {
    throw new Error('本地设置格式无效。');
  }
}

/** 原子保存完整设置，统一写入 settings.json。 */
export async function saveSettings(settings: Settings, file = settingsFile): Promise<void> {
  await writeJSON(file, settings);
}

/** 持久配置与临时模型缓存的位置。 */
export interface StoragePaths {
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
export const storagePaths: StoragePaths = {
  configFile: settingsFile,
  cacheDirectory: join(tmpdir(), 'liberi-code', 'models'),
};

/** 保存连接选项并选中该服务商，不覆盖其他服务商的选项。 */
export async function saveProviderConnection(
  connection: SavedConnection,
  paths = storagePaths
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
  paths: StoragePaths
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
  paths = storagePaths
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
  paths = storagePaths
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
