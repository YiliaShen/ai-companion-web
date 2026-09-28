import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppController, AppState } from '../contracts';
import { createCompanionController } from './companionController';

interface CompanionContextValue {
  controller: AppController;
  state: AppState;
  loading: boolean;
  sending: boolean;
  error: string | null;
  refresh: () => void;
  dismissError: () => void;
  initialize: () => Promise<void>;
  perform: (action: () => Promise<unknown>, kind?: 'send' | 'action') => Promise<boolean>;
}

const CompanionContext = createContext<CompanionContextValue | null>(null);

export function CompanionProvider({ children, controller: suppliedController }: { children: ReactNode; controller?: AppController }) {
  const [controller] = useState(() => suppliedController ?? createCompanionController());
  const [state, setState] = useState<AppState>(() => controller.getState());
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);
  const sendLock = useRef(false);
  const initialization = useRef<Promise<void> | null>(null);

  const refresh = useCallback(() => {
    if (mounted.current) setState({ ...controller.getState() });
  }, [controller]);

  const initialize = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      initialization.current ??= controller.initialize();
      await initialization.current;
      refresh();
    } catch {
      initialization.current = null;
      if (mounted.current) setError('暂时没能打开你的空间。请重试；已有的记录不会因此被清空。');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [controller, refresh]);

  useEffect(() => {
    mounted.current = true;
    void initialize();
    return () => { mounted.current = false; };
  }, [initialize]);

  useEffect(() => {
    window.addEventListener('mira:statechange', refresh);
    return () => window.removeEventListener('mira:statechange', refresh);
  }, [refresh]);

  // Event updates are immediate; polling also supports the frozen stub controller.
  useEffect(() => {
    if (!sending) return;
    const timer = window.setInterval(refresh, 80);
    return () => window.clearInterval(timer);
  }, [sending, refresh]);

  const perform = useCallback(async (action: () => Promise<unknown>, kind: 'send' | 'action' = 'action') => {
    if (kind === 'send' && sendLock.current) return false;
    if (kind === 'send') { sendLock.current = true; setSending(true); }
    setError(null);
    try {
      const pending = action();
      refresh();
      await pending;
      return true;
    } catch (cause) {
      if (mounted.current) {
        // Never echo provider error bodies: they can contain credentials or prompts.
        setError(cause instanceof DOMException && cause.name === 'AbortError'
          ? '回复已停下。想继续时，随时开口。'
          : '这次没能完成。你的输入还在，可以重试，或在设置中切回体验模式。');
      }
      return false;
    } finally {
      refresh();
      if (kind === 'send') { sendLock.current = false; if (mounted.current) setSending(false); }
    }
  }, [refresh]);

  const value = useMemo(() => ({ controller, state, loading, sending, error, refresh, perform, initialize, dismissError: () => setError(null) }),
    [controller, state, loading, sending, error, refresh, perform, initialize]);
  return <CompanionContext.Provider value={value}>{children}</CompanionContext.Provider>;
}

// Context and its hook intentionally share the provider module.
// eslint-disable-next-line react-refresh/only-export-components
export function useCompanion(): CompanionContextValue {
  const context = useContext(CompanionContext);
  if (!context) throw new Error('useCompanion must be used inside CompanionProvider');
  return context;
}
