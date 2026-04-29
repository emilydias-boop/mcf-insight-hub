import { useEffect, useRef } from 'react';
import { useTwilio } from '@/contexts/TwilioContext';

/**
 * Hook que observa o status da chamada.
 *
 * IMPORTANTE: A abertura automática do modal de qualificação foi REMOVIDA por
 * decisão de produto — o SDR deve abrir o modal manualmente quando precisar,
 * em qualquer chamada (manual ou via auto-dialer). Mantemos o hook apenas
 * para expor `isCallInProgress` aos componentes que ainda o consomem.
 */
export function useCallQualificationTrigger() {
  const { callStatus } = useTwilio();

  return { 
    isCallInProgress: callStatus === 'in-progress'
  };
}
