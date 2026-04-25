import { useAutoDialer } from '@/contexts/AutoDialerContext';
import { DealDetailsDrawer } from '@/components/crm/DealDetailsDrawer';

/**
 * Abre automaticamente o DealDetailsDrawer com todos os dados do lead
 * quando uma chamada do auto-discador é atendida (state === 'paused-in-call').
 * O AutoDialerInCallBanner permanece sobreposto (z-[120]) com os controles da chamada.
 */
export function AutoDialerDealDrawer() {
  const { state, currentLead, inCallDrawerOpen, setInCallDrawerOpen } = useAutoDialer();

  const dealId = currentLead?.dealId ?? null;
  const open = state === 'paused-in-call' && inCallDrawerOpen && !!dealId;

  return (
    <DealDetailsDrawer
      dealId={dealId}
      open={open}
      onOpenChange={setInCallDrawerOpen}
    />
  );
}