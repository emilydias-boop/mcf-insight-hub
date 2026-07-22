import { supabase } from '@/integrations/supabase/client';

/**
 * Dispara o webhook `consorcio-carta-cadastrada-webhook` (Make) para uma carta
 * que acabou de entrar em "Concluídas - Operacional".
 *
 * - Idempotente por padrão: verifica `webhook_carta_cadastrada_enviado_em` no
 *   cadastro pendente antes de enviar. Se `force=true`, ignora a flag.
 * - Fire-and-forget: nunca lança exceções para o chamador — apenas loga.
 * - Marca a flag após sucesso.
 */
export async function dispatchCartaCadastradaWebhook(params: {
  cardId?: string | null;
  registrationId?: string | null;
  proposalId?: string | null;
  force?: boolean;
}): Promise<{ sent: boolean; skipped?: boolean; error?: string }> {
  const { cardId = null, registrationId = null, proposalId = null, force = false } = params;
  try {
    let effectiveRegId = registrationId;

    // Resolve pending registration via card_id ou proposal_id se não fornecido
    if (!effectiveRegId && cardId) {
      const { data: reg } = await supabase
        .from('consorcio_pending_registrations')
        .select('id, webhook_carta_cadastrada_enviado_em')
        .eq('consortium_card_id', cardId)
        .maybeSingle();
      if (reg) {
        effectiveRegId = reg.id;
        if (!force && (reg as any).webhook_carta_cadastrada_enviado_em) {
          return { sent: false, skipped: true };
        }
      }
    }
    if (!effectiveRegId && proposalId) {
      const { data: reg } = await supabase
        .from('consorcio_pending_registrations')
        .select('id, webhook_carta_cadastrada_enviado_em')
        .eq('proposal_id', proposalId)
        .maybeSingle();
      if (reg) {
        effectiveRegId = reg.id;
        if (!force && (reg as any).webhook_carta_cadastrada_enviado_em) {
          return { sent: false, skipped: true };
        }
      }
    }
    if (effectiveRegId && !force) {
      const { data: reg } = await supabase
        .from('consorcio_pending_registrations')
        .select('webhook_carta_cadastrada_enviado_em')
        .eq('id', effectiveRegId)
        .maybeSingle();
      if ((reg as any)?.webhook_carta_cadastrada_enviado_em) {
        return { sent: false, skipped: true };
      }
    }

    const { data, error } = await supabase.functions.invoke(
      'consorcio-carta-cadastrada-webhook',
      {
        body: {
          card_id: cardId,
          registration_id: effectiveRegId,
          proposal_id: proposalId,
        },
      },
    );
    if (error) {
      console.warn('[carta-cadastrada-webhook] invoke error', error);
      return { sent: false, error: error.message };
    }
    const ok = (data as any)?.success !== false;
    if (ok && effectiveRegId) {
      await supabase
        .from('consorcio_pending_registrations')
        .update({ webhook_carta_cadastrada_enviado_em: new Date().toISOString() } as any)
        .eq('id', effectiveRegId);
    }
    return { sent: ok };
  } catch (e: any) {
    console.warn('[carta-cadastrada-webhook] unexpected error', e);
    return { sent: false, error: e?.message ?? String(e) };
  }
}