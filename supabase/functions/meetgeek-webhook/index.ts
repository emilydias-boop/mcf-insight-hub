// MeetGeek webhook: recebe o aviso de "análise concluída" e SÓ enfileira.
// Nada de processamento aqui — o MeetGeek reenvia 3x se não receber 200 rápido.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-mg-signature",
};

const EVENTO_SUCESSO = "File analyzed successfully";

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Corpo CRU lido uma única vez — a assinatura é sobre esses bytes exatos.
  const rawBody = await req.text();

  const secret = Deno.env.get("MEETGEEK_WEBHOOK_SECRET");

  // Falha FECHADO: sem segredo configurado o endpoint seria uma fila pública de escrita.
  if (!secret) {
    console.error("[meetgeek-webhook] MEETGEEK_WEBHOOK_SECRET ausente — recusando");
    return new Response(JSON.stringify({ error: "webhook nao configurado" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Normaliza o formato: alguns provedores mandam HEX maiúsculo ou prefixo "sha256=".
  const recebida = (req.headers.get("x-mg-signature") ?? "")
    .trim()
    .replace(/^sha256=/i, "")
    .toLowerCase();

  const esperada = await hmacHex(secret, rawBody);

  if (!recebida || !constantTimeEqual(esperada, recebida)) {
    // Loga o tamanho e o início do que veio para diagnosticar formato sem vazar a assinatura inteira.
    console.warn("[meetgeek-webhook] assinatura invalida", {
      recebida_len: recebida.length,
      recebida_inicio: recebida.slice(0, 8),
      esperada_inicio: esperada.slice(0, 8),
    });
    return new Response(JSON.stringify({ error: "assinatura invalida" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: { message?: string; meeting_id?: string } = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    console.error("[meetgeek-webhook] corpo nao e JSON valido", rawBody.slice(0, 200));
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  const meetingId = payload.meeting_id;
  const message = payload.message ?? "";

  // "File analyzed failed" vem sem meeting_id. E se um dia surgir outro evento
  // que carregue id, enfileirar cedo demais queimaria tentativas em 404.
  if (!meetingId || message !== EVENTO_SUCESSO) {
    console.log("[meetgeek-webhook] evento ignorado:", { message, temId: !!meetingId });
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Idempotente: webhooks de time disparam para vários membros com o mesmo
  // meeting_id, e ainda há as 2 retentativas. Vira ON CONFLICT DO NOTHING,
  // então uma reunião já ingerida não é rebaixada para 'pendente'.
  const { error } = await supabase
    .from("meeting_recordings")
    .upsert(
      { meetgeek_meeting_id: meetingId, ingest_status: "pendente" },
      { onConflict: "meetgeek_meeting_id", ignoreDuplicates: true },
    );

  if (error) {
    console.error("[meetgeek-webhook] falha ao enfileirar", meetingId, error.message);
    // Não-200 de propósito: aqui a retentativa do MeetGeek nos ajuda.
    // Corpo genérico — erro cru do Postgres não sai para fora.
    return new Response(JSON.stringify({ error: "falha temporaria" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("[meetgeek-webhook] enfileirado", meetingId);
  return new Response("ok", { status: 200, headers: corsHeaders });
});
