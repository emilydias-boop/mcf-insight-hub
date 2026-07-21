import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAKE_WEBHOOK_URL = "https://hook.us1.make.com/pk492b4dfi83s1u4k566i98mg34k8xto";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { card_id, registration_id, proposal_id } = body ?? {};
    if (!card_id) {
      return new Response(JSON.stringify({ error: "card_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Se registration_id não veio, tenta resolver pelo card_id
    let resolvedRegId: string | null = registration_id ?? null;
    if (!resolvedRegId) {
      const { data: regByCard } = await supabase
        .from("consorcio_pending_registrations")
        .select("id")
        .eq("consortium_card_id", card_id)
        .maybeSingle();
      resolvedRegId = regByCard?.id ?? null;
    }

    const [cardRes, regRes, propRes] = await Promise.all([
      supabase.from("consortium_cards").select("*").eq("id", card_id).maybeSingle(),
      resolvedRegId
        ? supabase.from("consorcio_pending_registrations").select("*").eq("id", resolvedRegId).maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),
      proposal_id
        ? supabase.from("consorcio_proposals").select("*").eq("id", proposal_id).maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),
    ]);

    const card = cardRes.data ?? {};
    const reg = regRes.data ?? {};
    const proposal = propRes.data ?? null;

    const payload = {
      event: "consorcio.carta.cadastrada",
      occurred_at: new Date().toISOString(),
      lead: {
        nome_completo: reg.nome_completo ?? card.nome_completo ?? null,
        email: reg.email ?? card.email ?? null,
        telefone: reg.telefone ?? card.telefone ?? null,
        cpf: reg.cpf ?? card.cpf ?? null,
        tipo_pessoa: reg.tipo_pessoa ?? card.tipo_pessoa ?? null,
        razao_social: reg.razao_social ?? card.razao_social ?? null,
        cnpj: reg.cnpj ?? card.cnpj ?? null,
      },
      carta: {
        card_id: card.id,
        valor_credito: card.valor_credito ?? null,
        tipo_produto: card.tipo_produto ?? null,
        produto_codigo: card.produto_embracon ?? null,
        categoria: card.categoria ?? null,
        grupo: card.grupo ?? null,
        cota: card.cota ?? null,
        prazo_meses: card.prazo_meses ?? null,
        data_contratacao: card.data_contratacao ?? null,
        dia_vencimento: card.dia_vencimento ?? null,
        condicao_pagamento: card.condicao_pagamento ?? null,
        inclui_seguro: card.inclui_seguro_vida ?? null,
        vendedor_name: card.vendedor_name ?? null,
        origem: card.origem ?? null,
        origem_detalhe: card.origem_detalhe ?? null,
        e_transferencia: card.e_transferencia ?? null,
        valor_comissao: card.valor_comissao ?? null,
        observacoes: card.observacoes ?? null,
      },
      proposta: proposal,
      registration: {
        id: reg.id,
        status: reg.status,
      },
    };

    const resp = await fetch(MAKE_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    const respText = await resp.text();
    console.log("[carta-cadastrada-webhook] status", resp.status, respText.slice(0, 500));

    return new Response(JSON.stringify({ success: resp.ok, status: resp.status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    console.error("[carta-cadastrada-webhook] error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});