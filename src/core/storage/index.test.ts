import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppState } from '../../contracts';
import { createDefaultState } from '../../state/defaultState';
import {
  API_KEY_STORAGE_KEY, createStorageRepository, DATABASE_NAME, exportAppState,
  importAppState, type LocalStorageRepository, STATE_KEY, STATE_STORE
} from './index';

class MemoryStorage implements Storage {
  private items = new Map<string, string>();
  get length() { return this.items.size; }
  clear() { this.items.clear(); }
  getItem(key: string) { return this.items.get(key) ?? null; }
  key(index: number) { return [...this.items.keys()][index] ?? null; }
  removeItem(key: string) { this.items.delete(key); }
  setItem(key: string, value: string) { this.items.set(key, value); }
}
let indexedDB: IDBFactory;
let sessionStorage: MemoryStorage;
let localStorage: MemoryStorage;
let repositories: LocalStorageRepository[];
const createRepository = (extra: Parameters<typeof createStorageRepository>[0] = {}) => {
  const repository = createStorageRepository({ indexedDB, sessionStorage, localStorage, ...extra });
  repositories.push(repository);
  return repository;
};

async function rawState(value?: unknown): Promise<unknown> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STATE_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STATE_STORE, value === undefined ? 'readonly' : 'readwrite');
      const store = tx.objectStore(STATE_STORE);
      const request = value === undefined ? store.get(STATE_KEY) : store.put(value, STATE_KEY);
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}

function populatedState(): AppState {
  const state = createDefaultState();
  const date = '2026-09-28T12:00:00Z';
  state.onboardingComplete = true;
  state.conversations = [{ id: 'c1', personaId: 'shenxu', title: '对话', createdAt: date, updatedAt: date, messageCount: 1, lastMessagePreview: '你好', unreadCount: 0 }];
  state.messages = { c1: [{ id: 'm1', conversationId: 'c1', role: 'assistant', kind: 'selfie', text: '你好', status: 'sent', createdAt: date, imageUrl: './assets/scenes/cafe.jpg', memoryIds: ['memory1'] }] };
  state.memories = [{ id: 'memory1', personaId: 'shenxu', kind: 'preference', title: '咖啡', content: '喜欢咖啡', source: 'user', confidence: 1, createdAt: date, updatedAt: date, tags: ['咖啡'] }];
  state.album = [{ id: 'photo1', personaId: 'shenxu', messageId: 'm1', imageUrl: './assets/scenes/cafe.jpg', caption: '咖啡场景', scene: 'work_stress', createdAt: date, favorite: true }];
  return state;
}

beforeEach(() => {
  indexedDB = new IDBFactory();
  sessionStorage = new MemoryStorage();
  localStorage = new MemoryStorage();
  repositories = [];
});
afterEach(async () => {
  await Promise.all(repositories.map((repository) => repository.dispose().catch(() => undefined)));
  vi.useRealTimers();
});

describe('IndexedDB persistence', () => {
  it('returns independent complete defaults on first use', async () => {
    const repository = createRepository();
    const initial = await repository.loadState();
    expect(initial).toEqual(createDefaultState());
    initial.settings.theme = 'dawn';
    expect(await repository.loadState()).toEqual(createDefaultState());
  });

  it('durably restores conversations, memories, settings and album in a new repository', async () => {
    const first = createRepository();
    const state = populatedState();
    const saved = first.saveState(state);
    await first.flush();
    await saved;
    await first.dispose();
    expect(await createRepository().loadState()).toEqual(state);
    expect(await rawState()).toEqual({ version: 1, state });
  });

  it.each([null, 'invalid', { version: 1, state: { messages: null } }, { version: 1, state: { ...createDefaultState(), activePersonaId: 'unknown' } }])('repairs corrupt stored data and remains usable: %j', async (corrupt) => {
    await rawState(corrupt);
    const onError = vi.fn();
    const repository = createRepository({ onError });
    expect(await repository.loadState()).toEqual(createDefaultState());
    expect(await rawState()).toEqual({ version: 1, state: createDefaultState() });
    expect(onError).toHaveBeenCalledOnce();
  });

  it('preserves newer versions instead of silently overwriting them', async () => {
    const future = { version: 99, state: { opaque: true } };
    await rawState(future);
    const repository = createRepository();
    expect(await repository.loadState()).toEqual(createDefaultState());
    await expect(repository.saveState(createDefaultState())).rejects.toThrow('升级');
    expect(await rawState()).toEqual(future);
  });

  it('coalesces writes, snapshots mutable input and resolves saves only after commit', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const repository = createRepository({ debounceMs: 100 });
    const state = createDefaultState();
    const first = repository.saveState(state);
    state.settings.theme = 'dawn';
    const second = repository.saveState(state);
    state.settings.theme = 'night';
    let committed = false;
    void second.then(() => { committed = true; });
    await vi.advanceTimersByTimeAsync(99);
    expect(committed).toBe(false);
    expect(await rawState()).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    await Promise.all([first, second]);
    expect(committed).toBe(true);
    expect((await createRepository().loadState()).settings.theme).toBe('dawn');
  });

  it('does not postpone streaming writes indefinitely', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const repository = createRepository({ debounceMs: 100, maxWaitMs: 250 });
    const saves = [repository.saveState(createDefaultState())];
    await vi.advanceTimersByTimeAsync(90);
    saves.push(repository.saveState(createDefaultState()));
    await vi.advanceTimersByTimeAsync(90);
    saves.push(repository.saveState(createDefaultState()));
    await vi.advanceTimersByTimeAsync(70);
    await Promise.all(saves);
    expect(await rawState()).toBeDefined();
  });

  it('keeps keys in session storage unless opted in, never in IndexedDB, and removes old durable keys', async () => {
    const repository = createRepository();
    const state = createDefaultState();
    state.settings.provider.apiKey = 'private-session-key';
    let save = repository.saveState(state);
    await repository.flush(); await save;
    expect(sessionStorage.getItem(API_KEY_STORAGE_KEY)).toBe('private-session-key');
    expect(localStorage.getItem(API_KEY_STORAGE_KEY)).toBeNull();
    expect(JSON.stringify(await rawState())).not.toContain('private-session-key');
    expect((await createRepository().loadState()).settings.provider.apiKey).toBe('private-session-key');
    state.settings.provider.rememberKey = true;
    save = repository.saveState(state);
    await repository.flush(); await save;
    expect(localStorage.getItem(API_KEY_STORAGE_KEY)).toBe('private-session-key');
    expect(sessionStorage.getItem(API_KEY_STORAGE_KEY)).toBeNull();
    state.settings.provider.rememberKey = false;
    save = repository.saveState(state);
    await repository.flush(); await save;
    expect(localStorage.getItem(API_KEY_STORAGE_KEY)).toBeNull();
  });

  it('clear wins over queued saves, clears both credentials, and leaves unrelated storage alone', async () => {
    const repository = createRepository();
    const state = populatedState();
    state.settings.provider.apiKey = 'secret';
    state.settings.provider.rememberKey = true;
    localStorage.setItem('another-app', 'keep');
    const save = repository.saveState(state);
    await repository.clear();
    await save;
    expect(await repository.loadState()).toEqual(createDefaultState());
    expect(localStorage.getItem(API_KEY_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem('another-app')).toBe('keep');
    expect(await rawState()).toBeUndefined();
  });

  it('recovers interrupted replies and removes orphan or cross-persona links', async () => {
    const state = populatedState();
    state.messages.c1[0].status = 'streaming';
    state.memories[0].personaId = 'jiangye';
    state.album[0].personaId = 'jiangye';
    state.messages.orphan = [{ ...state.messages.c1[0], id: 'm2', conversationId: 'orphan' }];
    await rawState({ version: 1, state });
    const restored = await createRepository().loadState();
    expect(restored.messages.c1[0].status).toBe('failed');
    expect(restored.messages.c1[0].memoryIds).toEqual([]);
    expect(restored.messages.orphan).toBeUndefined();
    expect(restored.album).toEqual([]);
  });

  it('survives a storage open failure on startup but never pretends saves are durable', async () => {
    const brokenFactory = { open: () => { throw new Error('private implementation detail'); } } as unknown as IDBFactory;
    const repository = createRepository({ indexedDB: brokenFactory });
    expect(await repository.loadState()).toEqual(createDefaultState());
    const save = repository.saveState(createDefaultState());
    const rejected = expect(save).rejects.toThrow();
    await expect(repository.flush()).rejects.toThrow();
    await rejected;
  });
});

describe('versioned backup transfer', () => {
  it('round-trips all data while stripping keys and never mutating the live state', async () => {
    const state = populatedState();
    state.settings.provider.apiKey = 'never-export-this';
    state.settings.provider.rememberKey = true;
    const blob = exportAppState(state);
    const text = await blob.text();
    expect(JSON.parse(text)).toMatchObject({ format: 'mira-companion', version: 1, exportedAt: expect.any(String) });
    expect(text).not.toContain('never-export-this');
    const imported = await importAppState(blob);
    expect(imported).toEqual({ ...state, settings: { ...state.settings, provider: { ...state.settings.provider, apiKey: '', rememberKey: false } } });
    expect(state.settings.provider.apiKey).toBe('never-export-this');
  });

  it('does not import credentials or unknown extra secret fields', async () => {
    const state = populatedState();
    state.settings.provider.apiKey = 'hostile-key';
    const imported = await importAppState(JSON.stringify({ format: 'mira-companion', version: 1, state: { ...state, extraApiKey: 'hidden-key' } }));
    expect(JSON.stringify(imported)).not.toMatch(/hostile-key|hidden-key/);
  });

  it.each(['broken-json', '{}', '{"format":"mira-companion","version":99,"state":{}}'])('rejects unsupported or corrupt backups without exposing content: %s', async (text) => {
    await expect(importAppState(text)).rejects.toThrow('原有数据未更改');
  });
});
