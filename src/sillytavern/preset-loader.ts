/**
 * 预设加载器 (Phase 8)
 *
 * 职责:
 * - 从 data/presets/ 加载预设 JSON 文件
 * - 将预设格式化为 Prompt 的「预设」部分
 */

import type { AgentPreset } from './types';

/** 预设文件路径前缀 */
const PRESET_BASE = '/data/presets/';

/**
 * 从 data/presets/ 加载所有预设
 */
export async function loadPresets(): Promise<AgentPreset[]> {
  // 预设索引从服务器端点获取，或硬编码预设文件名列表
  // 当前通过 fetch 逐个加载
  const presetIds = await fetchPresetIds();
  const presets: AgentPreset[] = [];
  for (const id of presetIds) {
    try {
      const response = await fetch(`${PRESET_BASE}${id}.json`);
      if (!response.ok) continue;
      const preset = await response.json() as AgentPreset;
      presets.push(preset);
    } catch {
      // 加载失败，跳过
    }
  }
  return presets;
}

/** 获取预设 ID 列表 */
async function fetchPresetIds(): Promise<string[]> {
  try {
    const response = await fetch(`${PRESET_BASE}_index.json`);
    if (response.ok) {
      return await response.json() as string[];
    }
  } catch {
    // 无索引文件
  }
  return [];
}

/** 同步版：从预加载数据获取预设 */
export function loadPresetsSync(
  preloaded: Record<string, AgentPreset>,
): AgentPreset[] {
  return Object.values(preloaded);
}

/** 获取指定预设 */
export function getPreset(
  id: string,
  presets: AgentPreset[],
): AgentPreset | undefined {
  return presets.find(p => p.id === id);
}

/**
 * 将预设格式化为 Prompt 的「预设」部分
 * 拼接 fixedSystem + fixedExamples
 */
export function buildPresetSection(preset: AgentPreset): string {
  const parts: string[] = [];

  if (preset.fixedSystem) {
    parts.push(preset.fixedSystem);
  }
  if (preset.fixedExamples) {
    parts.push('---\n' + preset.fixedExamples);
  }

  return parts.join('\n\n');
}
