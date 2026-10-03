import type { AlbumPhoto, AppState, ChatMessage, Conversation, Memory, PersonaId } from '../contracts';

export interface PersonaSession {
  personaId: PersonaId;
  conversation?: Conversation;
  messages: ChatMessage[];
  memories: Memory[];
  photos: AlbumPhoto[];
}

/**
 * Creates the only state slice the UI may render for one persona.
 * The extra relationship checks keep legacy or partially written records from
 * leaking into another persona's page.
 */
export function selectPersonaSession(state: AppState, personaId: PersonaId): PersonaSession {
  const conversation = state.conversations
    .filter((item) => item.personaId === personaId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const messages = conversation
    ? (state.messages[conversation.id] ?? []).filter((message) => message.conversationId === conversation.id)
    : [];
  const photoMessages = new Map(messages
    .filter((message) => message.role === 'assistant' && message.kind === 'selfie' && message.imageUrl)
    .map((message) => [message.id, message.imageUrl]));

  return {
    personaId,
    conversation,
    messages,
    memories: state.memories.filter((memory) => memory.personaId === personaId),
    photos: state.album.filter((photo) => photo.personaId === personaId && photoMessages.get(photo.messageId) === photo.imageUrl),
  };
}

export function selectMemoryEvidence(session: PersonaSession, memoryId: string): ChatMessage[] {
  return session.messages.filter((message) => message.memoryIds?.includes(memoryId));
}
