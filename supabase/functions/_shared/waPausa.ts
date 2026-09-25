// Helper de pausa do WhatsApp: todas as funções que chamam a Twilio para mandar
// WhatsApp precisam respeitar a chave de pausa (RPC public.wa_envio_status).
// Falha aberta: se o banco engasgar, NÃO bloqueamos o envio — só logamos.

import { createClient } from 'npm:@supabase/supabase-js@2';

export interface WaPausaStatus {
  pausado: boolean;
  motivo: string | null;
}

/**
 * Consulta public.wa_envio_status() e decide se o envio de WhatsApp está
 * pausado. Em caso de erro de leitura, retorna { pausado: false, motivo: null }
 * (fail-open) para não travar o atendimento por um soluço do banco.
 */
export async function checarPausaWhatsApp(): Promise<WaPausaStatus> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    console.warn('[WA-PAUSA] variáveis de ambiente ausentes; envio segue (fail-open)');
    return { pausado: false, motivo: null };
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data, error } = await admin.rpc('wa_envio_status');

  if (error) {
    console.warn('[WA-PAUSA] erro ao ler wa_envio_status; envio segue (fail-open):', error.message);
    return { pausado: false, motivo: null };
  }

  const status = (data ?? {}) as {
    liberado?: boolean;
    pausado?: boolean;
    motivo?: string | null;
    desde?: string | null;
    por_nome?: string | null;
  };

  if (status.pausado === true) {
    return { pausado: true, motivo: status.motivo ?? null };
  }

  return { pausado: false, motivo: null };
}

/**
 * Resposta 503 padronizada para quando o WhatsApp está pausado.
 */
export function respostaWhatsAppPausado(
  corsHeaders: Record<string, string>,
  motivo: string | null,
): Response {
  return new Response(
    JSON.stringify({
      success: false,
      paused: true,
      error: 'WhatsApp pausado: ' + (motivo ?? 'envio suspenso'),
    }),
    {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
}
