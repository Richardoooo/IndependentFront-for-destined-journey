/**
 * Phase 8: 项目内置世界书预加载
 *
 * 运行时通过 fetch 加载 data/worldbooks/*.json，确保始终获取最新文件内容。
 * （不用 import.meta.glob eager，否则构建时打包旧数据，且 HMR 全页刷新）
 */

import type { WorldBook } from './types';

/** 内置世界书文件名列表 */
const BUILTIN_IDS = [
  'world_overview',
  'numerical_design',
  'character_detail',
  'race_detail',
  'region_detail',
  'var_update',
  'fated_core',
  'narrative_guide',
  'event_detail',
];

/** 运行时从 /data/worldbooks/ 加载所有内置世界书 */
export async function loadBuiltInWorldBooks(): Promise<WorldBook[]> {
  const books: WorldBook[] = [];
  for (const id of BUILTIN_IDS) {
    try {
      const res = await fetch(`/data/worldbooks/${id}.json`);
      if (!res.ok) continue;
      const book = (await res.json()) as WorldBook;
      if (book.builtIn) {
        books.push({ ...book, entries: book.entries || [] });
      }
    } catch {
      // 文件不存在或加载失败，跳过
    }
  }
  return books;
}
