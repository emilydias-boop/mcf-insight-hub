import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCustomWeekStart, getCustomWeekEnd } from '@/lib/dateHelpers';
import { format, endOfDay } from 'date-fns';

export interface CloserConversion {
  closerId: string;
  closerName: string;
  closerColor: string;
  aprovados: number;
  vendas: number;
  conversion: number;
}

export interface R2MetricsData {
  // Seção 1 - Leads do Carrinho (deduplicados por deal_id)
  totalLeads: number;       // Leads ÚNICOS que passaram pelo R2
  leadsAtivos: number;      // Leads únicos realmente no carrinho (excluindo perdidos)
  desistentes: number;
  reprovados: number;
  reembolsos: number;
  proximaSemana: number;
  noShow: number;
  leadsPerdidosPercent: number;
  noShowAttendees: Array<{
    id: string;
    name: string;
    phone: string | null;
    meetingId: string;
  }>;
  
  // Seção 2 - Conversão
  selecionados: number;
  vendas: number;
  vendasExtras: number;
  conversaoGeral: number;
  
  // Seção 3 - Por Closer
  closerConversions: CloserConversion[];
}

// Helper to normalize phone numbers for matching
const normalizePhone = (phone: string | null): string | null => {
  if (!phone) return null;
  return phone.replace(/\D/g, '').slice(-11);
};

export function useR2MetricsData(weekStart: Date, weekEnd: Date) {
  return useQuery({
    queryKey: ['r2-metrics-data', format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd')],
    queryFn: async (): Promise<R2MetricsData> => {
      // 1. Get all R2 meetings for the week
      const { data: meetings, error: meetingsError } = await supabase
        .from('meeting_slots')
        .select(`
          id,
          status,
          scheduled_at,
          closer_id,
          closer:closers(id, name, color),
          attendees:meeting_slot_attendees(
            id,
            attendee_name,
            attendee_phone,
            status,
            r2_status_id,
            carrinho_status,
            deal_id,
            deal:crm_deals(
              id,
              contact:crm_contacts(email, phone)
            )
          )
        `)
        .eq('meeting_type', 'r2')
        .gte('scheduled_at', weekStart.toISOString())
        .lte('scheduled_at', endOfDay(weekEnd).toISOString())
        .not('status', 'eq', 'cancelled');

      if (meetingsError) throw meetingsError;

      // 2. Get R2 status options
      const { data: statusOptions, error: statusError } = await supabase
        .from('r2_status_options')
        .select('id, name')
        .eq('is_active', true);

      if (statusError) throw statusError;

      // Map status IDs to names
      const statusMap = new Map(statusOptions?.map(s => [s.id, s.name.toLowerCase()]) || []);

      // 3. Get vendas extras for this week
      const { data: vendasExtras, error: vendasExtrasError } = await supabase
        .from('r2_vendas_extras')
        .select('*')
        .eq('week_start', format(weekStart, 'yyyy-MM-dd'));

      if (vendasExtrasError) throw vendasExtrasError;

      // 4. Collect all attendee IDs for no-show rescheduling check
      const allAttendeeIds: string[] = [];
      const allDealIds: string[] = [];
      const noShowAttendeesRaw: Array<{
        id: string;
        name: string;
        phone: string | null;
        meetingId: string;
        deal_id: string | null;
      }> = [];

      // First pass: collect all attendee info
      meetings?.forEach(meeting => {
        const attendees = meeting.attendees as Array<{
          id: string;
          attendee_name: string | null;
          attendee_phone: string | null;
          status: string;
          r2_status_id: string | null;
          carrinho_status: string | null;
          deal_id: string | null;
          deal: { id: string; contact: { email: string | null; phone: string | null } | null } | null;
        }> || [];

        attendees.forEach(att => {
          allAttendeeIds.push(att.id);
          if (att.deal_id) allDealIds.push(att.deal_id);
          
          if (att.status === 'no_show') {
            noShowAttendeesRaw.push({
              id: att.id,
              name: att.attendee_name || 'Sem nome',
              phone: att.attendee_phone,
              meetingId: meeting.id,
              deal_id: att.deal_id,
            });
          }
        });
      });

      // 5. Check which no-shows were rescheduled (have children with parent_attendee_id)
      const noShowIds = noShowAttendeesRaw.map(ns => ns.id);
      let rescheduledIds = new Set<string>();
      
      if (noShowIds.length > 0) {
        const { data: rescheduledChildren } = await supabase
          .from('meeting_slot_attendees')
          .select('parent_attendee_id')
          .in('parent_attendee_id', noShowIds);
        
        rescheduledIds = new Set(rescheduledChildren?.map(c => c.parent_attendee_id).filter(Boolean) as string[]);
      }

      // 6. Check which deals have reembolso_solicitado flag
      const noShowDealIds = noShowAttendeesRaw.filter(ns => ns.deal_id).map(ns => ns.deal_id!);
      let refundedDealIds = new Set<string>();
      
      if (noShowDealIds.length > 0) {
        const { data: refundedDeals } = await supabase
          .from('crm_deals')
          .select('id, custom_fields')
          .in('id', noShowDealIds);
        
        refundedDealIds = new Set(
          refundedDeals?.filter(d => (d.custom_fields as Record<string, unknown>)?.reembolso_solicitado).map(d => d.id) || []
        );
      }

      // 7. DEDUPLICAÇÃO POR DEAL_ID - Agrupar attendees por deal_id mantendo o mais recente
      interface LeadRecord {
        deal_id: string;
        attendee_id: string;
        status: string;
        r2_status: string;
        r2_status_id: string | null;
        scheduled_at: string;
        closer_id: string;
        closer_name: string;
        closer_color: string;
        attendee_name: string | null;
        attendee_phone: string | null;
        contact_email: string | null;
        contact_phone: string | null;
        is_no_show: boolean;
      }
      
      const leadsByDeal = new Map<string, LeadRecord>();
      
      meetings?.forEach(meeting => {
        const closerData = meeting.closer as { id: string; name: string; color: string } | null;
        const closerId = closerData?.id || 'unknown';
        const closerName = closerData?.name || 'Sem closer';
        const closerColor = closerData?.color || '#6B7280';
        
        const attendees = meeting.attendees as Array<{
          id: string;
          attendee_name: string | null;
          attendee_phone: string | null;
          status: string;
          r2_status_id: string | null;
          carrinho_status: string | null;
          deal_id: string | null;
          deal: { id: string; contact: { email: string | null; phone: string | null } | null } | null;
        }> || [];
        
        attendees.forEach(att => {
          // Skip rescheduled/cancelled attendees - they are superseded by newer records
          if (att.status === 'rescheduled' || att.status === 'cancelled') return;
          const key = att.deal_id || att.id; // Usar attendee ID se não tiver deal_id
          const existing = leadsByDeal.get(key);
          const statusName = att.r2_status_id ? statusMap.get(att.r2_status_id) || '' : '';
          
          const isNoShow = att.status === 'no_show' && 
            !rescheduledIds.has(att.id) && 
            !(att.deal_id && refundedDealIds.has(att.deal_id));
          
          // Função de prioridade: Aprovado > Reprovado > outros status
          const getStatusPriority = (r2Status: string, isNoShowStatus: boolean): number => {
            if (r2Status.includes('aprovado') || r2Status.includes('approved')) return 100;
            if (r2Status.includes('reprovado')) return 90;
            if (r2Status.includes('desistente')) return 80;
            if (r2Status.includes('reembolso')) return 70;
            if (r2Status.includes('próxima semana') || r2Status.includes('proxima semana')) return 60;
            if (isNoShowStatus) return 10;
            return 0; // Sem status definido
          };
          
          const currentPriority = getStatusPriority(statusName, isNoShow);
          const existingPriority = existing ? getStatusPriority(existing.r2_status, existing.is_no_show) : -1;
          
          // Prioridade: status mais relevante > mais recente
          const shouldReplace = !existing || 
            currentPriority > existingPriority ||
            (currentPriority === existingPriority && new Date(meeting.scheduled_at) > new Date(existing.scheduled_at));
          
          if (shouldReplace) {
            leadsByDeal.set(key, {
              deal_id: key,
              attendee_id: att.id,
              status: att.status,
              r2_status: statusName,
              r2_status_id: att.r2_status_id,
              scheduled_at: meeting.scheduled_at,
              closer_id: closerId,
              closer_name: closerName,
              closer_color: closerColor,
              attendee_name: att.attendee_name,
              attendee_phone: att.attendee_phone,
              contact_email: att.deal?.contact?.email || null,
              contact_phone: att.deal?.contact?.phone || att.attendee_phone,
              is_no_show: isNoShow,
            });
          }
        });
      });
      
      // Contar métricas usando leads únicos
      // totalLeads will be calculated after counting categories below
      let desistentes = 0;
      let reprovados = 0;
      let proximaSemana = 0;
      let noShow = 0;
      let aprovados = 0;
      let reembolsosCount = 0;
      
      const approvedEmails: string[] = [];
      const approvedPhones: string[] = [];
      const noShowAttendees: R2MetricsData['noShowAttendees'] = [];
      
      // Track per-closer stats
      const closerStats = new Map<string, {
        name: string;
        color: string;
        aprovados: number;
        vendas: number;
      }>();
      
      leadsByDeal.forEach((lead) => {
        const closerId = lead.closer_id;
        
        if (!closerStats.has(closerId)) {
          closerStats.set(closerId, {
            name: lead.closer_name,
            color: lead.closer_color,
            aprovados: 0,
            vendas: 0,
          });
        }
        
        // Contar por status (usando leads únicos - cada lead em uma categoria)
        if (lead.r2_status.includes('desistente')) {
          desistentes++;
        } else if (lead.r2_status.includes('reembolso')) {
          reembolsosCount++;
        } else if (lead.r2_status.includes('reprovado')) {
          reprovados++;
        } else if (lead.r2_status.includes('próxima semana') || lead.r2_status.includes('proxima semana')) {
          proximaSemana++;
        } else if (lead.is_no_show) {
          noShow++;
          noShowAttendees.push({
            id: lead.attendee_id,
            name: lead.attendee_name || 'Sem nome',
            phone: lead.attendee_phone,
            meetingId: lead.deal_id,
          });
        } else if (lead.r2_status.includes('aprovado') || lead.r2_status.includes('approved')) {
          aprovados++;
          closerStats.get(closerId)!.aprovados++;
          
          // Collect contact info for matching
          if (lead.contact_email) approvedEmails.push(lead.contact_email.toLowerCase());
          if (lead.contact_phone) {
            const normalized = normalizePhone(lead.contact_phone);
            if (normalized) approvedPhones.push(normalized);
          }
        }
      });

      // Total Leads = agendados pendentes + aprovados (exclui no-show, desistentes, reembolsos, reprovados, próxima semana)
      const agendadosPendentes = leadsByDeal.size - desistentes - reprovados - reembolsosCount - proximaSemana - noShow - aprovados;
      const totalLeads = agendadosPendentes + aprovados;

      const { data: hublaVendas, error: hublaError } = await supabase
        .from('hubla_transactions')
        .select('id, customer_email, customer_phone, net_value, linked_attendee_id')
        .eq('product_category', 'parceria')
        .gte('sale_date', weekStart.toISOString())
        .lte('sale_date', endOfDay(weekEnd).toISOString());

      if (hublaError) throw hublaError;

      // 5.1 For linked_attendee_id matching, also fetch the scheduled_at to detect extras
      const linkedAttendeeIds = hublaVendas?.filter(v => v.linked_attendee_id).map(v => v.linked_attendee_id!) || [];
      const linkedAttendeeScheduledMap = new Map<string, string>();

      if (linkedAttendeeIds.length > 0) {
        const { data: linkedAttendeesData } = await supabase
          .from('meeting_slot_attendees')
          .select(`
            id,
            meeting_slot:meeting_slots!inner (
              scheduled_at
            )
          `)
          .in('id', linkedAttendeeIds);

        linkedAttendeesData?.forEach((att: any) => {
          if (att.meeting_slot?.scheduled_at) {
            linkedAttendeeScheduledMap.set(att.id, att.meeting_slot.scheduled_at);
          }
        });
      }

      // Build map of approved attendee IDs to their closers (for linked_attendee_id matching)
      const approvedAttendeeIds = new Set<string>();
      const attendeeIdToCloser = new Map<string, string>();

      meetings?.forEach(meeting => {
        const closerData = meeting.closer as { id: string } | null;
        const closerId = closerData?.id;
        
        const attendees = meeting.attendees as Array<{
          id: string;
          r2_status_id: string | null;
        }> || [];
        
        attendees.forEach(att => {
          const attStatusName = att.r2_status_id ? statusMap.get(att.r2_status_id) || '' : '';
          if (attStatusName.includes('aprovado')) {
            approvedAttendeeIds.add(att.id);
            if (closerId) attendeeIdToCloser.set(att.id, closerId);
          }
        });
      });

      // Match sales by email, phone, OR linked_attendee_id - CONSOLIDATE by customer
      const matchedClosers = new Map<string, number>();
      const countedSaleKeys = new Set<string>(); // Track unique sales by customer
      const extraSaleKeys = new Set<string>(); // Track sales from previous weeks

      hublaVendas?.forEach(venda => {
        const vendaEmail = venda.customer_email?.toLowerCase();
        const vendaPhone = normalizePhone(venda.customer_phone);
        
        const emailMatch = vendaEmail && approvedEmails.includes(vendaEmail);
        const phoneMatch = vendaPhone && approvedPhones.includes(vendaPhone);
        const linkedMatch = venda.linked_attendee_id && approvedAttendeeIds.has(venda.linked_attendee_id);
        
        if (emailMatch || phoneMatch || linkedMatch) {
          // Create a unique key per customer (prefer email, fallback to phone, then transaction id)
          const saleKey = vendaEmail || vendaPhone || venda.id;
          
          // Skip if this customer was already counted (consolidate P1+P2 into one sale)
          if (countedSaleKeys.has(saleKey)) return;
          countedSaleKeys.add(saleKey);

          // Check if this is an "extra" sale (attendee from a different week)
          if (linkedMatch && venda.linked_attendee_id) {
            const linkedScheduledAt = linkedAttendeeScheduledMap.get(venda.linked_attendee_id);
            if (linkedScheduledAt) {
              const linkedWeekStart = getCustomWeekStart(new Date(linkedScheduledAt));
              if (linkedWeekStart.getTime() !== weekStart.getTime()) {
                extraSaleKeys.add(saleKey);
              }
            }
          }
          
          // Find which closer this sale belongs to
          let matchedCloserId: string | null = null;
          
          // If linked via manual link, get closer directly from the map
          if (linkedMatch && venda.linked_attendee_id) {
            matchedCloserId = attendeeIdToCloser.get(venda.linked_attendee_id) || null;
          } else {
            // Loop through meetings to find closer by email/phone match
            outerLoop:
            for (const meeting of meetings || []) {
              const closerData = meeting.closer as { id: string } | null;
              const closerId = closerData?.id;
              
              const attendees = meeting.attendees as Array<{
                attendee_phone: string | null;
                r2_status_id: string | null;
                deal: { contact: { email: string | null; phone: string | null } | null } | null;
              }> || [];
              
              for (const att of attendees) {
                // Only match approved attendees
                const attStatusName = att.r2_status_id ? statusMap.get(att.r2_status_id) || '' : '';
                if (!attStatusName.includes('aprovado')) continue;
                
                const attEmail = att.deal?.contact?.email?.toLowerCase();
                const attPhone = normalizePhone(att.deal?.contact?.phone || att.attendee_phone);
                
                if ((vendaEmail && attEmail === vendaEmail) || (vendaPhone && attPhone === vendaPhone)) {
                  matchedCloserId = closerId || null;
                  break outerLoop;
                }
              }
            }
          }
          
          // Increment count only for the matched closer
          if (matchedCloserId) {
            matchedClosers.set(matchedCloserId, (matchedClosers.get(matchedCloserId) || 0) + 1);
          }
        }
      });

      // vendas = unique consolidated sales count
      const vendas = countedSaleKeys.size;
      const vendasExtrasDeSemanaAnterior = extraSaleKeys.size;

      // Update closer vendas counts
      matchedClosers.forEach((count, closerId) => {
        const stats = closerStats.get(closerId);
        if (stats) {
          stats.vendas = count;
        }
      });

      // Calculate percentages
      // Reembolsos = contagem real do status "Reembolso"
      const reembolsos = reembolsosCount;
      
      // Leads perdidos = soma única sem duplicidade (cada lead em uma categoria)
      const leadsPerdidosCount = desistentes + reprovados + reembolsosCount;
      const leadsPerdidosPercent = totalLeads > 0 ? (leadsPerdidosCount / totalLeads) * 100 : 0;
      
      // Leads ativos = aprovados (sincronizado com KPIs do Carrinho)
      const leadsAtivos = aprovados;
      
      const selecionados = aprovados;
      // Vendas extras = vendas de semanas anteriores + vendas extras manuais
      const totalVendasExtras = vendasExtrasDeSemanaAnterior + (vendasExtras?.length || 0);
      const totalVendas = vendas + (vendasExtras?.length || 0);
      const conversaoGeral = selecionados > 0 ? (totalVendas / selecionados) * 100 : 0;

      // Build closer conversions array
      const closerConversions: CloserConversion[] = Array.from(closerStats.entries())
        .filter(([_, stats]) => stats.aprovados > 0)
        .map(([closerId, stats]) => ({
          closerId,
          closerName: stats.name,
          closerColor: stats.color,
          aprovados: stats.aprovados,
          vendas: stats.vendas,
          conversion: stats.aprovados > 0 ? (stats.vendas / stats.aprovados) * 100 : 0,
        }))
        .sort((a, b) => b.aprovados - a.aprovados);

      return {
        totalLeads,
        leadsAtivos,
        desistentes,
        reprovados,
        reembolsos,
        proximaSemana,
        noShow,
        leadsPerdidosPercent,
        noShowAttendees,
        selecionados,
        vendas: totalVendas,
        vendasExtras: totalVendasExtras,
        conversaoGeral,
        closerConversions,
      };
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });
}

// Hook for adding external sales
export function useAddVendaExtra() {
  const queryClient = useQuery({ queryKey: ['r2-metrics-data'] });
  
  return {
    addVenda: async (data: {
      weekStart: Date;
      attendeeName: string;
      attendeePhone?: string;
      attendeeEmail?: string;
      closerId?: string;
      notes?: string;
    }) => {
      const { error } = await supabase
        .from('r2_vendas_extras')
        .insert({
          week_start: format(data.weekStart, 'yyyy-MM-dd'),
          attendee_name: data.attendeeName,
          attendee_phone: data.attendeePhone || null,
          attendee_email: data.attendeeEmail || null,
          closer_id: data.closerId || null,
          notes: data.notes || null,
        });

      if (error) throw error;
    },
  };
}
