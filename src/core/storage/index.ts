import type { AppState, StorageRepository } from '../../contracts';
import { createDefaultState } from '../../state/defaultState';

let memoryState = createDefaultState();

export function createStorageRepository(): StorageRepository {
  return {
    async loadState() {
      return structuredClone(memoryState);
    },
    async saveState(state: AppState) {
      memoryState = structuredClone(state);
    },
    async clear() {
      memoryState = createDefaultState();
    }
  };
}
