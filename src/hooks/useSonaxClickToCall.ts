import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useDialerEngine } from '@/hooks/useDialerEngine';

interface ClickToCallInput {
  numero: string;
  dealId?: string;
  origin?: 'manual' | 'auto_dialer';
  attempt?: number;
}

/**
 * Normaliza para dígitos DDD+número (sem +55 / sem 0 na frente),
 * formato exigido pelo widget de webfone Sonax.
 */
export function toSonaxWidgetDigits(raw: string): string | null {
  let digits = (raw || '').replace(/\D/g, '');
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    digits = digits.slice(2);
  }
  if (digits.startsWith('0')) digits = digits.replace(/^0+/, '');
  return digits.length >= 10 && digits.length <= 11 ? digits : null;
}

/**
 * Click-to-call via Sonax PABX Virtual.
 *
 * - engine 'sonax': origina direto no widget de webfone (evento `sonax:makeCall`),
 *   sem tocar primeiro no ramal, e grava a atividade via `log_only`.
 * - engine 'twilio' (default): comportamento original inalterado (sonax-click2call.php).
 */
export function useSonaxClickToCall() {
  const { data: dialer } = useDialerEngine();

  return useMutation({
    mutationFn: async ({ numero, dealId, origin = 'manual', attempt }: ClickToCallInput) => {
      if (dialer?.engine === 'sonax') {
        const digits = toSonaxWidgetDigits(numero);
        if (!digits) throw new Error('numero_invalido');

        window.dispatchEvent(new CustomEvent('sonax:makeCall', { detail: { numero: digits } }));

        // Registro de atividade sem disparar a chamada novamente.
        const { data: logData } = await supabase.functions.invoke('sonax-click-to-call', {
          body: { log_only: true, numero: digits, deal_id: dealId, origin, attempt },
        });

        return {
          success: true,
          ramal: dialer.ramal ?? 'webfone',
          numero: digits,
          activity_id: (logData as any)?.activity_id ?? null,
          via_widget: true,
        };
      }

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
      return data as {
        success: boolean;
        ramal: string;
        numero: string;
        activity_id: string | null;
        via_widget?: boolean;
      };
    },
    onSuccess: (data) => {
      toast.success(
        data.via_widget
          ? `Ligando para ${data.numero} pelo webfone`
          : `Ligação iniciada no ramal ${data.ramal}`,
      );
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
