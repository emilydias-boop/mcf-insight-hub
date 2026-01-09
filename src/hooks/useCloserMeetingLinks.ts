import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CloserMeetingLink {
  id: string;
  closer_id: string;
  day_of_week: number;
  start_time: string;
  google_meet_link: string;
  created_at: string | null;
}

interface CreateLinkParams {
  closer_id: string;
  day_of_week: number;
  start_time: string;
  google_meet_link: string;
}

interface UpdateLinkParams {
  id: string;
  google_meet_link: string;
}

export function useCloserMeetingLinksList(closerId?: string, dayOfWeek?: number) {
  return useQuery({
    queryKey: ['closer-meeting-links', closerId, dayOfWeek],
    queryFn: async () => {
      let query = supabase
        .from('closer_meeting_links')
        .select('*')
        .order('start_time');

      if (closerId) {
        query = query.eq('closer_id', closerId);
      }
      if (dayOfWeek !== undefined) {
        query = query.eq('day_of_week', dayOfWeek);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CloserMeetingLink[];
    },
    enabled: !!closerId,
  });
}

export function useCloserDaySlots(dayOfWeek: number) {
  return useQuery({
    queryKey: ['closer-day-slots', dayOfWeek],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('closer_meeting_links')
        .select('closer_id, start_time')
        .eq('day_of_week', dayOfWeek)
        .order('start_time');

      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreateCloserMeetingLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateLinkParams) => {
      const { data, error } = await supabase
        .from('closer_meeting_links')
        .insert(params)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['closer-meeting-links'] });
      queryClient.invalidateQueries({ queryKey: ['closer-day-slots'] });
      toast.success('Link adicionado com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Error creating meeting link:', error);
      toast.error('Erro ao adicionar link: ' + error.message);
    },
  });
}

export function useUpdateCloserMeetingLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, google_meet_link }: UpdateLinkParams) => {
      const { data, error } = await supabase
        .from('closer_meeting_links')
        .update({ google_meet_link })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['closer-meeting-links'] });
      queryClient.invalidateQueries({ queryKey: ['closer-day-slots'] });
      toast.success('Link atualizado com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Error updating meeting link:', error);
      toast.error('Erro ao atualizar link: ' + error.message);
    },
  });
}

export function useDeleteCloserMeetingLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('closer_meeting_links')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['closer-meeting-links'] });
      queryClient.invalidateQueries({ queryKey: ['closer-day-slots'] });
      toast.success('Link removido com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Error deleting meeting link:', error);
      toast.error('Erro ao remover link: ' + error.message);
    },
  });
}
