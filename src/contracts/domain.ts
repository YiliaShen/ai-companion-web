export type PersonaId = 'shenxu' | 'jiangye' | 'linche';

export type Emotion =
  | 'calm'
  | 'sad'
  | 'anxious'
  | 'angry'
  | 'lonely'
  | 'happy'
  | 'tired'
  | 'crisis';

export type Scene =
  | 'late_night'
  | 'work_stress'
  | 'relationship'
  | 'daily_share'
  | 'celebration'
  | 'conflict'
  | 'loneliness'
  | 'crisis';

export type ReplyStrategy =
  | 'listen'
  | 'comfort'
  | 'validate'
  | 'gently_reframe'
  | 'celebrate'
  | 'set_boundary'
  | 'safety_redirect';

export type MessageKind = 'text' | 'selfie' | 'voice_note' | 'system';
export type MessageRole = 'user' | 'assistant' | 'system';
export type MessageStatus = 'sending' | 'streaming' | 'sent' | 'failed';

export type MemoryKind = 'preference' | 'event' | 'relationship' | 'boundary' | 'goal';
export type MemorySource = 'user' | 'inferred' | 'imported';

export interface Persona {
  id: PersonaId;
  name: string;
  ageLabel: string;
  tagline: string;
  archetype: string;
  accent: string;
  avatarUrl: string;
  heroUrl: string;
  greeting: string;
  voiceRules: string[];
  boundaries: string[];
  sceneOpeners: Record<Scene, string[]>;
}

export interface EmotionReading {
  scene: Scene;
  emotion: Emotion;
  intensity: number;
  strategy: ReplyStrategy;
  shouldGenerateImage: boolean;
  imagePrompt?: string;
  shouldOfferMusic: boolean;
  safety: SafetyDecision;
  rationale: string;
}

export interface SafetyDecision {
  level: 'none' | 'watch' | 'urgent';
  reason: string;
  userMessage?: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  kind: MessageKind;
  text: string;
  createdAt: string;
  status: MessageStatus;
  imageUrl?: string;
  imageCaption?: string;
  emotion?: Emotion;
  memoryIds?: string[];
}

export interface Conversation {
  id: string;
  personaId: PersonaId;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessagePreview: string;
  unreadCount: number;
}

export interface Memory {
  id: string;
  personaId: PersonaId;
  kind: MemoryKind;
  title: string;
  content: string;
  source: MemorySource;
  confidence: number;
  createdAt: string;
  updatedAt: string;
  lastRecalledAt?: string;
  tags: string[];
}

export interface AlbumPhoto {
  id: string;
  personaId: PersonaId;
  messageId: string;
  imageUrl: string;
  caption: string;
  scene: Scene;
  createdAt: string;
  favorite: boolean;
}

export type ProviderMode = 'demo' | 'openai-compatible';

export interface ProviderConfig {
  mode: ProviderMode;
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  rememberKey: boolean;
}

export interface AppSettings {
  provider: ProviderConfig;
  ambientAudio: boolean;
  reducedMotion: boolean;
  dependencyReminder: boolean;
  theme: 'night' | 'dawn';
}

export interface AppState {
  activePersonaId: PersonaId;
  conversations: Conversation[];
  messages: Record<string, ChatMessage[]>;
  memories: Memory[];
  album: AlbumPhoto[];
  settings: AppSettings;
  onboardingComplete: boolean;
}

export interface CandidateMemory {
  kind: MemoryKind;
  title: string;
  content: string;
  confidence: number;
  tags: string[];
}

export interface ProviderChatInput {
  persona: Persona;
  history: ChatMessage[];
  memories: Memory[];
  reading: EmotionReading;
  userMessage: string;
}

export interface ChatChunk {
  type: 'text-delta' | 'done' | 'error';
  delta?: string;
  error?: string;
}

export interface ChatProvider {
  readonly id: ProviderMode;
  stream(input: ProviderChatInput, signal: AbortSignal): AsyncIterable<ChatChunk>;
}

export interface StorageRepository {
  loadState(): Promise<AppState>;
  saveState(state: AppState): Promise<void>;
  clear(): Promise<void>;
}
