import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay, format } from "date-fns";

/**
 * Executes a Supabase .in() query in batches to avoid URL length limits.
 * Splits large arrays into chunks of `batchSize` and runs them in parallel.
 */
async function batchedIn<T>(
  queryFn: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: any }>,
  items: string[],
  batchSize = 200
): Promise<T[]> {
  if (items.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    chunks.push(items.slice(i, i + batchSize));
  }
  const results = await Promise.all(chunks.map(chunk => queryFn(chunk)));
  const allData: T[] = [];
  for (const r of results) {
    if (r.error) throw r.error;
    if (r.data) allData.push(...r.data);
  }
  return allData;
}

export interface R1CloserMetric {
  closer_id: string;
  closer_name: string;
  closer_color: string | null;
  r1_agendada: number;
  r1_realizada: number;
  noshow: number;
  contrato_pago: number;
  outside: number;
  r2_agendada: number;
}

export function useR1CloserMetrics(startDate: Date, endDate: Date, bu: string = 'incorporador') {
  return useQuery({
    queryKey: ['r1-closer-metrics', format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd'), bu],
    queryFn: async (): Promise<R1CloserMetric[]> => {
      const start = startOfDay(startDate).toISOString();
      const end = endOfDay(endDate).toISOString();

      // Fetch active closers that handle R1 meetings - FILTERED by BU
      const { data: closers, error: closersError } = await supabase
        .from('closers')
        .select('id, name, color, meeting_type, bu')
        .eq('is_active', true)
        .eq('bu', bu);

      if (closersError) throw closersError;

      // Filter closers that handle R1 (meeting_type is null or 'r1')
      const r1Closers = closers?.filter(c => !c.meeting_type || c.meeting_type === 'r1') || [];

      // Fetch active SDRs from database instead of hardcoded list
      const { data: sdrs, error: sdrsError } = await supabase
        .from('sdr')
        .select('email, name')
        .eq('active', true)
        .eq('squad', bu)
        .eq('role_type', 'sdr');

      if (sdrsError) throw sdrsError;

      const validSdrEmails = new Set((sdrs || []).map(s => s.email.toLowerCase()));

      // Statuses that count as "Agendada" - explicitly defined to avoid counting canceled/rescheduled
      const allowedAgendadaStatuses = ['scheduled', 'invited', 'completed', 'no_show', 'contract_paid'];

      // Fetch R1 meeting slots with attendees in the period
      const { data: meetings, error: meetingsError } = await supabase
        .from('meeting_slots')
        .select(`
          id,
          closer_id,
          meeting_type,
          scheduled_at,
          meeting_slot_attendees (
            id,
            status,
            deal_id,
            booked_by
          )
        `)
        .eq('meeting_type', 'r1')
        .gte('scheduled_at', start)
        .lte('scheduled_at', end)
        .neq('status', 'cancelled')
        .neq('status', 'canceled');

      if (meetingsError) throw meetingsError;

      // Fetch profiles to map booked_by UUID to email
      const bookedByIds = new Set<string>();
      meetings?.forEach(meeting => {
        meeting.meeting_slot_attendees?.forEach(att => {
          if (att.booked_by) bookedByIds.add(att.booked_by);
        });
      });

      const profiles = await batchedIn<{ id: string; email: string | null }>(
        (chunk) => supabase.from('profiles').select('id, email').in('id', chunk),
        Array.from(bookedByIds)
      );

      const profileEmailMap = new Map<string, string>();
      profiles?.forEach(p => {
        if (p.email) profileEmailMap.set(p.id, p.email.toLowerCase());
      });

      // Fetch R2 meetings to count R2 agendadas per closer
      // R2 is attributed to the closer who did the R1 for the same deal
      const { data: r2Meetings, error: r2Error } = await supabase
        .from('meeting_slots')
        .select(`
          id,
          scheduled_at,
          meeting_slot_attendees (
            deal_id
          )
        `)
        .eq('meeting_type', 'r2')
        .gte('scheduled_at', start)
        .lte('scheduled_at', end)
        .not('status', 'eq', 'cancelled');

      if (r2Error) throw r2Error;

      // NOVA QUERY: Buscar TODOS os R1 meetings (SEM filtro de data) para mapear deal → closer R1
      // Isso é necessário porque uma R2 de janeiro pode estar vinculada a uma R1 de dezembro
      const { data: allR1Meetings, error: allR1Error } = await supabase
        .from('meeting_slots')
        .select(`
          closer_id,
          meeting_slot_attendees (
            deal_id,
            booked_by,
            status
          )
        `)
        .eq('meeting_type', 'r1')
        .neq('status', 'cancelled')
        .neq('status', 'canceled');

      if (allR1Error) throw allR1Error;

      // Fetch profiles for the new query's booked_by IDs
      const allBookedByIds = new Set<string>();
      allR1Meetings?.forEach(meeting => {
        meeting.meeting_slot_attendees?.forEach(att => {
          if (att.booked_by) allBookedByIds.add(att.booked_by);
        });
      });

      const allProfiles = await batchedIn<{ id: string; email: string | null }>(
        (chunk) => supabase.from('profiles').select('id, email').in('id', chunk),
        Array.from(allBookedByIds)
      );

      const allProfileEmailMap = new Map<string, string>();
      allProfiles?.forEach(p => {
        if (p.email) allProfileEmailMap.set(p.id, p.email.toLowerCase());
      });

      // Build a map of deal_id -> R1 closer_id using ALL R1 meetings (not date-filtered)
      const dealToR1Closer = new Map<string, string>();
      allR1Meetings?.forEach(meeting => {
        meeting.meeting_slot_attendees?.forEach(att => {
          if (att.deal_id && meeting.closer_id) {
            // Only include if booked by valid SDR AND has an allowed status
            const bookedByEmail = att.booked_by ? allProfileEmailMap.get(att.booked_by) : null;
            const status = att.status;
            if (bookedByEmail && validSdrEmails.has(bookedByEmail) && allowedAgendadaStatuses.includes(status)) {
              // First match wins - don't overwrite existing mappings
              if (!dealToR1Closer.has(att.deal_id)) {
                dealToR1Closer.set(att.deal_id, meeting.closer_id);
              }
            }
          }
        });
      });

      // Count R2 meetings per R1 closer
      const r2CountByCloser = new Map<string, number>();
      r2Meetings?.forEach(meeting => {
        meeting.meeting_slot_attendees?.forEach(att => {
          if (att.deal_id) {
            const r1CloserId = dealToR1Closer.get(att.deal_id);
            if (r1CloserId) {
              r2CountByCloser.set(r1CloserId, (r2CountByCloser.get(r1CloserId) || 0) + 1);
            }
          }
        });
      });

      // ========== CONTRACT PAID BY PAYMENT DATE ==========
      // Buscar contratos pagos pela DATA DO PAGAMENTO (não da reunião)
      // FONTE DA VERDADE: contract_paid_at IS NOT NULL (independente do status)
      const { data: contractsByPaymentDate, error: contractsError } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          id,
          status,
          contract_paid_at,
          booked_by,
          meeting_slot:meeting_slots!inner(
            closer_id,
            meeting_type,
            scheduled_at
          )
        `)
        .eq('meeting_slot.meeting_type', 'r1')
        .not('contract_paid_at', 'is', null)
        .gte('contract_paid_at', start)
        .lte('contract_paid_at', end);

      if (contractsError) throw contractsError;

      // Também buscar contratos com status contract_paid mas SEM contract_paid_at (fallback para scheduled_at)
      // Esses são contratos antigos que não têm timestamp de pagamento
      const { data: contractsWithoutTimestamp } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          id,
          status,
          contract_paid_at,
          booked_by,
          meeting_slot:meeting_slots!inner(
            closer_id,
            meeting_type,
            scheduled_at
          )
        `)
        .eq('status', 'contract_paid')
        .eq('meeting_slot.meeting_type', 'r1')
        .is('contract_paid_at', null)
        .gte('meeting_slot.scheduled_at', start)
        .lte('meeting_slot.scheduled_at', end);

      // Mapear contratos pagos no período por closer
      // Usar Set para evitar duplicatas entre as duas queries
      const contractsByCloser = new Map<string, number>();
      const countedAttendeeIds = new Set<string>();
      
      // Processar contratos COM contract_paid_at (prioridade)
      contractsByPaymentDate?.forEach(att => {
        const closerId = (att.meeting_slot as any)?.closer_id;
        const scheduledAt = (att.meeting_slot as any)?.scheduled_at;
        const contractPaidAt = att.contract_paid_at;
        
        // EXCLUIR OUTSIDE: contrato pago ANTES da reunião não conta
        if (contractPaidAt && scheduledAt) {
          const isOutside = new Date(contractPaidAt) < new Date(scheduledAt);
          if (isOutside) {
            return; // Outside - não contar como contrato pago
          }
        }
        
        if (closerId && att.booked_by && !countedAttendeeIds.has(att.id)) {
          const bookedByEmail = profileEmailMap.get(att.booked_by) || allProfileEmailMap.get(att.booked_by);
          if (bookedByEmail && validSdrEmails.has(bookedByEmail)) {
            contractsByCloser.set(closerId, (contractsByCloser.get(closerId) || 0) + 1);
            countedAttendeeIds.add(att.id);
          }
        }
      });

      // Processar contratos SEM contract_paid_at (fallback) - apenas se não foi contado ainda
      // Nota: fallback usa scheduled_at como data, então nunca é Outside por definição
      contractsWithoutTimestamp?.forEach(att => {
        const closerId = (att.meeting_slot as any)?.closer_id;
        if (closerId && att.booked_by && !countedAttendeeIds.has(att.id)) {
          const bookedByEmail = profileEmailMap.get(att.booked_by) || allProfileEmailMap.get(att.booked_by);
          if (bookedByEmail && validSdrEmails.has(bookedByEmail)) {
            contractsByCloser.set(closerId, (contractsByCloser.get(closerId) || 0) + 1);
            countedAttendeeIds.add(att.id);
          }
        }
      });

      // ========== OUTSIDE DETECTION ==========
      // Outside = lead bought contract BEFORE their R1 meeting
      
      // Collect all contact_ids from R1 meetings in period
      const contactIds = new Set<string>();
      const attendeeContactMap = new Map<string, { closerId: string; meetingDate: string }[]>();
      
      meetings?.forEach(meeting => {
        meeting.meeting_slot_attendees?.forEach(att => {
          // We need to get contact_id from deal - but attendees don't have contact_id directly
          // We'll need to match by email instead using the deal's contact
        });
      });

      // Get all deal_ids from the meetings
      const dealIds = new Set<string>();
      meetings?.forEach(meeting => {
        meeting.meeting_slot_attendees?.forEach(att => {
          if (att.deal_id) dealIds.add(att.deal_id);
        });
      });

      // Fetch deals with their contact emails (batched to avoid URL limit)
      const deals = await batchedIn<{ id: string; contact: { id: string; email: string | null } | null }>(
        (chunk) => supabase.from('crm_deals').select('id, contact:crm_contacts(id, email)').in('id', chunk),
        Array.from(dealIds)
      );

      // Map deal_id -> email
      const dealEmailMap = new Map<string, string>();
      deals?.forEach(deal => {
        const contact = deal.contact as { id: string; email: string | null } | null;
        if (contact?.email) {
          dealEmailMap.set(deal.id, contact.email.toLowerCase());
        }
      });

      // Get unique emails from deals in this period
      const attendeeEmails = [...new Set(Array.from(dealEmailMap.values()))];

      // Fetch contract transactions for these emails (batched to avoid URL limit)
      const contracts = await batchedIn<{ customer_email: string | null; sale_date: string }>(
        (chunk) => supabase
          .from('hubla_transactions')
          .select('customer_email, sale_date')
          .in('customer_email', chunk)
          .eq('offer_id', 'pgah16gjTMdAkqUMVKGz')
          .eq('sale_status', 'completed')
          .order('sale_date', { ascending: true }),
        attendeeEmails.length > 0 ? attendeeEmails : []
      );

      // Map email -> earliest contract date
      const emailContractDate = new Map<string, Date>();
      contracts?.forEach(c => {
        const email = c.customer_email?.toLowerCase();
        if (email) {
          const date = new Date(c.sale_date);
          if (!emailContractDate.has(email) || date < emailContractDate.get(email)!) {
            emailContractDate.set(email, date);
          }
        }
      });

      // Count outsides per closer (contract purchased BEFORE meeting)
      const outsideByCloser = new Map<string, number>();
      meetings?.forEach(meeting => {
        if (!meeting.closer_id) return;
        
        meeting.meeting_slot_attendees?.forEach(att => {
          if (!att.deal_id) return;
          
          // Only count if booked by valid SDR
          const bookedByEmail = att.booked_by ? profileEmailMap.get(att.booked_by) : null;
          if (!bookedByEmail || !validSdrEmails.has(bookedByEmail)) return;
          
          const email = dealEmailMap.get(att.deal_id);
          if (email && emailContractDate.has(email)) {
            const contractDate = emailContractDate.get(email)!;
            const meetingDate = new Date(meeting.scheduled_at);
            
            // Outside = contract purchased BEFORE meeting
            if (contractDate < meetingDate) {
              outsideByCloser.set(meeting.closer_id, (outsideByCloser.get(meeting.closer_id) || 0) + 1);
            }
          }
        });
      });

      // Calculate metrics for each R1 closer
      const metricsMap = new Map<string, R1CloserMetric>();

      // Initialize all R1 closers with zeros
      r1Closers.forEach(closer => {
        metricsMap.set(closer.id, {
          closer_id: closer.id,
          closer_name: closer.name,
          closer_color: closer.color,
          r1_agendada: 0,
          r1_realizada: 0,
          noshow: 0,
          contrato_pago: contractsByCloser.get(closer.id) || 0,
          outside: outsideByCloser.get(closer.id) || 0,
          r2_agendada: r2CountByCloser.get(closer.id) || 0,
        });
      });

      // Process meetings
      meetings?.forEach(meeting => {
        const closerId = meeting.closer_id;
        if (!closerId) return;

        let metric = metricsMap.get(closerId);
        if (!metric) {
          // Only create metrics for closers that belong to the current BU
          const closerInfo = closers?.find(c => c.id === closerId);
          if (!closerInfo) return; // Skip meetings from closers in other BUs
          
          metric = {
            closer_id: closerId,
            closer_name: closerInfo.name,
            closer_color: closerInfo.color || null,
            r1_agendada: 0,
            r1_realizada: 0,
            noshow: 0,
            contrato_pago: contractsByCloser.get(closerId) || 0,
            outside: outsideByCloser.get(closerId) || 0,
            r2_agendada: r2CountByCloser.get(closerId) || 0,
          };
          metricsMap.set(closerId, metric);
        }

        // Count attendees by status - only if booked by valid SDR
        meeting.meeting_slot_attendees?.forEach(att => {
          // Filter: only count if booked by a valid SDR from database
          const bookedByEmail = att.booked_by ? profileEmailMap.get(att.booked_by) : null;
          if (!bookedByEmail || !validSdrEmails.has(bookedByEmail)) {
            return; // Skip attendees not booked by valid SDR
          }

          const status = att.status;
          
          // R1 Agendada: only statuses in allowedAgendadaStatuses
          if (allowedAgendadaStatuses.includes(status)) {
            metric!.r1_agendada++;
          }
          
          // R1 Realizada: completed OR contract_paid OR has contract_paid_at
          // Isso inclui attendees que foram movidos (status = rescheduled) mas tem contract_paid_at
          if (status === 'completed' || status === 'contract_paid') {
            metric!.r1_realizada++;
          }
          
          // No-show
          if (status === 'no_show') {
            metric!.noshow++;
          }
          
          // Contrato Pago - NÃO contar aqui, já é contado por contract_paid_at acima
        });
      });

      // Convert to array and sort by r1_agendada desc
      return Array.from(metricsMap.values()).sort((a, b) => b.r1_agendada - a.r1_agendada);
    },
    staleTime: 30000,
  });
}
