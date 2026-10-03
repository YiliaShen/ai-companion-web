// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppController, AppState, PersonaId } from './contracts';
import { CompanionProvider } from './state/CompanionProvider';
import { createDefaultState } from './state/defaultState';
import { App } from './App';

afterEach(cleanup);

const stamp = '2026-10-03T06:00:00.000Z';

function controllerWithPersonaData(): AppController {
  const defaults = createDefaultState();
  let state: AppState = {
    ...defaults,
    activePersonaId: 'shenxu',
    onboardingComplete: true,
    conversations: [
      { id: 'conversation-shenxu', personaId: 'shenxu', title: '与沈叙的对话', createdAt: stamp, updatedAt: stamp, messageCount: 1, lastMessagePreview: '沈叙私聊', unreadCount: 0 },
      { id: 'conversation-jiangye', personaId: 'jiangye', title: '与江野的对话', createdAt: stamp, updatedAt: stamp, messageCount: 1, lastMessagePreview: '江野私聊', unreadCount: 0 },
      { id: 'conversation-linche', personaId: 'linche', title: '与林澈的对话', createdAt: stamp, updatedAt: stamp, messageCount: 1, lastMessagePreview: '林澈私聊', unreadCount: 0 },
    ],
    messages: {
      'conversation-shenxu': [
        { id: 'message-shenxu', conversationId: 'conversation-shenxu', role: 'assistant', kind: 'text', text: '只属于沈叙的对话', createdAt: stamp, status: 'sent' },
        // Simulate a legacy/corrupt record placed in the wrong message bucket.
        { id: 'leaked-message-jiangye', conversationId: 'conversation-jiangye', role: 'assistant', kind: 'text', text: '不该出现在沈叙页面的江野对话', createdAt: stamp, status: 'sent' },
      ],
      'conversation-jiangye': [
        { id: 'message-jiangye', conversationId: 'conversation-jiangye', role: 'assistant', kind: 'text', text: '只属于江野的对话', createdAt: stamp, status: 'sent' },
      ],
      'conversation-linche': [
        { id: 'message-linche', conversationId: 'conversation-linche', role: 'assistant', kind: 'text', text: '只属于林澈的对话', createdAt: stamp, status: 'sent' },
      ],
    },
    memories: [
      { id: 'memory-shenxu', personaId: 'shenxu', kind: 'preference', title: '沈叙记忆', content: '只给沈叙记住', source: 'user', confidence: 1, createdAt: stamp, updatedAt: stamp, tags: [] },
      { id: 'memory-jiangye', personaId: 'jiangye', kind: 'preference', title: '江野记忆', content: '只给江野记住', source: 'user', confidence: 1, createdAt: stamp, updatedAt: stamp, tags: [] },
    ],
    album: [],
  };

  const notify = () => window.dispatchEvent(new Event('mira:statechange'));
  return {
    initialize: async () => undefined,
    getState: () => state,
    selectPersona: async (personaId: PersonaId) => {
      state = { ...state, activePersonaId: personaId };
      notify();
    },
    sendMessage: async () => undefined,
    stopStreaming: vi.fn(),
    updateProvider: async () => undefined,
    updateSettings: async () => undefined,
    deleteMemory: async () => undefined,
    updateMemory: async () => undefined,
    favoritePhoto: async () => undefined,
    exportData: async () => new Blob(),
    importData: async () => undefined,
    resetAllData: async () => undefined,
    getAlbum: (personaId) => state.album.filter((photo) => photo.personaId === personaId),
  };
}

describe('persona session isolation', () => {
  it('renders only the active persona conversation and memory after every switch', async () => {
    render(<CompanionProvider controller={controllerWithPersonaData()}><App /></CompanionProvider>);

    expect(await screen.findByText('只属于沈叙的对话')).toBeVisible();
    expect(document.querySelectorAll('.message-region')).toHaveLength(1);
    expect(screen.queryByText('不该出现在沈叙页面的江野对话')).not.toBeInTheDocument();
    expect(screen.queryByText('只属于江野的对话')).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: '记忆' })[0]);
    expect(screen.getAllByText('沈叙记忆').length).toBeGreaterThan(0);
    expect(screen.queryByText('江野记忆')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '与江野对话' }));
    await waitFor(() => expect(screen.getByText('只属于江野的对话')).toBeVisible());
    expect(document.querySelectorAll('.message-region')).toHaveLength(1);
    expect(screen.queryByText('只属于沈叙的对话')).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: '记忆' })[0]);
    expect(screen.getAllByText('江野记忆').length).toBeGreaterThan(0);
    expect(screen.queryByText('沈叙记忆')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '与林澈对话' }));
    await waitFor(() => expect(screen.getByText('只属于林澈的对话')).toBeVisible());
    expect(document.querySelectorAll('.message-region')).toHaveLength(1);
    expect(screen.queryByText('只属于沈叙的对话')).not.toBeInTheDocument();
    expect(screen.queryByText('只属于江野的对话')).not.toBeInTheDocument();
  });
});
