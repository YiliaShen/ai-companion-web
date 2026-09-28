import { z } from 'zod';
import type { AppState } from '../../contracts';

export const STATE_VERSION = 1;
const personaId = z.enum(['shenxu', 'jiangye', 'linche']);
const scene = z.enum(['late_night', 'work_stress', 'relationship', 'daily_share', 'celebration', 'conflict', 'loneliness', 'crisis']);
const timestamp = z.string().refine((value) => Number.isFinite(Date.parse(value)), 'Invalid date');
const id = z.string().min(1).max(200).refine((value) => !['__proto__', 'constructor', 'prototype'].includes(value));
const count = z.number().int().nonnegative();
const imageUrl = z.string().max(4096).refine((value) => {
  // Only bundled/local paths and secure remote images; never executable/data URLs.
  return !Array.from(value).some((character) => character.charCodeAt(0) <= 32 || character === '\\') && !value.startsWith('//') &&
    (!/^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith('https://'));
});

const stateSchema = z.object({
  activePersonaId: personaId,
  conversations: z.array(z.object({
    id, personaId, title: z.string(), createdAt: timestamp, updatedAt: timestamp,
    messageCount: count, lastMessagePreview: z.string(), unreadCount: count
  })),
  messages: z.record(id, z.array(z.object({
    id, conversationId: id, role: z.enum(['user', 'assistant', 'system']),
    kind: z.enum(['text', 'selfie', 'voice_note', 'system']), text: z.string(), createdAt: timestamp,
    status: z.enum(['sending', 'streaming', 'sent', 'failed']), imageUrl: imageUrl.optional(),
    imageCaption: z.string().optional(),
    emotion: z.enum(['calm', 'sad', 'anxious', 'angry', 'lonely', 'happy', 'tired', 'crisis']).optional(),
    memoryIds: z.array(id).optional()
  }))),
  memories: z.array(z.object({
    id, personaId, kind: z.enum(['preference', 'event', 'relationship', 'boundary', 'goal']),
    title: z.string(), content: z.string(), source: z.enum(['user', 'inferred', 'imported']),
    confidence: z.number().min(0).max(1), createdAt: timestamp, updatedAt: timestamp,
    lastRecalledAt: timestamp.optional(), tags: z.array(z.string())
  })),
  album: z.array(z.object({
    id, personaId, messageId: id, imageUrl, caption: z.string(), scene,
    createdAt: timestamp, favorite: z.boolean()
  })),
  settings: z.object({
    provider: z.object({
      mode: z.enum(['demo', 'openai-compatible']), baseUrl: z.string(),
      apiKey: z.string().default(''), model: z.string(), temperature: z.number().min(0).max(2),
      rememberKey: z.boolean().default(false)
    }),
    ambientAudio: z.boolean(), reducedMotion: z.boolean(), dependencyReminder: z.boolean(),
    theme: z.enum(['night', 'dawn'])
  }),
  onboardingComplete: z.boolean()
});

/** Validate untrusted data and remove unknown fields, orphan links and cross-persona references. */
export function validateAppState(value: unknown, recoverInterrupted = false): AppState {
  const state: AppState = stateSchema.parse(value);
  const unique = <T extends { id: string }>(items: T[]): T[] => {
    const seen = new Set<string>();
    return items.filter((item) => !seen.has(item.id) && !!seen.add(item.id));
  };
  state.conversations = unique(state.conversations);
  state.memories = unique(state.memories);
  const memories = new Map(state.memories.map((memory) => [memory.id, memory]));
  const messageOwners = new Map<string, string>();
  state.messages = Object.fromEntries(state.conversations.map((conversation) => {
    const messages = (state.messages[conversation.id] ?? []).filter((message) => {
      if (message.conversationId !== conversation.id || messageOwners.has(message.id)) return false;
      messageOwners.set(message.id, conversation.personaId);
      if (message.memoryIds) {
        message.memoryIds = message.memoryIds.filter((memoryId) => memories.get(memoryId)?.personaId === conversation.personaId);
      }
      if (recoverInterrupted && (message.status === 'streaming' || message.status === 'sending')) {
        message.status = 'failed';
      }
      return true;
    });
    conversation.messageCount = messages.length;
    conversation.unreadCount = Math.min(conversation.unreadCount, messages.length);
    conversation.lastMessagePreview = messages.at(-1)?.text.slice(0, 120) ?? '';
    return [conversation.id, messages];
  }));
  state.album = unique(state.album).filter((photo) => messageOwners.get(photo.messageId) === photo.personaId);
  return state;
}

export function withoutCredentials(state: AppState, forExport = false): AppState {
  const copy = validateAppState(state);
  copy.settings.provider.apiKey = '';
  if (forExport) copy.settings.provider.rememberKey = false;
  return copy;
}

export function readStateEnvelope(value: unknown): AppState {
  const envelope = z.object({ version: z.literal(STATE_VERSION), state: z.unknown() }).parse(value);
  return validateAppState(envelope.state, true);
}
