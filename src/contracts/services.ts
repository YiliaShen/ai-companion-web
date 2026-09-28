import type {
  AlbumPhoto,
  AppState,
  CandidateMemory,
  ChatMessage,
  EmotionReading,
  Memory,
  Persona,
  ProviderConfig,
  SafetyDecision
} from './domain';

export interface EmotionEngine {
  analyze(input: string, persona: Persona, memories: Memory[]): EmotionReading;
}

export interface SafetyEngine {
  assess(input: string, history: ChatMessage[]): SafetyDecision;
  buildSafetyReply(decision: SafetyDecision, persona: Persona): string;
  shouldShowDependencyReminder(sessionStartedAt: string, now?: Date): boolean;
}

export interface MemoryEngine {
  extract(input: string, personaId: Persona['id']): CandidateMemory[];
  rankRelevant(memories: Memory[], input: string, limit?: number): Memory[];
}

export interface ScenarioImageService {
  trigger(
    reading: EmotionReading,
    persona: Persona,
    latestUserMessage: string
  ): Promise<{ imageUrl: string; caption: string }>;
}

export interface AppController {
  initialize(): Promise<void>;
  getState(): AppState;
  selectPersona(personaId: Persona['id']): Promise<void>;
  sendMessage(text: string): Promise<void>;
  stopStreaming(): void;
  updateProvider(config: ProviderConfig): Promise<void>;
  updateSettings(partial: Partial<AppState['settings']>): Promise<void>;
  deleteMemory(memoryId: string): Promise<void>;
  updateMemory(memoryId: string, patch: Partial<Memory>): Promise<void>;
  favoritePhoto(photoId: string): Promise<void>;
  exportData(): Promise<Blob>;
  importData(file: File): Promise<void>;
  resetAllData(): Promise<void>;
  getAlbum(personaId: Persona['id']): AlbumPhoto[];
}
