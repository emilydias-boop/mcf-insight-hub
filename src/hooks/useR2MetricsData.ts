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
  // Seção 1 - Leads do Carrinho
  totalLeads: number;
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

export function useR2MetricsData(weekDate: Date) {
  const weekStart = getCustomWeekStart(weekDate);
  const weekEnd = getCustomWeekEnd(weekDate);

  return useQuery({
    queryKey: ['r2-metrics-data', format(weekStart, 'yyyy-MM-dd')],
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
        .not('status', 'in', '(cancelled,rescheduled)');

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

      // 4. Count metrics
      let totalLeads = 0;
      let desistentes = 0;
      let reprovados = 0;
      let reembolsos = 0;
      let proximaSemana = 0;
      let noShow = 0;
      const noShowAttendees: R2MetricsData['noShowAttendees'] = [];
      let aprovados = 0;
      const approvedEmails: string[] = [];
      const approvedPhones: string[] = [];
      
      // Track per-closer stats
      const closerStats = new Map<string, {
        name: string;
        color: string;
        aprovados: number;
        vendas: number;
      }>();

      meetings?.forEach(meeting => {
        const closerData = meeting.closer as { id: string; name: string; color: string } | null;
        const closerId = closerData?.id || 'unknown';
        const closerName = closerData?.name || 'Sem closer';
        const closerColor = closerData?.color || '#6B7280';

        if (!closerStats.has(closerId)) {
          closerStats.set(closerId, {
            name: closerName,
            color: closerColor,
            aprovados: 0,
            vendas: 0,
          });
        }

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
          totalLeads++;
          
          const statusName = att.r2_status_id ? statusMap.get(att.r2_status_id) || '' : '';
          
          // Count by status
          if (statusName.includes('desistente')) {
            desistentes++;
          } else if (statusName.includes('reprovado')) {
            reprovados++;
          } else if (statusName.includes('reembolso')) {
            reembolsos++;
          } else if (statusName.includes('próxima semana') || statusName.includes('proxima semana')) {
            proximaSemana++;
          } else if (statusName.includes('aprovado') || statusName.includes('approved')) {
            aprovados++;
            closerStats.get(closerId)!.aprovados++;
            
            // Collect contact info for matching
            const contactEmail = att.deal?.contact?.email;
            const contactPhone = att.deal?.contact?.phone || att.attendee_phone;
            
            if (contactEmail) approvedEmails.push(contactEmail.toLowerCase());
            if (contactPhone) {
              const normalized = normalizePhone(contactPhone);
              if (normalized) approvedPhones.push(normalized);
            }
          }

        // Check ATTENDEE status for no-show (not meeting status)
        if (att.status === 'no_show') {
            noShow++;
            noShowAttendees.push({
              id: att.id,
              name: att.attendee_name || 'Sem nome',
              phone: att.attendee_phone,
              meetingId: meeting.id,
            });
          }
        });
      });

      // 5. Match with Hubla transactions (parceria category)
      const { data: hublaVendas, error: hublaError } = await supabase
        .from('hubla_transactions')
        .select('id, customer_email, customer_phone, net_value')
        .eq('product_category', 'parceria')
        .gte('sale_date', weekStart.toISOString())
        .lte('sale_date', endOfDay(weekEnd).toISOString())
        .in('sale_status', ['paid', 'completed']);

      if (hublaError) throw hublaError;

      // Match sales by email or phone - CONSOLIDATE by customer to avoid counting P2/installments
      const matchedClosers = new Map<string, number>();
      const countedSaleKeys = new Set<string>(); // Track unique sales by customer

      hublaVendas?.forEach(venda => {
        const vendaEmail = venda.customer_email?.toLowerCase();
        const vendaPhone = normalizePhone(venda.customer_phone);
        
        const emailMatch = vendaEmail && approvedEmails.includes(vendaEmail);
        const phoneMatch = vendaPhone && approvedPhones.includes(vendaPhone);
        
        if (emailMatch || phoneMatch) {
          // Create a unique key per customer (prefer email, fallback to phone)
          const saleKey = vendaEmail || vendaPhone || venda.id;
          
          // Skip if this customer was already counted (consolidate P1+P2 into one sale)
          if (countedSaleKeys.has(saleKey)) return;
          countedSaleKeys.add(saleKey);
          
          // Find which closer this sale belongs to - STOP at first match
          let matchedCloserId: string | null = null;
          
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
          
          // Increment count only for the matched closer
          if (matchedCloserId) {
            matchedClosers.set(matchedCloserId, (matchedClosers.get(matchedCloserId) || 0) + 1);
          }
        }
      });

      // vendas = unique consolidated sales count
      const vendas = countedSaleKeys.size;

      // Update closer vendas counts
      matchedClosers.forEach((count, closerId) => {
        const stats = closerStats.get(closerId);
        if (stats) {
          stats.vendas = count;
        }
      });

      // Calculate percentages
      const leadsPerdidos = desistentes + reprovados + reembolsos + noShow;
      const leadsPerdidosPercent = totalLeads > 0 ? (leadsPerdidos / totalLeads) * 100 : 0;
      
      const selecionados = aprovados;
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
        desistentes,
        reprovados,
        reembolsos,
        proximaSemana,
        noShow,
        leadsPerdidosPercent,
        noShowAttendees,
        selecionados,
        vendas: totalVendas,
        vendasExtras: vendasExtras?.length || 0,
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
