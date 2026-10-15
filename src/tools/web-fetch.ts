import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TMP_DIRECTORY } from '../core/settings';
import type { ToolDefinition } from '../types';
import { errorMessage } from '../utils/error';
import { truncateBytes } from '../utils/format-text';
import { isPrivateAddress, isPrivateHostname } from '../utils/private-network';
import { errorBodyPreview, readWebPage, WebFetchError } from '../utils/web-reader';

/** 抓取时使用的默认超时毫秒数。 */
const DEFAULT_TIMEOUT_MS = 15_000;

/** 允许的请求超时区间。 */
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 60_000;

/** 覆盖多跳重定向与提取的整体时间预算。 */
const OVERALL_BUDGET_MS = 25_000;

/** 低于该长度的正文视为提取失败，不再返回给模型。 */
const MIN_TEXT_LENGTH = 200;

/** 正文内联返回的字符上限，超过则写入临时文件。 */
const OUTPUT_INLINE_LIMIT = 40_000;

/** 写入临时文件的正文上限。 */
const OUTPUT_FILE_LIMIT = 4 * 1024 * 1024;

/** 写入临时文件时附在结果中的预览长度。 */
const PREVIEW_LENGTH = 2_000;

/** 允许直接读取的文本类媒体类型。 */
const TEXT_MEDIA_TYPES = ['text/plain', 'text/markdown'];

/** 需要走 HTML 正文提取的媒体类型。 */
const HTML_MEDIA_TYPES = ['text/html', 'application/xhtml+xml'];

/** 本工具发送的固定 User-Agent 前缀。 */
const USER_AGENT_NAME = 'liberi-code';

/** 从 package.json 读取版本号，失败时回退为 unknown。 */
function packageVersion(): string {
  try {
    const file = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json');
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as { version?: string };
    return parsed.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

const USER_AGENT = `${USER_AGENT_NAME}/${packageVersion()} (+https://github.com/1lch2/liberi-code)`;

/** 抓取网页时允许的显式请求参数。 */
interface WebFetchArgs {
  url: string;
  timeout: number;
}

/** 解析工具参数，并收敛超时取值。 */
function parseArgs(args: Record<string, unknown>): WebFetchArgs {
  const raw = args.url;
  const url = typeof raw === 'string' ? raw.trim() : '';
  if (!url) throw new WebFetchError('缺少必填参数 url。');

  const requested = Number(args.timeout);
  const timeout = Number.isFinite(requested)
    ? Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.round(requested)))
    : DEFAULT_TIMEOUT_MS;
  return { url, timeout };
}

/** 校验目标地址可公开访问：仅 http/https、不含凭据、不指向内网。 */
async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new WebFetchError(`请输入有效的 http 或 https URL：${raw}`);
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new WebFetchError(`仅支持 http 与 https 协议，收到 ${url.protocol}`);
  }
  if (url.username || url.password) {
    throw new WebFetchError('URL 不得包含用户名或密码。');
  }

  const hostname = url.hostname;
  if (isPrivateHostname(hostname) || isPrivateAddress(hostname)) {
    throw new WebFetchError(
      `出于安全策略，web_fetch 拒绝访问内网或本机地址（${hostname}）。这不是网络故障。`
    );
  }

  // 字面量 IP 已在上一步判定；域名需解析后逐个地址复核，避免字符串层面的绕过。
  if (isIP(hostname) === 0) {
    let addresses: { address: string }[];
    try {
      addresses = await lookup(hostname, { all: true });
    } catch (error) {
      throw new WebFetchError(`无法解析域名 ${hostname}：${errorMessage(error)}`);
    }
    if (addresses.length === 0) throw new WebFetchError(`域名 ${hostname} 未解析到任何地址。`);

    const blocked = addresses.find(item => isPrivateAddress(item.address));
    if (blocked) {
      throw new WebFetchError(
        `出于安全策略，web_fetch 拒绝访问内网或本机地址（${hostname} → ${blocked.address}）。这不是网络故障。`
      );
    }
  }

  return url;
}

/** 组装返回给模型的正文；超长时写入临时文件并返回预览与路径。 */
async function buildContentOutput(
  url: string,
  title: string | undefined,
  text: string
): Promise<string> {
  const header = [title ? `# ${title}` : undefined, `> ${url}`].filter(Boolean).join('\n');
  if (text.length <= OUTPUT_INLINE_LIMIT) return `${header}\n\n${text}`;

  const directory = join(TMP_DIRECTORY, 'web');
  const host = new URL(url).hostname.replace(/[^\w.-]/g, '_');
  const file = join(
    directory,
    `${host}-${createHash('sha256').update(url).digest('hex').slice(0, 8)}.md`
  );
  const note =
    `正文 ${text.length} 字符，超过内联上限 ${OUTPUT_INLINE_LIMIT}，完整内容已写入临时文件。` +
    '需要完整内容时用 file_read 读取该路径。';

  try {
    await mkdir(directory, { recursive: true });
    await writeFile(file, truncateBytes(text, OUTPUT_FILE_LIMIT), 'utf8');
    return `${header}\n> ${note}\n> 临时文件：${file}\n\n${text.slice(0, PREVIEW_LENGTH)}\n\n...（预览结束）`;
  } catch (error) {
    return (
      `${header}\n> 正文超过内联上限且写入临时文件失败（${errorMessage(error)}），` +
      `以下为按大小截断的正文。\n\n${truncateBytes(text, OUTPUT_INLINE_LIMIT)}`
    );
  }
}

/** 抓取一个 URL，并把正文转换为 Markdown 返回给模型。 */
export async function webFetch(args: Record<string, unknown>): Promise<string> {
  const { url, timeout } = parseArgs(args);
  const target = await assertPublicUrl(url);

  const page = await readWebPage(target.href, {
    timeout,
    budget: OVERALL_BUDGET_MS,
    extract: true,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,text/plain,text/markdown;q=0.9,*/*;q=0.5',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    },
    onHop: async next => {
      await assertPublicUrl(next.href);
    },
  });

  if (page.status < 200 || page.status >= 300) {
    const body = errorBodyPreview(page);
    return [
      `web_fetch 收到非成功响应：HTTP ${page.status} ${page.statusText}`,
      `> 请求地址：${url}`,
      `> 最终地址：${page.finalUrl}`,
      page.contentType ? `> 响应类型：${page.contentType}` : undefined,
      body ? `\n响应体预览：\n${body}` : undefined,
    ]
      .filter(Boolean)
      .join('\n');
  }

  // 纯文本与 Markdown 直接透传，不做正文提取。
  const isText = page.contentType !== undefined && TEXT_MEDIA_TYPES.includes(page.contentType);
  if (page.contentType !== undefined && !isText && !HTML_MEDIA_TYPES.includes(page.contentType)) {
    throw new WebFetchError(
      `不支持的响应类型（${page.contentType}）。web_fetch 仅处理 HTML、纯文本和 Markdown。`
    );
  }

  const content = isText ? page.raw : page.text;
  if (content.trim().length < MIN_TEXT_LENGTH) {
    throw new WebFetchError(
      `web_fetch 无法从该页面提取有效正文（${page.finalUrl}）。` +
        '常见原因是页面依赖客户端 JavaScript 渲染、需要登录，或返回的是验证页。' +
        '本工具仅支持服务端渲染的静态 HTML 与文本，请改用其他来源，或把内容直接提供给我。'
    );
  }

  const notes = [
    isText
      ? '提取方式：纯文本透传'
      : `提取方式：${page.extracted ? 'Readability 正文' : '整页回退'}`,
    page.truncated ? '响应体超过 2 MiB 上限，此处仅为已读取的部分。' : undefined,
  ].filter(Boolean);
  const output = await buildContentOutput(page.finalUrl, page.title, content);
  return `${output}\n> ${notes.join('；')}`;
}

/** 注册网页抓取工具及其模型参数定义。 */
export const webFetchTool = {
  definition: {
    name: 'web_fetch',
    description:
      'Fetch a URL over HTTP(S) and return its main content as Markdown, with navigation, ads and sidebars removed. No extra configuration is needed. Pages that require client-side JavaScript rendering, and responses that are not HTML or text, are reported as unsupported with the reason stated; asking for the same URL again will not change that outcome. Very long content is written to a temporary file whose path is returned; read that file with file_read only if you need the full text.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Absolute http(s) URL to fetch.' },
        timeout: {
          type: 'number',
          description:
            'Request timeout in milliseconds, between 1000 and 60000. Defaults to 15000.',
        },
      },
      required: ['url'],
      additionalProperties: false,
    },
  } satisfies ToolDefinition,
  execute: webFetch,
};
