import { useEffect } from 'react';
import { useAutoDialer } from '@/contexts/AutoDialerContext';
import { DealDetailsDrawer } from '@/components/crm/DealDetailsDrawer';

/**
 * Abre automaticamente o DealDetailsDrawer com todos os dados do lead
 * quando uma chamada do auto-discador é atendida (state === 'paused-in-call').
 * O AutoDialerInCallBanner permanece sobreposto (z-[120]) com os controles da chamada.
 *
 * Importante: leads avulsos (telefones colados) usam dealId fictício no formato
 * "manual-<timestamp>-<i>" e NÃO devem abrir o drawer (não há registro no CRM).
 */
export function AutoDialerDealDrawer() {
  const { state, currentLead, inCallDrawerOpen, setInCallDrawerOpen } = useAutoDialer();

  const dealId = currentLead?.dealId ?? null;
  const isRealDeal = !!dealId && !dealId.startsWith('manual-');
  // 'paused-in-call' = motor twilio (atendeu). 'awaiting-outcome' = motor
  // sonax (disparo aceito no webfone, sem evento de atendimento no navegador).
  const open = (state === 'paused-in-call' || state === 'awaiting-outcome') && inCallDrawerOpen && isRealDeal;

  useEffect(() => {
    console.debug('[AutoDialerDrawer]', {
      state,
      dealId,
      isRealDeal,
      inCallDrawerOpen,
      open,
    });
  }, [state, dealId, isRealDeal, inCallDrawerOpen, open]);

  return (
    <DealDetailsDrawer
      dealId={isRealDeal ? dealId : null}
      open={open}
      onOpenChange={setInCallDrawerOpen}
    />
  );
}