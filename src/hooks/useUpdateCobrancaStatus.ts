import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { CobrancaStatus } from './useConsorcioPagamentos';

export function useUpdateCobrancaStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      installmentId,
      status,
    }: {
      installmentId: string;
      status: CobrancaStatus | null;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('consortium_installments')
        .update({
          cobranca_status: status,
          cobranca_status_updated_at: status ? new Date().toISOString() : null,
          cobranca_status_updated_by: status ? userData.user?.id ?? null : null,
        } as any)
        .eq('id', installmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consorcio-pagamentos-all'] });
      toast.success('Situação de cobrança atualizada');
    },
    onError: (e: any) => {
      console.error(e);
      toast.error('Erro ao atualizar situação');
    },
  });
}