/**
 * preset-loader 测试 (Phase 8)
 */

import { describe, it, expect } from 'vitest';
import {
  loadPresetsSync,
  getPreset,
  buildPresetSection,
} from './preset-loader';
import type { AgentPreset } from './types';

function makePreset(overrides: Partial<AgentPreset> = {}): AgentPreset {
  return {
    id: 'default-creative',
    name: '默认-创意',
    fixedSystem: '你是一个叙事引擎',
    fixedExamples: '示例输出: ...',
    ...overrides,
  };
}

describe('loadPresetsSync', () => {
  it('returns all presets from preloaded object', () => {
    const preloaded = {
      creative: makePreset({ id: 'creative', name: '创意' }),
      precise: makePreset({ id: 'precise', name: '精准' }),
    };
    const presets = loadPresetsSync(preloaded);
    expect(presets).toHaveLength(2);
  });

  it('returns empty for empty preloaded', () => {
    expect(loadPresetsSync({})).toHaveLength(0);
  });
});

describe('getPreset', () => {
  it('finds preset by ID', () => {
    const presets = [makePreset({ id: 'creative' }), makePreset({ id: 'precise' })];
    const found = getPreset('creative', presets);
    expect(found).toBeDefined();
    expect(found!.id).toBe('creative');
  });

  it('returns undefined for unknown ID', () => {
    const presets = [makePreset({ id: 'creative' })];
    expect(getPreset('nonexistent', presets)).toBeUndefined();
  });
});

describe('buildPresetSection', () => {
  it('joins fixedSystem and fixedExamples', () => {
    const preset = makePreset({
      fixedSystem: '你是叙事引擎',
      fixedExamples: '示例1\n示例2',
    });
    const result = buildPresetSection(preset);
    expect(result).toContain('你是叙事引擎');
    expect(result).toContain('示例1');
  });

  it('returns only fixedSystem when no examples', () => {
    const preset = makePreset({ fixedSystem: '仅系统提示', fixedExamples: '' });
    const result = buildPresetSection(preset);
    expect(result).toBe('仅系统提示');
  });

  it('returns empty for empty preset', () => {
    const preset = makePreset({ fixedSystem: '', fixedExamples: '' });
    expect(buildPresetSection(preset)).toBe('');
  });
});
