import type { AppState } from '../../contracts';
import { readStateEnvelope, STATE_VERSION, withoutCredentials } from './schema';

export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;

/** A versioned, portable backup; credentials never leave the browser with a backup. */
export function exportAppState(state: AppState): Blob {
  return new Blob([JSON.stringify({
    format: 'mira-companion', version: STATE_VERSION, exportedAt: new Date().toISOString(),
    state: withoutCredentials(state, true)
  }, null, 2)], { type: 'application/json' });
}

/** Validates completely before the caller replaces its current state. */
export async function importAppState(input: Blob | string): Promise<AppState> {
  if ((typeof input === 'string' ? new Blob([input]).size : input.size) > MAX_IMPORT_BYTES) {
    throw new Error('备份文件超过 20 MB，请选择较小的 Mira 备份。');
  }
  try {
    const value: unknown = JSON.parse(typeof input === 'string' ? input : await input.text());
    if (!value || typeof value !== 'object' || !('format' in value) || value.format !== 'mira-companion') {
      throw new Error('Invalid backup format');
    }
    return withoutCredentials(readStateEnvelope(value), true);
  } catch {
    // Never echo imported text or secrets in errors.
    throw new Error('无法导入：文件不是有效的 Mira v1 备份，原有数据未更改。');
  }
}
