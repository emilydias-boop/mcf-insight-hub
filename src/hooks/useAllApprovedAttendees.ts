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

      // 1. Buscar o ID do status "Aprovado"
      const { data: statusOptions } = await supabase
        .from('r2_status_options')
        .select('id, name')
        .eq('is_active', true);

      const aprovadoStatusId = statusOptions?.find(s => 
        s.name.toLowerCase().includes('aprovado')
      )?.id;

      if (!aprovadoStatusId) return [];

      // 2. Buscar meetings com attendees aprovados
      const { data: meetings, error } = await supabase
        .from('meeting_slots')
        .select(`
          id,
          scheduled_at,
          closer:closers!meeting_slots_closer_id_fkey(
            name,
            color
          ),
          attendees:meeting_slot_attendees(
            id,
            attendee_name,
            contact_email,
            attendee_phone,
            r2_status_id
          )
        `)
        .eq('meeting_type', 'r2')
        .gte('scheduled_at', startDate.toISOString())
        .not('status', 'in', '(cancelled,rescheduled)')
        .order('scheduled_at', { ascending: false });

      if (error) throw error;

      // 3. Filtrar e formatar attendees aprovados
      const result: ApprovedAttendeeWithWeek[] = [];
      
      for (const meeting of meetings || []) {
        for (const att of (meeting.attendees as any[]) || []) {
          if (att.r2_status_id !== aprovadoStatusId) continue;
          
          const scheduledDate = meeting.scheduled_at ? new Date(meeting.scheduled_at) : null;
          const weekLabel = scheduledDate 
            ? `Semana de ${format(scheduledDate, "dd/MM", { locale: ptBR })}`
            : 'Data desconhecida';

          result.push({
            id: att.id,
            attendee_name: att.attendee_name,
            contact_email: att.contact_email,
            attendee_phone: att.attendee_phone,
            scheduled_at: meeting.scheduled_at,
            closer_name: (meeting.closer as any)?.name || null,
            closer_color: (meeting.closer as any)?.color || null,
            week_label: weekLabel,
          });
        }
      }

      return result;
    },
    staleTime: 30000,
  });
}
