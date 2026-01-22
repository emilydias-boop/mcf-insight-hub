import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UpdateAttendeeData {
  attendeeId: string;
  updates: {
    status?: string;
    partner_name?: string | null;
    lead_profile?: string | null;
    video_status?: string | null;
    r2_status_id?: string | null;
    thermometer_ids?: string[];
    r2_confirmation?: string | null;
    r2_observations?: string | null;
    meeting_link?: string | null;
    is_decision_maker?: boolean | null;
    decision_maker_type?: string | null;
  };
}

export function useUpdateR2Attendee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ attendeeId, updates }: UpdateAttendeeData) => {
      const { error } = await supabase
        .from('meeting_slot_attendees')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', attendeeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['r2-agenda-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['r2-meetings-extended'] });
      toast.success('Atualizado');
    },
    onError: () => {
      toast.error('Erro ao atualizar');
    }
  });
}

// Batch update for multiple attendees
export function useBatchUpdateR2Attendees() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: UpdateAttendeeData[]) => {
      for (const update of updates) {
        const { error } = await supabase
          .from('meeting_slot_attendees')
          .update({
            ...update.updates,
            updated_at: new Date().toISOString(),
          })
          .eq('id', update.attendeeId);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['r2-agenda-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['r2-meetings-extended'] });
      toast.success('Atualizações salvas');
    },
    onError: () => {
      toast.error('Erro ao salvar atualizações');
    }
  });
}

// Quick status update
export function useQuickUpdateAttendeeStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ attendeeId, status }: { attendeeId: string; status: string }) => {
      const { error } = await supabase
        .from('meeting_slot_attendees')
        .update({ 
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', attendeeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['r2-agenda-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['r2-meetings-extended'] });
    },
    onError: () => {
      toast.error('Erro ao atualizar status');
    }
  });
}

// Remove attendee from meeting slot
export function useRemoveR2Attendee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (attendeeId: string) => {
      const { error } = await supabase
        .from('meeting_slot_attendees')
        .delete()
        .eq('id', attendeeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['r2-agenda-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['r2-meetings-extended'] });
      toast.success('Participante removido');
    },
    onError: () => {
      toast.error('Erro ao remover participante');
    }
  });
}
