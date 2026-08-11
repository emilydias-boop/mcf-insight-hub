import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ClickToCallInput {
  numero: string;
  dealId?: string;
  origin?: 'manual' | 'auto_dialer';
  attempt?: number;
}

/**
 * Click-to-call via Sonax PABX Virtual.
 * Requer que o e-mail do usuário logado tenha ramal ativo em sdr_ramal_mapping.
 */
export function useSonaxClickToCall() {
  return useMutation({
    mutationFn: async ({ numero, dealId, origin = 'manual', attempt }: ClickToCallInput) => {
      const { data, error } = await supabase.functions.invoke('sonax-click-to-call', {
        body: { numero, deal_id: dealId, origin, attempt },
      });

      if (error) {
        // Tenta extrair o corpo de erro da function (status !== 2xx)
        let code = '';
        try {
          const ctx = (error as any).context;
          if (ctx && typeof ctx.json === 'function') {
            const body = await ctx.json();
            code = body?.error || '';
          }
        } catch { /* ignore */ }
        throw new Error(code || error.message || 'erro_desconhecido');
      }

      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { success: boolean; ramal: string; numero: string; activity_id: string | null };
    },
    onSuccess: (data) => {
      toast.success(`Ligação iniciada no ramal ${data.ramal}`);
    },
    onError: (err: Error) => {
      if (err.message === 'ramal_nao_configurado') {
        toast.error('Seu ramal ainda não está configurado, fale com o gestor');
      } else if (err.message === 'numero_invalido') {
        toast.error('Telefone do lead inválido ou ausente');
      } else {
        toast.error('Não foi possível iniciar a ligação. Tente novamente.');
      }
    },
  });
}
