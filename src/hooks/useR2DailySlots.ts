import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, getDay } from 'date-fns';

export interface R2DailySlot {
  id: string;
  closer_id: string;
  slot_date: string;
  start_time: string;
  google_meet_link: string | null;
  created_at: string | null;
  created_by: string | null;
}

// Fetch daily slots for a specific closer and date
export function useR2DailySlotsForDate(closerId: string | undefined, date: Date | undefined) {
  return useQuery({
    queryKey: ['r2-daily-slots', closerId, date ? format(date, 'yyyy-MM-dd') : null],
    queryFn: async () => {
      if (!closerId || !date) return [];

      const dateStr = format(date, 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('r2_daily_slots')
        .select('*')
        .eq('closer_id', closerId)
        .eq('slot_date', dateStr)
        .order('start_time');

      if (error) throw error;
      return data as R2DailySlot[];
    },
    enabled: !!closerId && !!date,
  });
}

// Fetch all dates that have slots configured for a closer in a given month
export function useR2DaysWithSlots(closerId: string | undefined, month: Date | undefined) {
  return useQuery({
    queryKey: ['r2-days-with-slots', closerId, month ? format(month, 'yyyy-MM') : null],
    queryFn: async () => {
      if (!closerId || !month) return [];

      const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
      const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);

      const { data, error } = await supabase
        .from('r2_daily_slots')
        .select('slot_date')
        .eq('closer_id', closerId)
        .gte('slot_date', format(startOfMonth, 'yyyy-MM-dd'))
        .lte('slot_date', format(endOfMonth, 'yyyy-MM-dd'));

      if (error) throw error;

      // Return unique dates
      const uniqueDates = [...new Set(data.map(d => d.slot_date))];
      return uniqueDates.map(d => new Date(d + 'T12:00:00'));
    },
    enabled: !!closerId && !!month,
  });
}

// Create a new daily slot
export function useCreateR2DailySlot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ closerId, date, startTime, googleMeetLink }: {
      closerId: string;
      date: Date;
      startTime: string;
      googleMeetLink?: string;
    }) => {
      const dateStr = format(date, 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('r2_daily_slots')
        .insert({
          closer_id: closerId,
          slot_date: dateStr,
          start_time: startTime,
          google_meet_link: googleMeetLink || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      const dateStr = format(variables.date, 'yyyy-MM-dd');
      queryClient.invalidateQueries({ queryKey: ['r2-daily-slots', variables.closerId, dateStr] });
      queryClient.invalidateQueries({ queryKey: ['r2-days-with-slots', variables.closerId] });
      queryClient.invalidateQueries({ queryKey: ['r2-closer-slots'] });
      toast.success('Horário adicionado!');
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('Este horário já existe para esta data');
      } else {
        toast.error(`Erro ao adicionar horário: ${error.message}`);
      }
    },
  });
}

// Delete a daily slot
export function useDeleteR2DailySlot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (slotId: string) => {
      const { error } = await supabase
        .from('r2_daily_slots')
        .delete()
        .eq('id', slotId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['r2-daily-slots'] });
      queryClient.invalidateQueries({ queryKey: ['r2-days-with-slots'] });
      queryClient.invalidateQueries({ queryKey: ['r2-closer-slots'] });
      toast.success('Horário removido!');
    },
    onError: (error: any) => {
      toast.error(`Erro ao remover horário: ${error.message}`);
    },
  });
}

// Update a daily slot's meet link
export function useUpdateR2DailySlot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ slotId, googleMeetLink }: { slotId: string; googleMeetLink: string }) => {
      const { error } = await supabase
        .from('r2_daily_slots')
        .update({ google_meet_link: googleMeetLink })
        .eq('id', slotId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['r2-daily-slots'] });
      queryClient.invalidateQueries({ queryKey: ['r2-closer-slots'] });
      toast.success('Link atualizado!');
    },
    onError: (error: any) => {
      toast.error(`Erro ao atualizar link: ${error.message}`);
    },
  });
}

// Copy weekday slots to a specific date
export function useCopyWeekdaySlotsToDate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ closerId, date }: { closerId: string; date: Date }) => {
      const dayOfWeek = getDay(date);
      const dateStr = format(date, 'yyyy-MM-dd');

      // 1. Get weekday slots from closer_meeting_links
      const { data: weekdaySlots, error: fetchError } = await supabase
        .from('closer_meeting_links')
        .select('start_time, google_meet_link')
        .eq('closer_id', closerId)
        .eq('day_of_week', dayOfWeek)
        .order('start_time');

      if (fetchError) throw fetchError;

      if (!weekdaySlots || weekdaySlots.length === 0) {
        throw new Error('Nenhum horário fixo configurado para este dia da semana');
      }

      // 2. Delete existing daily slots for this date
      const { error: deleteError } = await supabase
        .from('r2_daily_slots')
        .delete()
        .eq('closer_id', closerId)
        .eq('slot_date', dateStr);

      if (deleteError) throw deleteError;

      // 3. Insert new daily slots
      const slotsToInsert = weekdaySlots.map(slot => ({
        closer_id: closerId,
        slot_date: dateStr,
        start_time: slot.start_time,
        google_meet_link: slot.google_meet_link,
      }));

      const { error: insertError } = await supabase
        .from('r2_daily_slots')
        .insert(slotsToInsert);

      if (insertError) throw insertError;

      return slotsToInsert.length;
    },
    onSuccess: (count, variables) => {
      const dateStr = format(variables.date, 'yyyy-MM-dd');
      queryClient.invalidateQueries({ queryKey: ['r2-daily-slots', variables.closerId, dateStr] });
      queryClient.invalidateQueries({ queryKey: ['r2-days-with-slots', variables.closerId] });
      queryClient.invalidateQueries({ queryKey: ['r2-closer-slots'] });
      toast.success(`${count} horários copiados!`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao copiar horários');
    },
  });
}

// Clear all daily slots for a specific date
export function useClearR2DailySlotsForDate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ closerId, date }: { closerId: string; date: Date }) => {
      const dateStr = format(date, 'yyyy-MM-dd');

      const { error } = await supabase
        .from('r2_daily_slots')
        .delete()
        .eq('closer_id', closerId)
        .eq('slot_date', dateStr);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      const dateStr = format(variables.date, 'yyyy-MM-dd');
      queryClient.invalidateQueries({ queryKey: ['r2-daily-slots', variables.closerId, dateStr] });
      queryClient.invalidateQueries({ queryKey: ['r2-days-with-slots', variables.closerId] });
      queryClient.invalidateQueries({ queryKey: ['r2-closer-slots'] });
      toast.success('Horários limpos!');
    },
    onError: (error: any) => {
      toast.error(`Erro ao limpar horários: ${error.message}`);
    },
  });
}
