import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Hook for coordinators+ to update the booking date of an attendee
export function useUpdateBookedAt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ attendeeId, bookedAt }: { attendeeId: string; bookedAt: Date }) => {
      const { error } = await supabase
        .from('meeting_slot_attendees')
        .update({ 
          booked_at: bookedAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', attendeeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['r2-agenda-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['sdr-meetings-from-agenda'] });
      queryClient.invalidateQueries({ queryKey: ['sdr-metrics-from-agenda'] });
      toast.success('Data de agendamento atualizada');
    },
    onError: () => {
      toast.error('Erro ao atualizar data de agendamento');
    },
  });
}
