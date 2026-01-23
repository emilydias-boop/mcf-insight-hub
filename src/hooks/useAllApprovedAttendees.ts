import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, subDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface ApprovedAttendeeWithWeek {
  id: string;
  attendee_name: string | null;
  contact_email: string | null;
  attendee_phone: string | null;
  scheduled_at: string | null;
  closer_name: string | null;
  closer_color: string | null;
  week_label: string;
}

export function useAllApprovedAttendees() {
  return useQuery({
    queryKey: ['all-approved-attendees'],
    queryFn: async (): Promise<ApprovedAttendeeWithWeek[]> => {
      const today = new Date();
      const startDate = startOfDay(subDays(today, 45));

      const { data, error } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          id,
          attendee_name,
          contact_email,
          attendee_phone,
          scheduled_at,
          meeting_slots!inner (
            closer_id,
            closers (
              name,
              color
            )
          )
        `)
        .eq('carrinho_status', 'aprovado')
        .gte('scheduled_at', startDate.toISOString())
        .order('scheduled_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((att: any) => {
        const scheduledDate = att.scheduled_at ? new Date(att.scheduled_at) : null;
        const weekLabel = scheduledDate 
          ? `Semana de ${format(scheduledDate, "dd/MM", { locale: ptBR })}`
          : 'Data desconhecida';

        return {
          id: att.id,
          attendee_name: att.attendee_name,
          contact_email: att.contact_email,
          attendee_phone: att.attendee_phone,
          scheduled_at: att.scheduled_at,
          closer_name: att.meeting_slots?.closers?.name || null,
          closer_color: att.meeting_slots?.closers?.color || null,
          week_label: weekLabel,
        };
      });
    },
    staleTime: 30000,
  });
}
