import type { AppController, AppState, Memory, PersonaId, ProviderConfig } from '../contracts';
import { createStorageRepository } from '../core/storage';
import { createDefaultState } from './defaultState';

export function createCompanionController(): AppController {
  let state: AppState = createDefaultState();
  const storage = createStorageRepository();

  return {
    async initialize() {
      state = await storage.loadState();
    },
    getState: () => state,
    async selectPersona(personaId: PersonaId) {
      state = { ...state, activePersonaId: personaId };
    },
    async sendMessage(_text: string) {},
    stopStreaming() {},
    async updateProvider(config: ProviderConfig) {
      state = { ...state, settings: { ...state.settings, provider: config } };
    },
    async updateSettings(partial) {
      state = { ...state, settings: { ...state.settings, ...partial } };
    },
    async deleteMemory(_memoryId: string) {},
    async updateMemory(_memoryId: string, _patch: Partial<Memory>) {},
    async favoritePhoto(_photoId: string) {},
    async exportData() {
      return new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    },
    async importData(_file: File) {},
    async resetAllData() {
      state = createDefaultState();
    },
    getAlbum(personaId) {
      return state.album.filter((photo) => photo.personaId === personaId);
    }
  };
}
