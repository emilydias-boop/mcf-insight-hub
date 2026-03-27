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
 * - EXCLUI outsides de r1_alocadas, r1_realizadas e no_shows
 */
export interface CloserAgendaMetrics {
  closerId: string | null;
  r1_alocadas: number;        // Total de slots alocados ao closer (excl. outsides)
  r1_realizadas: number;      // completed + contract_paid + refunded (excl. outsides)
  contratos_pagos: number;    // contract_paid + refunded (pela data do pagamento)
  no_shows: number;           // status = no_show (excl. outsides)
  vendas_parceria: number;    // hubla_transactions com product_category='parceria'
  r2_agendadas: number;       // R2 meetings attributed to this closer (via R1 deal_id)
}

export const useCloserAgendaMetrics = (sdrId: string | undefined, anoMes: string | undefined) => {
  return useQuery({
    queryKey: ['closer-agenda-metrics', sdrId, anoMes],
    queryFn: async (): Promise<CloserAgendaMetrics> => {
      const empty: CloserAgendaMetrics = { closerId: null, r1_alocadas: 0, r1_realizadas: 0, contratos_pagos: 0, no_shows: 0, vendas_parceria: 0, r2_agendadas: 0 };

      if (!sdrId || !anoMes) return empty;

      // 1. Buscar email do SDR
      const { data: sdr, error: sdrError } = await supabase
        .from('sdr')
        .select('email')
        .eq('id', sdrId)
        .single();

      if (sdrError || !sdr?.email) {
        console.error('[useCloserAgendaMetrics] Error fetching SDR:', sdrError);
        return empty;
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
        return empty;
      }

      const closerId = closer.id;

      // 3. Calcular período do mês
      const [year, month] = anoMes.split('-').map(Number);
      const monthDate = new Date(year, month - 1, 1);
      const startDate = format(startOfMonth(monthDate), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(monthDate), 'yyyy-MM-dd');

      // 4. Buscar todos os meeting_slots do closer no período
      const { data: slots, error: slotsError } = await supabase
        .from('meeting_slots')
        .select(`
          id,
          scheduled_at,
          deal_id,
          meeting_slot_attendees (
            id,
            status,
            is_partner,
            deal_id
          )
        `)
        .eq('closer_id', closerId)
        .gte('scheduled_at', `${startDate}T00:00:00`)
        .lte('scheduled_at', `${endDate}T23:59:59`);

      if (slotsError) {
        console.error('[useCloserAgendaMetrics] Error fetching slots:', slotsError);
        return { ...empty, closerId };
      }

      // ========== OUTSIDE DETECTION ==========
      // Collect deal_ids from attendees
      const dealIds = new Set<string>();
      slots?.forEach(slot => {
        (slot.meeting_slot_attendees || []).forEach((att: any) => {
          if (att.deal_id && !att.is_partner) dealIds.add(att.deal_id);
        });
      });

      // Fetch deals → contact emails
      const dealEmailMap = new Map<string, string>();
      if (dealIds.size > 0) {
        const { data: deals } = await supabase
          .from('crm_deals')
          .select('id, contact:crm_contacts(id, email)')
          .in('id', Array.from(dealIds));

        deals?.forEach(deal => {
          const contact = deal.contact as { id: string; email: string | null } | null;
          if (contact?.email) {
            dealEmailMap.set(deal.id, contact.email.toLowerCase());
          }
        });
      }

      // Fetch earliest contract date per email
      const emailContractDate = new Map<string, Date>();
      const attendeeEmails = [...new Set(Array.from(dealEmailMap.values()))];

      if (attendeeEmails.length > 0) {
        const { data: contracts } = await supabase
          .from('hubla_transactions')
          .select('customer_email, sale_date')
          .in('customer_email', attendeeEmails)
          .in('product_category', ['contrato', 'incorporador'])
          .ilike('product_name', '%contrato%')
          .eq('sale_status', 'completed')
          .order('sale_date', { ascending: true });

        contracts?.forEach(c => {
          const email = c.customer_email?.toLowerCase();
          if (email) {
            const date = new Date(c.sale_date);
            if (!emailContractDate.has(email) || date < emailContractDate.get(email)!) {
              emailContractDate.set(email, date);
            }
          }
        });
      }

      // Helper: check if attendee is an outside lead
      const isOutside = (dealId: string | null, scheduledAt: string): boolean => {
        if (!dealId) return false;
        const email = dealEmailMap.get(dealId);
        if (!email || !emailContractDate.has(email)) return false;
        return emailContractDate.get(email)! < new Date(scheduledAt);
      };

      // 5. Contar métricas baseadas nos attendees (EXCLUINDO outsides)
      let r1_alocadas = 0;
      let r1_realizadas = 0;
      let no_shows = 0;

      slots?.forEach(slot => {
        const attendees = slot.meeting_slot_attendees || [];
        
        attendees.forEach((att: any) => {
          if (att.is_partner) return;
          
          // Skip outsides from closer metrics
          if (isOutside(att.deal_id, slot.scheduled_at)) return;
          
          r1_alocadas++;
          
          const status = att.status?.toLowerCase();
          
          if (['completed', 'contract_paid', 'refunded'].includes(status)) {
            r1_realizadas++;
          }
          
          if (status === 'no_show') {
            no_shows++;
          }
        });
      });

      // 6. CONTRATOS PAGOS: Buscar pela DATA DO PAGAMENTO (contract_paid_at)
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
        
        if (contractPaidAt && scheduledAt && new Date(contractPaidAt) < new Date(scheduledAt)) {
          return; // Outside - não contar
        }
        
        contratos_pagos++;
      });
      
      contratos_pagos += contractsWithoutTimestamp?.length || 0;

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

      // 8. Buscar R2 agendadas atribuídas a este closer
      const r1DealMap = new Map<string, string>();
      for (const slot of (slots || [])) {
        for (const att of (slot.meeting_slot_attendees || [])) {
          const attStatus = (att as any).status?.toLowerCase();
          const dealId = (att as any).deal_id;
          if (dealId && !(att as any).is_partner && 
              ['contract_paid', 'refunded'].includes(attStatus)) {
            const paidAt = (att as any).contract_paid_at || slot.scheduled_at;
            if (!r1DealMap.has(dealId)) {
              r1DealMap.set(dealId, paidAt);
            }
          }
        }
      }

      let r2_agendadas = 0;
      const r1DealIds = [...r1DealMap.keys()];

      if (r1DealIds.length > 0) {
        const { data: r2Slots, error: r2Error } = await supabase
          .from('meeting_slots')
          .select('id, deal_id, created_at')
          .eq('meeting_type', 'r2')
          .in('deal_id', r1DealIds)
          .gte('scheduled_at', `${startDate}T00:00:00`)
          .lte('scheduled_at', `${endDate}T23:59:59`);

        if (!r2Error && r2Slots) {
          r2_agendadas = r2Slots.filter((r2: any) => {
            const paidAt = r1DealMap.get(r2.deal_id);
            return paidAt && new Date(r2.created_at) >= new Date(paidAt);
          }).length;
        }
      }

      if (r2_agendadas === 0) {
        const { data: r2Direct, error: r2DirectError } = await supabase
          .from('meeting_slots')
          .select('id, deal_id, created_at')
          .eq('closer_id', closerId)
          .eq('meeting_type', 'r2')
          .gte('scheduled_at', `${startDate}T00:00:00`)
          .lte('scheduled_at', `${endDate}T23:59:59`);

        if (!r2DirectError && r2Direct) {
          r2_agendadas = r2Direct.filter((r2: any) => {
            const paidAt = r1DealMap.get(r2.deal_id);
            if (!paidAt) return true;
            return new Date(r2.created_at) >= new Date(paidAt);
          }).length;
        }
      }

      return {
        closerId,
        r1_alocadas,
        r1_realizadas,
        contratos_pagos,
        no_shows,
        vendas_parceria,
        r2_agendadas,
      };
    },
    enabled: !!sdrId && !!anoMes,
    staleTime: 30000,
  });
};
