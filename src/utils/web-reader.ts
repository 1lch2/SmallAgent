import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import { NodeHtmlMarkdown } from 'node-html-markdown';
import { errorMessage } from './error';
import { truncateBytes } from './format-text';

/** 响应体大小上限；超出后只保留已读取的部分并标记截断。 */
export const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

/** 重定向跳数上限；每一跳都由调用方重新校验。 */
export const MAX_REDIRECTS = 5;

/** Readability 判定正文的最小字符数，低于此值视为正文不可用。 */
const CHAR_THRESHOLD = 500;

/** 整页回退时去除的页面骨架容器。 */
const PAGE_CHROME_SELECTORS = ['script', 'style', 'noscript', 'nav', 'aside', 'footer'];

/** 嗅探 HTML 编码所需的最大字节数。 */
const CHARSET_PROBE_BYTES = 2048;

/** 非成功响应时保留的响应体预览上限。 */
const ERROR_BODY_LIMIT = 8 * 1024;

/** 显式引用 Web URL 类型，避免被同名参数遮蔽。 */
type URL = globalThis.URL;

/** 一次网页抓取的可选控制项。 */
export interface ReadWebPageOptions {
  /** 单个请求的超时毫秒数。 */
  timeout: number;
  /** 整个抓取过程的超时毫秒数，覆盖多跳重定向。 */
  budget: number;
  /** 是否按 HTML 提取正文；纯文本与 Markdown 传 false。 */
  extract: boolean;
  /** 每跳重定向前调用，用于校验即将访问的地址。 */
  onHop?: (url: URL) => Promise<void>;
  /** 请求附加的首部，例如固定的 User-Agent。 */
  headers?: Record<string, string>;
}

/** 一次网页抓取与正文提取的结果。 */
export interface ReadWebPageResult {
  /** 最终的 HTTP 响应状态。 */
  status: number;
  /** 响应状态文本。 */
  statusText: string;
  /** 跟随重定向后的最终地址，用于把相对链接转为绝对地址。 */
  finalUrl: string;
  /** 页面标题，仅 HTML 提取时可能提供。 */
  title?: string;
  /** 提取出的正文 Markdown；纯文本响应与原始内容一致。 */
  text: string;
  /** 解码后的原始响应体，供调用方按需透传。 */
  raw: string;
  /** 正文是否来自 Readability，false 表示整页回退或纯文本透传。 */
  extracted: boolean;
  /** 已读取的响应体字节数。 */
  bytes: number;
  /** 响应体是否因为大小上限被截断。 */
  truncated: boolean;
  /** 响应声明的媒体类型，无法解析时为 undefined。 */
  contentType?: string;
}

/** 抓取失败时携带可读原因的错误。 */
export class WebFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebFetchError';
  }
}

/** 读取响应头声明的媒体类型，去掉参数部分并转小写。 */
function mediaType(contentType: string | null): string | undefined {
  const value = contentType?.split(';')[0]?.trim().toLowerCase();
  return value || undefined;
}

/** 从响应头、BOM 和 HTML meta 中确定字符编码。 */
function detectCharset(contentType: string | null, bytes: Uint8Array): string {
  const headerCharset = /charset\s*=\s*["']?([\w-]+)/i.exec(contentType ?? '')?.[1];
  if (headerCharset) return headerCharset;

  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return 'utf-8';
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return 'utf-16le';
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return 'utf-16be';

  // 头部通常是 ASCII，用 latin1 映射可以安全地做字节级匹配。
  const head = Buffer.from(bytes.subarray(0, CHARSET_PROBE_BYTES)).toString('latin1');
  return (
    /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(head)?.[1] ??
    /<meta[^>]+content\s*=\s*["'][^"']*charset\s*=\s*([\w-]+)/i.exec(head)?.[1] ??
    'utf-8'
  );
}

/** 按检测到的编码解码响应字节，遇到不支持的编码时回退 UTF-8。 */
function decodeBytes(bytes: Uint8Array, contentType: string | null): string {
  const charset = detectCharset(contentType, bytes);
  const offset =
    bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
  const body = bytes.subarray(offset);
  try {
    return new TextDecoder(charset).decode(body);
  } catch {
    return new TextDecoder('utf-8').decode(body);
  }
}

/** 读取响应体，超过大小上限时中止并标记截断。 */
async function readBodyLimited(
  response: Response
): Promise<{ bytes: Uint8Array; truncated: boolean }> {
  if (!response.body) return { bytes: new Uint8Array(), truncated: false };

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;

  try {
    while (total < MAX_RESPONSE_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      const room = MAX_RESPONSE_BYTES - total;
      if (value.byteLength > room) {
        chunks.push(value.subarray(0, room));
        total = MAX_RESPONSE_BYTES;
        truncated = true;
        break;
      }
      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  return { bytes: Buffer.concat(chunks, total), truncated };
}

/** 读取重定向目标；缺少或无法解析 Location 时抛出可读错误。 */
function redirectTarget(response: Response, current: URL): URL {
  const location = response.headers.get('location');
  if (!location) throw new WebFetchError(`HTTP ${response.status} 重定向缺少 Location 响应头。`);
  try {
    return new URL(location, current);
  } catch {
    throw new WebFetchError(`无效的重定向地址：${location}`);
  }
}

/** 抓取页面并跟随重定向，返回最终地址和受限的响应体。 */
async function requestWithRedirects(
  initialUrl: string,
  options: ReadWebPageOptions
): Promise<{
  response: Response;
  finalUrl: string;
  bytes: Uint8Array;
  truncated: boolean;
}> {
  const deadline = Date.now() + options.budget;
  let current = new URL(initialUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw new WebFetchError(`抓取超时（${options.budget} 毫秒预算已用尽）：${current.href}`);
    }

    let response: Response;
    try {
      response = await fetch(current, {
        redirect: 'manual',
        signal: AbortSignal.timeout(Math.min(options.timeout, remaining)),
        headers: options.headers,
      });
    } catch (error) {
      if ((error as Error)?.name === 'TimeoutError') {
        throw new WebFetchError(`请求超时（${options.timeout} 毫秒）：${current.href}`);
      }
      throw new WebFetchError(`无法访问 ${current.href}：${errorMessage(error)}`);
    }

    if (response.status < 300 || response.status >= 400) {
      const { bytes, truncated } = await readBodyLimited(response);
      return { response, finalUrl: response.url || current.href, bytes, truncated };
    }

    await response.body?.cancel().catch(() => undefined);
    if (hop === MAX_REDIRECTS) {
      throw new WebFetchError(`重定向次数超过上限（${MAX_REDIRECTS} 次），已停止跟随。`);
    }
    current = redirectTarget(response, current);
    await options.onHop?.(current);
  }

  throw new WebFetchError(`重定向次数超过上限（${MAX_REDIRECTS} 次），已停止跟随。`);
}

/** 注入 base 元素，使相对链接与图片在序列化时解析为绝对地址。 */
function injectBaseUrl(document: Document, url: string): void {
  const existing = document.querySelector('base');
  if (existing) {
    existing.setAttribute('href', url);
    return;
  }
  const base = document.createElement('base');
  base.setAttribute('href', url);
  (document.head ?? document.documentElement)?.appendChild(base);
}

/** 整页回退时去掉脚本、导航、页脚等页面骨架。 */
function stripPageChrome(document: Document): void {
  for (const selector of PAGE_CHROME_SELECTORS) {
    for (const element of document.querySelectorAll(selector)) element.remove();
  }
  for (const element of document.querySelectorAll('header[role="banner"]')) element.remove();
}

/** 用 Readability 提取正文，失败时回退整页转换。 */
function extractArticle(
  html: string,
  base: string
): { title?: string; text: string; extracted: boolean } {
  const { document } = parseHTML(html);
  const documentTitle = document.title?.trim() || undefined;

  // Readability 可能直接返回绝对链接；注入 base 保证 linkedom 序列化时补全其余相对链接。
  const clone = document.cloneNode(true) as unknown as Document;
  injectBaseUrl(clone, base);

  let article: ReturnType<Readability['parse']> = null;
  try {
    article = new Readability(clone, {
      charThreshold: CHAR_THRESHOLD,
      serializer: (node: Node) => node.toString(),
    }).parse();
  } catch {
    article = null;
  }

  if (article?.content && (article.textContent?.trim().length ?? 0) >= CHAR_THRESHOLD) {
    return {
      title: article.title?.trim() || documentTitle,
      text: NodeHtmlMarkdown.translate(article.content).trim(),
      extracted: true,
    };
  }

  stripPageChrome(document as unknown as Document);
  return {
    title: documentTitle,
    text: NodeHtmlMarkdown.translate(document.toString()).trim(),
    extracted: false,
  };
}

/** 抓取一个网页并解码内容；HTML 按需提取正文，其余类型原样返回。 */
export async function readWebPage(
  url: string,
  options: ReadWebPageOptions
): Promise<ReadWebPageResult> {
  await options.onHop?.(new URL(url));
  const { response, finalUrl, bytes, truncated } = await requestWithRedirects(url, options);
  const contentType = response.headers.get('content-type');
  const type = mediaType(contentType);
  const body = decodeBytes(bytes, contentType);
  const common = {
    status: response.status,
    statusText: response.statusText,
    finalUrl,
    bytes: bytes.byteLength,
    truncated,
    contentType: type,
  };

  // 只有 HTML 才做正文提取；纯文本、JSON 等直接透传，避免用 HTML 解析器解析非 HTML。
  const isHtml = type === undefined || type === 'text/html' || type === 'application/xhtml+xml';
  if (!options.extract || !isHtml) {
    return { ...common, text: body, raw: body, extracted: false };
  }

  const article = extractArticle(body, finalUrl);
  return {
    ...common,
    title: article.title,
    text: article.text,
    raw: body,
    extracted: article.extracted,
  };
}

/** 截取非成功响应的响应体预览，供工具层反馈给模型。 */
export function errorBodyPreview(result: ReadWebPageResult): string {
  return truncateBytes(result.raw.slice(0, ERROR_BODY_LIMIT), ERROR_BODY_LIMIT)
    .replace(/\s+/g, ' ')
    .trim();
}
