import type { AppState, StorageRepository } from '../../contracts';
import { createDefaultState } from '../../state/defaultState';
import { readStateEnvelope, STATE_VERSION, withoutCredentials } from './schema';

export { exportAppState, importAppState, MAX_IMPORT_BYTES } from './transfer';
export { STATE_VERSION } from './schema';
export const DATABASE_NAME = 'mira-companion';
export const STATE_STORE = 'state';
export const STATE_KEY = 'app-state-v1';
export const API_KEY_STORAGE_KEY = 'mira-companion:api-key';

export interface StorageOptions {
  indexedDB?: IDBFactory;
  sessionStorage?: Storage;
  localStorage?: Storage;
  debounceMs?: number;
  maxWaitMs?: number;
  onError?: (error: Error) => void;
}

export interface LocalStorageRepository extends StorageRepository {
  /** Commit queued streaming updates now; saveState resolves only once its batch commits. */
  flush(): Promise<void>;
  dispose(): Promise<void>;
}

function browserStorage(kind: 'sessionStorage' | 'localStorage'): Storage | undefined {
  try { return globalThis[kind]; } catch { return undefined; }
}

export function createStorageRepository(options: StorageOptions = {}): LocalStorageRepository {
  const factory = options.indexedDB ?? globalThis.indexedDB;
  const session = options.sessionStorage ?? browserStorage('sessionStorage');
  const local = options.localStorage ?? browserStorage('localStorage');
  const debounceMs = Math.max(0, options.debounceMs ?? 180);
  const maxWaitMs = Math.max(debounceMs, options.maxWaitMs ?? 1000);
  let database: Promise<IDBDatabase> | undefined;
  let disposed = false;
  let closing = false;
  let incompatible = false;
  let tail: Promise<unknown> = Promise.resolve();
  let pending: AppState | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let waiters: Array<{ resolve: () => void; reject: (error: unknown) => void }> = [];
  const report = (error: Error) => { try { options.onError?.(error); } catch { /* Observer only. */ } };

  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = tail.then(operation);
    tail = result.catch(() => undefined);
    return result;
  }

  function open(): Promise<IDBDatabase> {
    if (disposed) return Promise.reject(new Error('本地存储已关闭。'));
    if (!factory) return Promise.reject(new Error('浏览器不支持 IndexedDB，数据暂时无法持久保存。'));
    if (!database) {
      database = new Promise<IDBDatabase>((resolve, reject) => {
        const request = factory.open(DATABASE_NAME, 1);
        let settled = false;
        const fail = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          reject(new Error('无法打开本地数据，请检查浏览器存储权限或关闭其他 Mira 页面后重试。'));
        };
        const timeout = setTimeout(fail, 5000);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(STATE_STORE)) request.result.createObjectStore(STATE_STORE);
        };
        request.onerror = fail;
        request.onblocked = fail;
        request.onsuccess = () => {
          const db = request.result;
          if (settled || disposed) { db.close(); return; }
          settled = true;
          clearTimeout(timeout);
          db.onversionchange = () => { db.close(); database = undefined; };
          db.onclose = () => { database = undefined; };
          resolve(db);
        };
      }).catch((error: unknown) => { database = undefined; throw error; });
    }
    return database;
  }

  async function transaction<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STATE_STORE, mode);
      const request = operation(tx.objectStore(STATE_STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = tx.onerror = () => reject(new Error('本地保存失败，请检查浏览器存储空间与权限。'));
    });
  }

  function saveCredentials(state: AppState): void {
    const { apiKey, rememberKey } = state.settings.provider;
    // Remove the previous durable copy before honoring a changed preference.
    if (!rememberKey || !apiKey) local?.removeItem(API_KEY_STORAGE_KEY);
    if (rememberKey) {
      session?.removeItem(API_KEY_STORAGE_KEY);
      if (apiKey) {
        if (!local) throw new Error('无法记住 API Key，请检查浏览器存储权限。');
        local.setItem(API_KEY_STORAGE_KEY, apiKey);
      }
    } else if (apiKey) {
      if (!session) throw new Error('无法在当前会话保存 API Key，请检查浏览器存储权限。');
      session.setItem(API_KEY_STORAGE_KEY, apiKey);
    } else session?.removeItem(API_KEY_STORAGE_KEY);
  }

  async function flush(): Promise<void> {
    clearTimeout(timer);
    clearTimeout(deadline);
    timer = deadline = undefined;
    if (!pending) { await tail; return; }
    const snapshot = pending;
    const batch = waiters;
    pending = undefined;
    waiters = [];
    try {
      await enqueue(async () => {
        await transaction('readwrite', (store) => store.put({ version: STATE_VERSION, state: snapshot }, STATE_KEY));
      });
      batch.forEach(({ resolve }) => resolve());
    } catch (error) {
      batch.forEach(({ reject }) => reject(error));
      throw error;
    }
  }
  const backgroundFlush = () => { void flush().catch(() => report(new Error('本地保存失败，最近的修改尚未保存。'))); };
  const onVisibility = () => { if (document.visibilityState === 'hidden') backgroundFlush(); };
  globalThis.addEventListener?.('pagehide', backgroundFlush);
  globalThis.document?.addEventListener('visibilitychange', onVisibility);

  return {
    async loadState() {
      await flush();
      return enqueue(async () => {
        try {
          const raw: unknown = await transaction('readonly', (store) => store.get(STATE_KEY));
          let state: AppState;
          if (raw === undefined) state = createDefaultState();
          else {
            try { state = readStateEnvelope(raw); }
            catch {
              incompatible = !!raw && typeof raw === 'object' && 'version' in raw && typeof raw.version === 'number' && raw.version > STATE_VERSION;
              if (incompatible) {
                report(new Error('本地数据来自更新版本，已保留原数据；请升级 Mira 后读取。'));
                return createDefaultState();
              }
              state = createDefaultState();
              // Replace only the corrupt app record, never unrelated browser data.
              await transaction('readwrite', (store) => store.put({ version: STATE_VERSION, state }, STATE_KEY));
              report(new Error('本地数据损坏，已恢复默认状态。'));
            }
          }
          // Even legacy records may not restore credentials from the state payload.
          state.settings.provider.apiKey = '';
          try {
            state.settings.provider.apiKey = (state.settings.provider.rememberKey ? local : session)?.getItem(API_KEY_STORAGE_KEY) ?? '';
          } catch { report(new Error('无法读取 API Key，请重新输入。')); }
          return state;
        } catch {
          report(new Error('本地数据暂时不可用，已启用空白状态；请检查浏览器存储权限。'));
          return createDefaultState();
        }
      });
    },
    async saveState(state) {
      if (disposed || closing) throw new Error('本地存储已关闭。');
      if (incompatible) throw new Error('请升级 Mira 后再保存，避免覆盖更新版本的数据。');
      const snapshot = withoutCredentials(state);
      saveCredentials(state);
      pending = snapshot;
      const result = new Promise<void>((resolve, reject) => waiters.push({ resolve, reject }));
      clearTimeout(timer);
      timer = setTimeout(backgroundFlush, debounceMs);
      deadline ??= setTimeout(backgroundFlush, maxWaitMs);
      return result;
    },
    async clear() {
      if (disposed || closing) throw new Error('本地存储已关闭。');
      clearTimeout(timer);
      clearTimeout(deadline);
      timer = deadline = undefined;
      pending = undefined;
      const cancelled = waiters;
      waiters = [];
      try {
        local?.removeItem(API_KEY_STORAGE_KEY);
        session?.removeItem(API_KEY_STORAGE_KEY);
        await enqueue(async () => { await transaction('readwrite', (store) => store.clear()); });
        incompatible = false;
        cancelled.forEach(({ resolve }) => resolve());
      } catch (error) {
        cancelled.forEach(({ reject }) => reject(error));
        throw error;
      }
    },
    flush,
    async dispose() {
      if (disposed || closing) return;
      closing = true;
      globalThis.removeEventListener?.('pagehide', backgroundFlush);
      globalThis.document?.removeEventListener('visibilitychange', onVisibility);
      try { await flush(); }
      finally {
        if (database) { try { (await database).close(); } catch { /* Opening already reported. */ } }
        disposed = true;
      }
    }
  };
}
