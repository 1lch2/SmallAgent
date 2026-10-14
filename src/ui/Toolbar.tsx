import { Box, Text } from 'ink';
import type { TokenUsage } from '../types';

/** 统一 Token 计数显示，大数使用一位小数的万、亿单位。 */
function formatTokenCount(tokens: number): string {
  if (tokens >= 100_000_000) return `${(tokens / 100_000_000).toFixed(1)} 亿`;
  if (tokens >= 10_000) return `${(tokens / 10_000).toFixed(1)} 万`;
  return tokens.toLocaleString('en-US');
}

/** 工具栏所需的模型名称与累计用量，不依赖 App 或 Agent。 */
export interface ToolbarProps {
  model?: string;
  usage: TokenUsage;
}

/** 展示模型名称、累计 Token 用量、缓存命中量与输入缓存命中率。 */
export function Toolbar({ model, usage }: ToolbarProps) {
  if (!model) return <Text color='gray'>未连接任何模型 · 使用 /provider 连接服务商</Text>;
  const cacheHitRate = usage.promptTokens > 0 ? usage.cachedTokens / usage.promptTokens : 0;

  return (
    <Box width='100%' justifyContent='space-between' flexWrap='wrap'>
      <Text color='gray'>{model}</Text>
      <Text color='gray'>
        {`${formatTokenCount(usage.totalTokens)} tokens · 缓存 ${formatTokenCount(usage.cachedTokens)} tokens · 命中率 ${(cacheHitRate * 100).toFixed(1)}%`}
      </Text>
    </Box>
  );
}
