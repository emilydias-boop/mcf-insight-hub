import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const VDA_R1_REALIZADA = '0f450ec9-0f00-4fbe-8400-cdb2440897e5';
const EA_R1_REALIZADA = 'f7c48a43-4ca3-45a1-85d0-e6da76c3cff2';
const R1_REALIZADA_IDS = [VDA_R1_REALIZADA, EA_R1_REALIZADA];

const VDA_ORIGIN = '4e2b810a-6782-4ce9-9c0d-10d04c018636';
const EA_ORIGIN = '7d7b1cb5-2a44-4552-9eff-c3b798646b78';
const CONSORCIO_ORIGINS = [VDA_ORIGIN, EA_ORIGIN];

export interface PendingOutcomeDeal {
  deal_id: string;
  deal_name: string;
  contact_name: string;
  contact_phone: string;
  origin_id: string;
  origin_name: string;
  meeting_date: string | null;
  hours_pending: number;
}

/**
 * Reuniões R1 Realizada do closer logado SEM desfecho registrado
 * (sem proposta — incluindo "aguardar retorno" — e sem move para sem-sucesso).
 */
export function usePendingOutcomes() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['consorcio-pending-outcomes', user?.id],
    queryFn: async (): Promise<PendingOutcomeDeal[]> => {
      if (!user?.id) return [];

      // 1. Resolve closer email do usuário logado
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user.id)
        .maybeSingle();
      const userEmail = profile?.email?.toLowerCase();
      if (!userEmail) return [];

      // 2. Buscar deals em R1 Realizada do closer (owner_id = email)
      const { data: deals, error } = await supabase
        .from('crm_deals')
        .select(`
          id,
          name,
          origin_id,
          updated_at,
          owner_id,
          crm_contacts (name, phone),
          crm_origins (name)
        `)
        .in('stage_id', R1_REALIZADA_IDS)
        .in('origin_id', CONSORCIO_ORIGINS)
        .ilike('owner_id', userEmail);

      if (error) throw error;
      if (!deals || deals.length === 0) return [];

      const dealIds = deals.map(d => d.id);

      // 3. Excluir deals que JÁ têm proposta (qualquer status, inclusive aguardando_retorno)
      const { data: proposals } = await supabase
        .from('consorcio_proposals')
        .select('deal_id')
        .in('deal_id', dealIds);
      const withProposal = new Set((proposals || []).map(p => p.deal_id).filter(Boolean));

      // 4. Buscar meeting dates
      const { data: attendees } = await supabase
        .from('meeting_slot_attendees')
        .select('deal_id, meeting_slots (scheduled_at)')
        .in('deal_id', dealIds);
      const meetingByDeal: Record<string, string> = {};
      (attendees || []).forEach(a => {
        if (a.deal_id) {
          const sched = (a.meeting_slots as any)?.scheduled_at;
          if (sched) meetingByDeal[a.deal_id] = sched;
        }
      });

      const now = Date.now();
      return deals
        .filter(d => !withProposal.has(d.id))
        .map(d => {
          const refDate = meetingByDeal[d.id] || d.updated_at;
          const hours = refDate
            ? Math.floor((now - new Date(refDate).getTime()) / (1000 * 60 * 60))
            : 0;
          return {
            deal_id: d.id,
            deal_name: d.name || '',
            contact_name: (d.crm_contacts as any)?.name || '',
            contact_phone: (d.crm_contacts as any)?.phone || '',
            origin_id: d.origin_id || '',
            origin_name: (d.crm_origins as any)?.name || '',
            meeting_date: meetingByDeal[d.id] || null,
            hours_pending: hours,
          };
        })
        .sort((a, b) => b.hours_pending - a.hours_pending);
    },
    enabled: !!user?.id,
  });
}
