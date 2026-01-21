import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCustomWeekStart, getCustomWeekEnd } from '@/lib/dateHelpers';
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
  partner_name: string | null;
}

export function useR2CarrinhoData(weekDate: Date, filter?: 'agendadas' | 'no_show' | 'realizadas' | 'aprovados') {
  const weekStart = getCustomWeekStart(weekDate);
  const weekEnd = getCustomWeekEnd(weekDate);

  return useQuery({
    queryKey: ['r2-carrinho-data', format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd'), filter],
    queryFn: async (): Promise<R2CarrinhoAttendee[]> => {
      // Get R2 status options
      const { data: statusOptions } = await supabase
        .from('r2_status_options')
        .select('id, name')
        .eq('is_active', true);

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
            deal:crm_deals(
              id,
              name,
              contact:crm_contacts(
                phone
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
        query = query.in('status', ['scheduled', 'invited', 'pending']);
      } else if (filter === 'no_show') {
        query = query.eq('status', 'no_show');
      } else if (filter === 'realizadas' || filter === 'aprovados') {
        query = query.eq('status', 'completed');
      }

      const { data: meetings, error } = await query;

      if (error) throw error;

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
          deal: { id: string; name: string; contact: { phone: string | null } | null } | null;
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
            partner_name: att.partner_name,
          });
        }
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
      status: 'vai_comprar' | 'comprou' | 'nao_comprou' | null;
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
