import { supabase } from '@/integrations/supabase/client';

/**
 * Dispara o convite (Google Agenda do gerente) da reunião de viabilidade do Pós-venda.
 * Fire-and-forget: nunca lança erro nem mostra toast — falhas só vão ao console.
 */
export function syncConvitePosVenda(
  action: 'create' | 'cancel',
  reuniaoId: string | null | undefined,
): void {
  if (!reuniaoId) return;

  void supabase.functions
    .invoke('pos-venda-calendar-sync', {
      body: { action, reuniao_id: reuniaoId },
    })
    .then(({ data, error }) => {
      if (error) {
        console.warn('[pos-venda-convite]', error);
        return;
      }
      if (data?.success === false) {
        console.warn('[pos-venda-convite]', data);
      }
    })
    .catch((err) => {
      console.warn('[pos-venda-convite]', err);
    });
}
