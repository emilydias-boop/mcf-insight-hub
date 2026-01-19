import { useEffect, useRef } from 'react';
import { useTwilio } from '@/contexts/TwilioContext';

/**
 * Hook que detecta quando o lead atende a ligação (callStatus muda para 'in-progress')
 * e abre automaticamente o modal global de qualificação
 */
export function useCallQualificationTrigger() {
  const { 
    callStatus, 
    currentCallDealId, 
    openQualificationModal 
  } = useTwilio();
  
  const prevStatusRef = useRef(callStatus);

  useEffect(() => {
    // Detectar transição para 'in-progress' (lead atendeu)
    if (
      prevStatusRef.current !== 'in-progress' && 
      callStatus === 'in-progress' && 
      currentCallDealId
    ) {
      // Abre o modal global via contexto
      openQualificationModal(currentCallDealId);
    }
    
    prevStatusRef.current = callStatus;
  }, [callStatus, currentCallDealId, openQualificationModal]);

  return { 
    isCallInProgress: callStatus === 'in-progress'
  };
}
