import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

export interface R1SupportDayRow {
  id: string;
  closer_id: string;
  support_date: string; // YYYY-MM-DD
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string | null;
}

export interface CreateR1SupportDayInput {
  closerId: string;
  date: Date;
  startTime?: string | null;
  endTime?: string | null;
  notes?: string | null;
}

/**
 * Lista todas as entradas de apoio R1 de um closer (ordem por data crescente).
 */
export function useR1SupportDaysForCloser(closerId: string | undefined) {
  return useQuery({
    queryKey: ['r1-support-days', closerId],
    queryFn: async (): Promise<R1SupportDayRow[]> => {
      if (!closerId) return [];
      const { data, error } = await supabase
        .from('closer_r1_support_days')
        .select('id, closer_id, support_date, start_time, end_time, notes, created_by, created_at')
        .eq('closer_id', closerId)
        .order('support_date', { ascending: true });

      if (error) throw error;
      return (data || []) as R1SupportDayRow[];
    },
    enabled: !!closerId,
  });
}

/**
 * Retorna apenas as datas (Date[]) com apoio R1 liberado dentro do mês informado,
 * para destacar no calendário.
 */
export function useR1SupportDaysWithSlots(closerId: string | undefined, month: Date | undefined) {
  return useQuery({
    queryKey: ['r1-support-days-month', closerId, month ? format(month, 'yyyy-MM') : null],
    queryFn: async (): Promise<Date[]> => {
      if (!closerId || !month) return [];

      const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
      const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);

      const { data, error } = await supabase
        .from('closer_r1_support_days')
        .select('support_date')
        .eq('closer_id', closerId)
        .gte('support_date', format(startOfMonth, 'yyyy-MM-dd'))
        .lte('support_date', format(endOfMonth, 'yyyy-MM-dd'));

      if (error) throw error;
      const unique = [...new Set((data || []).map((d: any) => d.support_date as string))];
      return unique.map((d) => new Date(d + 'T12:00:00'));
    },
    enabled: !!closerId && !!month,
  });
}

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>, closerId?: string) {
  queryClient.invalidateQueries({ queryKey: ['r1-support-days', closerId] });
  queryClient.invalidateQueries({ queryKey: ['r1-support-days-month', closerId] });
  // Atualiza imediatamente o gating de UI no app
  queryClient.invalidateQueries({ queryKey: ['r1-support-active'] });
}

export function useCreateR1SupportDay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateR1SupportDayInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;

      const payload = {
        closer_id: input.closerId,
        support_date: format(input.date, 'yyyy-MM-dd'),
        start_time: input.startTime ?? null,
        end_time: input.endTime ?? null,
        notes: input.notes ?? null,
        created_by: userId,
      };

      const { data, error } = await supabase
        .from('closer_r1_support_days')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return data as R1SupportDayRow;
    },
    onSuccess: (_data, variables) => {
      invalidateAll(queryClient, variables.closerId);
      toast.success('Apoio R1 liberado!');
    },
    onError: (error: any) => {
      if (error?.code === '23505') {
        toast.error('Esta data já está liberada para este closer');
      } else if (error?.code === '42501' || /row-level security/i.test(error?.message || '')) {
        toast.error('Sem permissão para liberar apoio para este closer');
      } else {
        toast.error(`Erro ao liberar apoio: ${error?.message ?? 'desconhecido'}`);
      }
    },
  });
}

export function useUpdateR1SupportDay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      closerId: _closerId,
      patch,
    }: {
      id: string;
      closerId: string;
      patch: { start_time?: string | null; end_time?: string | null; notes?: string | null };
    }) => {
      const { error } = await supabase
        .from('closer_r1_support_days')
        .update(patch)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_d, variables) => {
      invalidateAll(queryClient, variables.closerId);
      toast.success('Apoio R1 atualizado!');
    },
    onError: (error: any) => {
      toast.error(`Erro ao atualizar apoio: ${error?.message ?? 'desconhecido'}`);
    },
  });
}

export function useDeleteR1SupportDay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, closerId: _closerId }: { id: string; closerId: string }) => {
      const { error } = await supabase
        .from('closer_r1_support_days')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_d, variables) => {
      invalidateAll(queryClient, variables.closerId);
      toast.success('Apoio R1 removido!');
    },
    onError: (error: any) => {
      if (error?.code === '42501' || /row-level security/i.test(error?.message || '')) {
        toast.error('Sem permissão para remover apoio deste closer');
      } else {
        toast.error(`Erro ao remover apoio: ${error?.message ?? 'desconhecido'}`);
      }
    },
  });
}