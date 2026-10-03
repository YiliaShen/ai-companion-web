import { describe, expect, it } from 'vitest';
import type { AppState } from '../contracts';
import { createDefaultState } from './defaultState';
import { selectMemoryEvidence, selectPersonaSession } from './personaSession';

const stamp = '2026-10-03T06:00:00.000Z';

describe('persona session selector', () => {
  it('keeps messages, memories, evidence and photos inside one persona conversation', () => {
    const state: AppState = {
      ...createDefaultState(),
      onboardingComplete: true,
      conversations: [
        { id: 'shenxu-chat', personaId: 'shenxu', title: '沈叙', createdAt: stamp, updatedAt: stamp, messageCount: 2, lastMessagePreview: '', unreadCount: 0 },
        { id: 'jiangye-chat', personaId: 'jiangye', title: '江野', createdAt: stamp, updatedAt: stamp, messageCount: 1, lastMessagePreview: '', unreadCount: 0 },
      ],
      messages: {
        'shenxu-chat': [
          { id: 'shenxu-message', conversationId: 'shenxu-chat', role: 'assistant', kind: 'selfie', text: '沈叙消息', createdAt: stamp, status: 'sent', imageUrl: 'assets/scenes/late_night.jpg', memoryIds: ['shenxu-memory'] },
          { id: 'misfiled-message', conversationId: 'jiangye-chat', role: 'assistant', kind: 'selfie', text: '错误消息', createdAt: stamp, status: 'sent', imageUrl: 'assets/scenes/seaside.jpg', memoryIds: ['shenxu-memory'] },
        ],
        'jiangye-chat': [
          { id: 'jiangye-message', conversationId: 'jiangye-chat', role: 'user', kind: 'text', text: '江野消息', createdAt: stamp, status: 'sent', memoryIds: ['jiangye-memory'] },
        ],
      },
      memories: [
        { id: 'shenxu-memory', personaId: 'shenxu', kind: 'preference', title: '沈叙记忆', content: '沈叙', source: 'user', confidence: 1, createdAt: stamp, updatedAt: stamp, tags: [] },
        { id: 'jiangye-memory', personaId: 'jiangye', kind: 'preference', title: '江野记忆', content: '江野', source: 'user', confidence: 1, createdAt: stamp, updatedAt: stamp, tags: [] },
      ],
      album: [
        { id: 'valid-photo', personaId: 'shenxu', messageId: 'shenxu-message', imageUrl: 'assets/scenes/late_night.jpg', caption: '沈叙照片', scene: 'late_night', createdAt: stamp, favorite: false },
        { id: 'misfiled-photo', personaId: 'shenxu', messageId: 'misfiled-message', imageUrl: 'assets/scenes/seaside.jpg', caption: '错误照片', scene: 'daily_share', createdAt: stamp, favorite: false },
        { id: 'jiangye-photo', personaId: 'jiangye', messageId: 'jiangye-message', imageUrl: 'assets/scenes/city_walk.jpg', caption: '江野照片', scene: 'daily_share', createdAt: stamp, favorite: false },
      ],
    };

    const session = selectPersonaSession(state, 'shenxu');

    expect(session.messages.map((message) => message.id)).toEqual(['shenxu-message']);
    expect(session.memories.map((memory) => memory.id)).toEqual(['shenxu-memory']);
    expect(session.photos.map((photo) => photo.id)).toEqual(['valid-photo']);
    expect(selectMemoryEvidence(session, 'shenxu-memory').map((message) => message.id)).toEqual(['shenxu-message']);
  });
});
