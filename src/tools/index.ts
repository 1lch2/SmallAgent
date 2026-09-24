import { errorMessage } from '../utils/error';
import type { ToolDefinition } from '../types';
import { fileReadTool } from './file-read';
import { fileWriteTool } from './file-write';
import { terminalRunTool } from './terminal-run';

type ToolHandler = {
  definition: ToolDefinition;
  execute: (args: Record<string, unknown>, cwd: string) => Promise<string>;
};

const registeredTools: ToolHandler[] = [fileReadTool, fileWriteTool, terminalRunTool];
const toolRegistry = new Map<string, ToolHandler>(
  registeredTools.map((tool): [string, ToolHandler] => [tool.definition.name, tool]),
);

/** 返回传给模型的工具定义列表。 */
export const tools: ToolDefinition[] = Array.from(toolRegistry.values(), ({ definition }) => definition);

/** 按名称执行已注册工具，并把异常转换为可返回给模型的文本。 */
export async function executeTool(name: string, args: Record<string, unknown>, cwd: string): Promise<string> {
  const tool = toolRegistry.get(name);
  if (!tool) return `Unknown tool: ${name}`;

  try {
    return await tool.execute(args, cwd);
  } catch (err) {
    return `Error: ${errorMessage(err)}`;
  }
}
