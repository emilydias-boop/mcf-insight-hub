import { useState, useEffect, useRef } from 'react';
import { useTwilio } from '@/contexts/TwilioContext';

/**
 * Hook que detecta quando o lead atende a ligação (callStatus muda para 'in-progress')
 * e dispara a abertura do drawer de qualificação
 */
export function useCallQualificationTrigger() {
  const { callStatus, currentCallDealId } = useTwilio();
  const [dealIdForQualification, setDealIdForQualification] = useState<string | null>(null);
  const prevStatusRef = useRef(callStatus);

  useEffect(() => {
    // Detectar transição para 'in-progress' (lead atendeu)
    if (
      prevStatusRef.current !== 'in-progress' && 
      callStatus === 'in-progress' && 
      currentCallDealId
    ) {
      setDealIdForQualification(currentCallDealId);
    }
    
    prevStatusRef.current = callStatus;
  }, [callStatus, currentCallDealId]);

  const clearTrigger = () => setDealIdForQualification(null);

  return { 
    dealIdForQualification, 
    clearTrigger,
    isCallInProgress: callStatus === 'in-progress'
  };
}
