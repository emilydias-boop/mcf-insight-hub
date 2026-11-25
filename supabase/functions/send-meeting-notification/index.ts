// Envio de WhatsApp pela Z-API (WhatsApp não oficial) desativado em 25/11/2026.
// A integração não enviava nenhuma mensagem há mais de 120 dias, então todo o
// código de envio foi removido. A função continua no ar apenas por
// compatibilidade com chamadas antigas: aceita o mesmo POST
// ({ meetingSlotId, resendAttendeeId }), não lê o banco, não envia mensagem
// alguma, não atualiza notified_at e sempre devolve o corpo "desativado".
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESPOSTA_DESATIVADA = {
  success: true,
  desativado: true,
  motivo: "Envio de WhatsApp pela Z-API removido em 25/11/2026",
  summary: { total: 0, sent: 0, failed: 0 },
  results: [],
};

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // O corpo é lido e descartado só para manter o contrato antigo da chamada.
  await req.json().catch(() => null);

  return new Response(JSON.stringify(RESPOSTA_DESATIVADA), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
