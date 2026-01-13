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

// Retorna horários únicos para um conjunto de dias da semana
export function useUniqueSlotsForDays(daysOfWeek: number[]) {
  return useQuery({
    queryKey: ['unique-slots-for-days', daysOfWeek],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('closer_meeting_links')
        .select('day_of_week, start_time, closer_id')
        .in('day_of_week', daysOfWeek)
        .order('start_time');

      if (error) throw error;
      
      // Agrupar por dia - normalize time to HH:mm format for consistent comparison
      const byDay: Record<number, { time: string; closerIds: string[] }[]> = {};
      
      for (const row of data || []) {
        if (!byDay[row.day_of_week]) {
          byDay[row.day_of_week] = [];
        }
        
        // Normalize start_time from HH:mm:ss to HH:mm
        const normalizedTime = row.start_time.slice(0, 5);
        
        const existing = byDay[row.day_of_week]?.find(s => s.time === normalizedTime);
        if (existing) {
          if (!existing.closerIds.includes(row.closer_id)) {
            existing.closerIds.push(row.closer_id);
          }
        } else {
          byDay[row.day_of_week].push({ time: normalizedTime, closerIds: [row.closer_id] });
        }
      }
      
      return byDay;
    },
    enabled: daysOfWeek.length > 0,
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
