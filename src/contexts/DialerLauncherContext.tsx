import { createContext, useContext, useState, ReactNode } from 'react';

interface DialerLauncherContextValue {
  quickOpen: boolean;
  setQuickOpen: (open: boolean) => void;
  autoOpen: boolean;
  setAutoOpen: (open: boolean) => void;
}

const DialerLauncherContext = createContext<DialerLauncherContextValue | null>(null);

export function DialerLauncherProvider({ children }: { children: ReactNode }) {
  const [quickOpen, setQuickOpen] = useState(false);
  const [autoOpen, setAutoOpen] = useState(false);

  return (
    <DialerLauncherContext.Provider value={{ quickOpen, setQuickOpen, autoOpen, setAutoOpen }}>
      {children}
    </DialerLauncherContext.Provider>
  );
}

export function useDialerLauncher() {
  const ctx = useContext(DialerLauncherContext);
  if (!ctx) throw new Error('useDialerLauncher must be used within DialerLauncherProvider');
  return ctx;
}