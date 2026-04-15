import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

export function useEncaixarNoCarrinho() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      attendeeId,
      weekStart,
    }: {
      attendeeId: string;
      weekStart: Date;
    }) => {
      // Buscar status "Aprovado"
      const { data: statusOptions } = await supabase
        .from('r2_status_options')
        .select('id, name')
        .eq('is_active', true);

      const aprovadoId = statusOptions?.find(s =>
        s.name.toLowerCase().includes('aprovado')
      )?.id;

      // Get contact_id of this attendee to clear old overrides
      const { data: currentAtt } = await supabase
        .from('meeting_slot_attendees')
        .select('contact_id, deal_id')
        .eq('id', attendeeId)
        .single();

      // Clear any previous carrinho_week_start for other attendees of the same contact
      if (currentAtt?.contact_id) {
        const clearQuery = supabase
          .from('meeting_slot_attendees')
          .update({ carrinho_week_start: null } as any)
          .eq('contact_id', currentAtt.contact_id)
          .neq('id', attendeeId);
        (clearQuery as any).not('carrinho_week_start', 'is', null);
        await clearQuery;
      }

      const weekStartStr = format(weekStart, 'yyyy-MM-dd');
      const updatePayload: any = { carrinho_week_start: weekStartStr };
      if (aprovadoId) {
        updatePayload.r2_status_id = aprovadoId;
      }

      const { error } = await supabase
        .from('meeting_slot_attendees')
        .update(updatePayload)
        .eq('id', attendeeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['r2-carrinho-data'] });
      queryClient.invalidateQueries({ queryKey: ['r2-carrinho-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['r2-accumulated-leads'] });
      toast.success('Lead encaixado no carrinho da semana!');
    },
    onError: () => {
      toast.error('Erro ao encaixar lead no carrinho');
    },
  });
}
