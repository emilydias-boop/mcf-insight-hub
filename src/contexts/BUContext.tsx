import { createContext, useContext, ReactNode, useMemo } from 'react';
import { BusinessUnit } from '@/hooks/useMyBU';

interface BUContextValue {
  activeBU: BusinessUnit | null;
  isGlobalCRM: boolean;
  basePath: string;
}

const BUContext = createContext<BUContextValue>({
  activeBU: null,
  isGlobalCRM: true,
  basePath: '/crm',
});

interface BUProviderProps {
  children: ReactNode;
  bu: BusinessUnit | null;
  basePath: string;
}

export function BUProvider({ children, bu, basePath }: BUProviderProps) {
  const value = useMemo(() => ({
    activeBU: bu,
    isGlobalCRM: bu === null || bu === 'incorporador',
    basePath,
  }), [bu, basePath]);

  return (
    <BUContext.Provider value={value}>
      {children}
    </BUContext.Provider>
  );
}

export function useBUContext() {
  return useContext(BUContext);
}

export { BUContext };
