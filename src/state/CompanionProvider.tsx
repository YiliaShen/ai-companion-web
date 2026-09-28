import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AppController, AppState } from '../contracts';
import { createCompanionController } from './companionController';

interface CompanionContextValue {
  controller: AppController;
  state: AppState;
  refresh: () => void;
}

const CompanionContext = createContext<CompanionContextValue | null>(null);

export function CompanionProvider({ children }: { children: ReactNode }) {
  const controller = useMemo(() => createCompanionController(), []);
  const [state, setState] = useState<AppState>(() => controller.getState());

  useEffect(() => {
    void controller.initialize().then(() => setState(controller.getState()));
  }, [controller]);

  const value = useMemo(
    () => ({ controller, state, refresh: () => setState(controller.getState()) }),
    [controller, state]
  );

  return <CompanionContext.Provider value={value}>{children}</CompanionContext.Provider>;
}

export function useCompanion(): CompanionContextValue {
  const context = useContext(CompanionContext);
  if (!context) throw new Error('useCompanion must be used inside CompanionProvider');
  return context;
}
