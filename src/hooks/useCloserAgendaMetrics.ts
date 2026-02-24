import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth } from "date-fns";

/**
 * Métricas de Closer baseadas na Agenda (meeting_slots/meeting_slot_attendees)
 * - Busca closer_id pelo email do SDR na tabela closers
 * - Conta reuniões atendidas pelo closer no período
 * - Conta contratos pagos (contract_paid + refunded) pela DATA DO PAGAMENTO
 * - Conta no-shows
 * - Conta vendas parceria de hubla_transactions
 */
export interface CloserAgendaMetrics {
  closerId: string | null;
  r1_alocadas: number;        // Total de slots alocados ao closer
  r1_realizadas: number;      // completed + contract_paid + refunded
  contratos_pagos: number;    // contract_paid + refunded (pela data do pagamento)
  no_shows: number;           // status = no_show
  vendas_parceria: number;    // hubla_transactions com product_category='parceria'
}

export const useCloserAgendaMetrics = (sdrId: string | undefined, anoMes: string | undefined) => {
  return useQuery({
    queryKey: ['closer-agenda-metrics', sdrId, anoMes],
    queryFn: async (): Promise<CloserAgendaMetrics> => {
      if (!sdrId || !anoMes) {
        return { closerId: null, r1_alocadas: 0, r1_realizadas: 0, contratos_pagos: 0, no_shows: 0, vendas_parceria: 0 };
      }

      // 1. Buscar email do SDR
      const { data: sdr, error: sdrError } = await supabase
        .from('sdr')
        .select('email')
        .eq('id', sdrId)
        .single();

      if (sdrError || !sdr?.email) {
        console.error('[useCloserAgendaMetrics] Error fetching SDR:', sdrError);
        return { closerId: null, r1_alocadas: 0, r1_realizadas: 0, contratos_pagos: 0, no_shows: 0, vendas_parceria: 0 };
      }

      // 2. Buscar closer_id pelo email
      const { data: closer, error: closerError } = await supabase
        .from('closers')
        .select('id')
        .ilike('email', sdr.email)
        .eq('is_active', true)
        .maybeSingle();

      if (closerError || !closer?.id) {
        console.warn('[useCloserAgendaMetrics] Closer not found for email:', sdr.email);
        return { closerId: null, r1_alocadas: 0, r1_realizadas: 0, contratos_pagos: 0, no_shows: 0, vendas_parceria: 0 };
      }

      const closerId = closer.id;

      // 3. Calcular período do mês
      const [year, month] = anoMes.split('-').map(Number);
      const monthDate = new Date(year, month - 1, 1);
      const startDate = format(startOfMonth(monthDate), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(monthDate), 'yyyy-MM-dd');

      // 4. Buscar todos os meeting_slots do closer no período (para R1 alocadas, realizadas, no-shows)
      const { data: slots, error: slotsError } = await supabase
        .from('meeting_slots')
        .select(`
          id,
          scheduled_at,
          meeting_slot_attendees (
            id,
            status,
            is_partner
          )
        `)
        .eq('closer_id', closerId)
        .gte('scheduled_at', `${startDate}T00:00:00`)
        .lte('scheduled_at', `${endDate}T23:59:59`);

      if (slotsError) {
        console.error('[useCloserAgendaMetrics] Error fetching slots:', slotsError);
        return { closerId, r1_alocadas: 0, r1_realizadas: 0, contratos_pagos: 0, no_shows: 0, vendas_parceria: 0 };
      }

      // 5. Contar métricas baseadas nos attendees (EXCETO contratos_pagos)
      let r1_alocadas = 0;
      let r1_realizadas = 0;
      let no_shows = 0;

      slots?.forEach(slot => {
        const attendees = slot.meeting_slot_attendees || [];
        
        attendees.forEach((att: any) => {
          // Skip partners from metrics
          if (att.is_partner) return;
          
          r1_alocadas++;
          
          const status = att.status?.toLowerCase();
          
          // Realizadas: completed, contract_paid, refunded
          if (['completed', 'contract_paid', 'refunded'].includes(status)) {
            r1_realizadas++;
          }
          
          // No-shows
          if (status === 'no_show') {
            no_shows++;
          }
        });
      });

      // 6. CONTRATOS PAGOS: Buscar pela DATA DO PAGAMENTO (contract_paid_at)
      // Query 1: Contratos com contract_paid_at no período (inclui scheduled_at para detectar Outside)
      const { data: contractsByPaymentDate, error: contractsError } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          id,
          status,
          contract_paid_at,
          meeting_slot:meeting_slots!inner(closer_id, scheduled_at)
        `)
        .eq('meeting_slot.closer_id', closerId)
        .in('status', ['contract_paid', 'refunded'])
        .eq('is_partner', false)
        .not('contract_paid_at', 'is', null)
        .gte('contract_paid_at', `${startDate}T00:00:00`)
        .lte('contract_paid_at', `${endDate}T23:59:59`);

      if (contractsError) {
        console.error('[useCloserAgendaMetrics] Error fetching contracts by payment date:', contractsError);
      }

      // Query 2: Fallback para contratos antigos sem contract_paid_at (usa scheduled_at)
      // Nota: fallback nunca é Outside por definição (usa scheduled_at como data)
      const { data: contractsWithoutTimestamp, error: fallbackError } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          id,
          status,
          contract_paid_at,
          meeting_slot:meeting_slots!inner(closer_id, scheduled_at)
        `)
        .eq('meeting_slot.closer_id', closerId)
        .in('status', ['contract_paid', 'refunded'])
        .eq('is_partner', false)
        .is('contract_paid_at', null)
        .gte('meeting_slot.scheduled_at', `${startDate}T00:00:00`)
        .lte('meeting_slot.scheduled_at', `${endDate}T23:59:59`);

      if (fallbackError) {
        console.error('[useCloserAgendaMetrics] Error fetching contracts fallback:', fallbackError);
      }

      // Contar contratos EXCLUINDO Outside (contrato pago ANTES da reunião)
      let contratos_pagos = 0;
      
      contractsByPaymentDate?.forEach(att => {
        const scheduledAt = (att.meeting_slot as any)?.scheduled_at;
        const contractPaidAt = att.contract_paid_at;
        
        // Excluir Outside: contrato pago ANTES da reunião não conta
        if (contractPaidAt && scheduledAt && new Date(contractPaidAt) < new Date(scheduledAt)) {
          return; // Outside - não contar
        }
        
        contratos_pagos++;
      });
      
      // Fallback: adicionar contratos sem timestamp (nunca são Outside)
      contratos_pagos += contractsWithoutTimestamp?.length || 0;

      console.log('[useCloserAgendaMetrics] Contratos pagos:', {
        byPaymentDate: contractsByPaymentDate?.length || 0,
        outsideExcluded: (contractsByPaymentDate?.length || 0) - contratos_pagos + (contractsWithoutTimestamp?.length || 0),
        fallback: contractsWithoutTimestamp?.length || 0,
        total: contratos_pagos
      });

      // 7. Buscar vendas parceria de hubla_transactions
      const attendeeIds = slots?.flatMap(s => 
        (s.meeting_slot_attendees || [])
          .filter((a: any) => !a.is_partner)
          .map((a: any) => a.id)
      ) || [];

      let vendas_parceria = 0;
      
      if (attendeeIds.length > 0) {
        const { data: transactions, error: txError } = await supabase
          .from('hubla_transactions')
          .select('id, amount')
          .in('linked_attendee_id', attendeeIds)
          .eq('product_category', 'parceria')
          .eq('sale_status', 'paid');

        if (!txError && transactions) {
          vendas_parceria = transactions.length;
        }
      }

      return {
        closerId,
        r1_alocadas,
        r1_realizadas,
        contratos_pagos,
        no_shows,
        vendas_parceria,
      };
    },
    enabled: !!sdrId && !!anoMes,
    staleTime: 30000,
  });
};
