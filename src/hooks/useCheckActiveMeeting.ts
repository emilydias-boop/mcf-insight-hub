import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { addDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const COOLDOWN_DAYS = 30;

export interface ActiveMeetingCheck {
  blocked: boolean;
  blockType: 'active' | 'cooldown' | null;
  reason: string;
  activeMeetingDate?: Date;
  unblockDate?: Date;
  closerName?: string;
}

export function useCheckActiveMeeting(dealId: string | undefined) {
  return useQuery({
    queryKey: ['check-active-meeting', dealId],
    queryFn: async (): Promise<ActiveMeetingCheck> => {
      if (!dealId) return { blocked: false, blockType: null, reason: '' };

      // 1. Check for active meetings (invited/scheduled in scheduled/rescheduled slots)
      const { data: activeAttendees, error: activeError } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          id, status,
          meeting_slot:meeting_slots!inner(
            id, scheduled_at, status,
            closer:closers!meeting_slots_closer_id_fkey(name)
          )
        `)
        .eq('deal_id', dealId)
        .in('status', ['invited', 'scheduled'])
        .in('meeting_slot.status', ['scheduled', 'rescheduled'])
        .limit(1);

      if (activeError) {
        console.error('Error checking active meetings:', activeError);
        return { blocked: false, blockType: null, reason: '' };
      }

      if (activeAttendees && activeAttendees.length > 0) {
        const slot = (activeAttendees[0] as any).meeting_slot;
        const meetingDate = new Date(slot.scheduled_at);
        const closerName = slot.closer?.name || 'N/A';
        const formattedDate = format(meetingDate, "dd/MM 'às' HH:mm", { locale: ptBR });

        return {
          blocked: true,
          blockType: 'active',
          reason: `Este lead já possui reunião agendada para ${formattedDate} com ${closerName}. Finalize (Realizada/No-Show) antes de reagendar.`,
          activeMeetingDate: meetingDate,
          closerName,
        };
      }

      // 2. Check for completed meetings within cooldown period
      const cooldownStart = addDays(new Date(), -COOLDOWN_DAYS);

      const { data: recentCompleted, error: completedError } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          id, status,
          meeting_slot:meeting_slots!inner(
            id, scheduled_at, status,
            closer:closers!meeting_slots_closer_id_fkey(name)
          )
        `)
        .eq('deal_id', dealId)
        .eq('status', 'completed')
        .gte('meeting_slot.scheduled_at', cooldownStart.toISOString())
        .order('meeting_slot(scheduled_at)', { ascending: false })
        .limit(1);

      if (completedError) {
        console.error('Error checking completed meetings:', completedError);
        return { blocked: false, blockType: null, reason: '' };
      }

      if (recentCompleted && recentCompleted.length > 0) {
        const slot = (recentCompleted[0] as any).meeting_slot;
        const meetingDate = new Date(slot.scheduled_at);
        const unblockDate = addDays(meetingDate, COOLDOWN_DAYS);
        const closerName = slot.closer?.name || 'N/A';
        const formattedMeetingDate = format(meetingDate, 'dd/MM', { locale: ptBR });
        const formattedUnblockDate = format(unblockDate, 'dd/MM', { locale: ptBR });

        return {
          blocked: true,
          blockType: 'cooldown',
          reason: `Este lead teve reunião realizada em ${formattedMeetingDate}. Novo agendamento liberado a partir de ${formattedUnblockDate}.`,
          activeMeetingDate: meetingDate,
          unblockDate,
          closerName,
        };
      }

      return { blocked: false, blockType: null, reason: '' };
    },
    enabled: !!dealId,
    staleTime: 10000,
  });
}
