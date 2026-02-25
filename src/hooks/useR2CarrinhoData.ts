import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfDay, endOfDay } from 'date-fns';
import { toast } from 'sonner';

export interface R2CarrinhoAttendee {
  id: string;
  attendee_name: string | null;
  attendee_phone: string | null;
  status: string;
  r2_status_id: string | null;
  r2_status_name: string | null;
  carrinho_status: string | null;
  carrinho_updated_at: string | null;
  deal_id: string | null;
  meeting_id: string;
  meeting_status: string;
  scheduled_at: string;
  closer_id: string | null;
  closer_name: string | null;
  closer_color: string | null;
  deal_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  partner_name: string | null;
  r1_date: string | null;
  r1_closer_name: string | null;
  contract_paid_at: string | null;
}

export function useR2CarrinhoData(weekStart: Date, weekEnd: Date, filter?: 'agendadas' | 'no_show' | 'realizadas' | 'aprovados') {
  return useQuery({
    queryKey: ['r2-carrinho-data', format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd'), filter],
    queryFn: async (): Promise<R2CarrinhoAttendee[]> => {
      // Get R2 status options (all, including inactive, for proper name mapping)
      const { data: statusOptions } = await supabase
        .from('r2_status_options')
        .select('id, name');

      const statusMap = (statusOptions || []).reduce((acc, s) => {
        acc[s.id] = s.name;
        return acc;
      }, {} as Record<string, string>);

      const aprovadoStatusId = statusOptions?.find(s => 
        s.name.toLowerCase().includes('aprovado') || 
        s.name.toLowerCase().includes('approved')
      )?.id;

      // Build query
      let query = supabase
        .from('meeting_slots')
        .select(`
          id,
          status,
          scheduled_at,
          closer:closers!meeting_slots_closer_id_fkey(
            id,
            name,
            color
          ),
          attendees:meeting_slot_attendees(
            id,
            attendee_name,
            attendee_phone,
            status,
            r2_status_id,
            carrinho_status,
            carrinho_updated_at,
            deal_id,
            partner_name,
            contract_paid_at,
            deal:crm_deals(
              id,
              name,
              contact:crm_contacts(
                phone,
                email
              )
            )
          )
        `)
        .eq('meeting_type', 'r2')
        .gte('scheduled_at', startOfDay(weekStart).toISOString())
        .lte('scheduled_at', endOfDay(weekEnd).toISOString())
        .order('scheduled_at', { ascending: true });

      // Apply meeting status filter
      if (filter === 'agendadas') {
        // Mostrar TODOS os attendees R2 da semana (exceto cancelados e reagendados)
        query = query.not('status', 'in', '(cancelled,rescheduled)');
      } else if (filter === 'no_show') {
        query = query.eq('status', 'no_show');
      } else if (filter === 'realizadas') {
        query = query.eq('status', 'completed');
      } else if (filter === 'aprovados') {
        // For aprovados, include all meetings except cancelled
        // Rescheduled meetings should still show if attendee was approved
        query = query.not('status', 'eq', 'cancelled');
      }

      const { data: meetings, error } = await query;

      if (error) throw error;

      // Collect all deal IDs for R1 lookup
      const dealIds = new Set<string>();
      for (const meeting of meetings || []) {
        const attendeesArr = (meeting.attendees || []) as Array<{ deal_id: string | null }>;
        for (const att of attendeesArr) {
          if (att.deal_id) dealIds.add(att.deal_id);
        }
      }

      // Fetch R1 meetings for these deals (includes closer name)
      const r1Map = new Map<string, { date: string; closer_name: string | null }>();
      if (dealIds.size > 0) {
        const { data: r1Meetings } = await supabase
          .from('meeting_slots')
          .select(`
            scheduled_at,
            closer:closers!meeting_slots_closer_id_fkey(name),
            meeting_slot_attendees!inner(deal_id)
          `)
          .eq('meeting_type', 'r1')
          .in('meeting_slot_attendees.deal_id', Array.from(dealIds));

        // Build map: deal_id -> { date, closer_name } (first R1 for each deal)
        r1Meetings?.forEach(r1 => {
          const r1Attendees = r1.meeting_slot_attendees as Array<{ deal_id: string | null }>;
          const r1Closer = r1.closer as { name: string } | null;
          r1Attendees.forEach(att => {
            if (att.deal_id && !r1Map.has(att.deal_id)) {
              r1Map.set(att.deal_id, {
                date: r1.scheduled_at,
                closer_name: r1Closer?.name || null,
              });
            }
          });
        });
      }

      // Flatten to attendees with meeting info
      const attendees: R2CarrinhoAttendee[] = [];

      for (const meeting of meetings || []) {
        const closerData = meeting.closer as { id: string; name: string; color: string | null } | null;
        const attendeesArr = (meeting.attendees || []) as Array<{
          id: string;
          attendee_name: string | null;
          attendee_phone: string | null;
          status: string;
          r2_status_id: string | null;
          carrinho_status: string | null;
          carrinho_updated_at: string | null;
          deal_id: string | null;
          partner_name: string | null;
          contract_paid_at: string | null;
          deal: { id: string; name: string; contact: { phone: string | null; email: string | null } | null } | null;
        }>;

        for (const att of attendeesArr) {
          // For aprovados filter, only include attendees with aprovado status
          if (filter === 'aprovados' && att.r2_status_id !== aprovadoStatusId) {
            continue;
          }

          attendees.push({
            id: att.id,
            attendee_name: att.attendee_name,
            attendee_phone: att.attendee_phone,
            status: att.status,
            r2_status_id: att.r2_status_id,
            r2_status_name: att.r2_status_id ? statusMap[att.r2_status_id] : null,
            carrinho_status: att.carrinho_status,
            carrinho_updated_at: att.carrinho_updated_at,
            deal_id: att.deal_id,
            meeting_id: meeting.id,
            meeting_status: meeting.status,
            scheduled_at: meeting.scheduled_at,
            closer_id: closerData?.id || null,
            closer_name: closerData?.name || null,
            closer_color: closerData?.color || null,
            deal_name: att.deal?.name || null,
            contact_phone: att.deal?.contact?.phone || null,
            contact_email: att.deal?.contact?.email || null,
            partner_name: att.partner_name,
            r1_date: att.deal_id ? r1Map.get(att.deal_id)?.date || null : null,
            r1_closer_name: att.deal_id ? r1Map.get(att.deal_id)?.closer_name || null : null,
            contract_paid_at: att.contract_paid_at,
          });
        }
      }

      // Para aprovados, deduplicar por deal_id (manter reunião mais recente)
      if (filter === 'aprovados') {
        const dealMap = new Map<string, R2CarrinhoAttendee>();
        
        for (const att of attendees) {
          const key = att.deal_id || att.id;
          const existing = dealMap.get(key);
          
          if (!existing) {
            dealMap.set(key, att);
          } else {
            const attPriority = att.meeting_status === 'completed' ? 2 : 
                                att.meeting_status === 'rescheduled' ? 1 : 0;
            const existingPriority = existing.meeting_status === 'completed' ? 2 :
                                     existing.meeting_status === 'rescheduled' ? 1 : 0;
            
            if (attPriority > existingPriority) {
              dealMap.set(key, att);
            } else if (attPriority === existingPriority) {
              if (new Date(att.scheduled_at) > new Date(existing.scheduled_at)) {
                dealMap.set(key, att);
              }
            }
          }
        }
        
        return Array.from(dealMap.values());
      }

      return attendees;
    },
  });
}

export function useUpdateCarrinhoStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      attendeeId, 
      status 
    }: { 
      attendeeId: string; 
      status: 'vai_comprar' | 'comprou' | 'nao_comprou' | 'negociando' | 'quer_desistir' | null;
    }) => {
      const { error } = await supabase
        .from('meeting_slot_attendees')
        .update({
          carrinho_status: status,
          carrinho_updated_at: new Date().toISOString(),
        })
        .eq('id', attendeeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['r2-carrinho-data'] });
      queryClient.invalidateQueries({ queryKey: ['r2-carrinho-kpis'] });
      toast.success('Status atualizado');
    },
    onError: () => {
      toast.error('Erro ao atualizar status');
    },
  });
}
