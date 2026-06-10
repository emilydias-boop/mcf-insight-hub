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
    onMutate: async ({ installmentId, status }) => {
      await qc.cancelQueries({ queryKey: ['consorcio-pagamentos-all'] });
      const snapshots: Array<[readonly unknown[], unknown]> = [];
      const nowIso = new Date().toISOString();
      qc.getQueriesData({ queryKey: ['consorcio-pagamentos-all'] }).forEach(([key, value]) => {
        snapshots.push([key, value]);
        if (!Array.isArray(value)) return;
        const next = (value as any[]).map((r: any) =>
          r.id === installmentId
            ? { ...r, cobranca_status: status, cobranca_status_updated_at: status ? nowIso : null }
            : r,
        );
        qc.setQueryData(key, next);
      });
      return { snapshots };
    },
    onError: (e: any, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, value]) => qc.setQueryData(key, value));
      console.error(e);
      toast.error('Erro ao atualizar situação');
    },
    onSuccess: () => {
      toast.success('Situação atualizada', { duration: 1500 });
    },
    onSettled: () => {
      // Refresh silently in background — não exibe skeleton porque temos placeholderData/keepPreviousData
      qc.invalidateQueries({ queryKey: ['consorcio-pagamentos-all'], refetchType: 'active' });
    },
  });
}