import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type TipoAcao = 'boleto_enviado' | 'lead_respondeu' | 'sem_retorno' | 'pago_confirmado';

interface RegistrarAcaoParams {
  installment_id?: string;
  billing_installment_id?: string;
  subscription_id?: string;
  tipo_acao: TipoAcao;
  observacao?: string;
}

const ACAO_LABELS: Record<TipoAcao, string> = {
  boleto_enviado: 'Boleto Enviado',
  lead_respondeu: 'Lead Respondeu',
  sem_retorno: 'Sem Retorno',
  pago_confirmado: 'Pago Confirmado',
};

export function useRegistrarAcaoCobranca() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: RegistrarAcaoParams) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('cobranca_acoes')
        .insert({
          installment_id: params.installment_id || null,
          billing_installment_id: params.billing_installment_id || null,
          subscription_id: params.subscription_id || null,
          tipo_acao: params.tipo_acao,
          observacao: params.observacao || null,
          created_by: user?.id || null,
        });

      if (error) throw error;
    },
    onSuccess: (_, params) => {
      toast.success(`Ação "${ACAO_LABELS[params.tipo_acao]}" registrada`);
      queryClient.invalidateQueries({ queryKey: ['consorcio-cobranca-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['billing-cobranca-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['cobranca-history'] });
    },
    onError: (err: any) => {
      toast.error('Erro ao registrar ação: ' + err.message);
    },
  });
}
