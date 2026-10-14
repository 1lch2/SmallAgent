import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { providers } from '../providers/catalog';

/** Agent 工具的工作区限制模式。 */
export type PermissionMode = 'workspace' | 'full-access';

/** 权限审批模式对应的界面名称。 */
export const permissionLabels: Record<PermissionMode, string> = {
  workspace: '工作区写入',
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
export async function writeJSON(file: string, data: unknown): Promise<void> {
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
        return { connections: [], permission: 'workspace' };
      throw new Error('无法读取旧服务商配置。');
    }
  }
  try {
    const data = JSON.parse(text) as Settings;
    if (
      !Array.isArray(data.connections) ||
      (data.selectedProviderId !== undefined && typeof data.selectedProviderId !== 'string') ||
      (data.subagentModel !== undefined && typeof data.subagentModel !== 'string') ||
      (data.permission !== undefined && !['workspace', 'full-access'].includes(data.permission))
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
    return { ...data, permission: data.permission ?? 'workspace' };
  } catch {
    throw new Error('本地设置格式无效。');
  }
}

/** 原子保存完整设置，统一写入 settings.json。 */
export async function saveSettings(settings: Settings, file = settingsFile): Promise<void> {
  await writeJSON(file, settings);
}
