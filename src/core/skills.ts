import { readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { parse } from 'yaml';
import { errorMessage } from '../utils/error';

/** 会话启动时注册的 skill 元数据，path 指向完整的 SKILL.md。 */
export interface SkillMetadata {
  name: string;
  description: string;
  path: string;
}

function readSkill(path: string): SkillMetadata | undefined {
  let content: string;
  try {
    content = readFileSync(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }

  const frontmatter = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(content);
  try {
    const metadata = frontmatter ? parse(frontmatter[1]) : undefined;
    if (
      typeof metadata?.name !== 'string' ||
      !metadata.name.trim() ||
      typeof metadata?.description !== 'string' ||
      !metadata.description.trim()
    ) {
      throw new Error('YAML frontmatter 必须包含非空的 name 和 description 字符串。');
    }
    return { name: metadata.name.trim(), description: metadata.description.trim(), path };
  } catch (error) {
    console.warn(`跳过无效 skill（${path}）：${errorMessage(error)}`);
    return;
  }
}

/** 加载工作区及用户目录的 skill 元数据，同名时保留工作区版本。 */
export function loadSkills(cwd: string): SkillMetadata[] {
  const skills = new Map<string, SkillMetadata>();
  for (const directory of [
    resolve(cwd, '.agents', 'skills'),
    join(homedir(), '.liberi', 'skills'),
  ]) {
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }

    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      const skill = readSkill(join(directory, entry.name, 'SKILL.md'));
      if (skill && !skills.has(skill.name)) skills.set(skill.name, skill);
    }
  }
  return [...skills.values()];
}
