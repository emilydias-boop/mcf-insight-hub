import { useContext, useMemo } from 'react';
import { BUContext } from '@/contexts/BUContext';
import { useMyBU, BusinessUnit } from '@/hooks/useMyBU';

/**
 * Hook that returns the active Business Unit.
 * 
 * Priority:
 * 1. If we're in a BU-specific route (e.g., /consorcio/crm), use that BU from context
 * 2. Otherwise, use the user's own BU from their profile
 * 
 * @returns The active BU or null if none is set
 */
export function useActiveBU(): BusinessUnit | null {
  const buContext = useContext(BUContext);
  const { data: userBU } = useMyBU();

  return useMemo(() => {
    // If we have a context BU (from route), use it
    if (buContext.activeBU) {
      return buContext.activeBU;
    }
    
    // Otherwise use the user's BU
    return userBU || null;
  }, [buContext.activeBU, userBU]);
}

/**
 * Hook that returns whether the current view is a global CRM view
 * (no specific BU filter) or a BU-specific view.
 */
export function useIsGlobalCRM(): boolean {
  const buContext = useContext(BUContext);
  return buContext.isGlobalCRM;
}

/**
 * Hook that returns the base path for CRM navigation.
 * This is useful for building links within the CRM.
 */
export function useCRMBasePath(): string {
  const buContext = useContext(BUContext);
  return buContext.basePath;
}
