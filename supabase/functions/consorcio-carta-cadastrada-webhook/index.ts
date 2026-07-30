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
    if (!card_id && !registration_id && !proposal_id) {
      return new Response(JSON.stringify({ error: "card_id, registration_id or proposal_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolver registration_id via card_id ou proposal_id se não vier
    let resolvedRegId: string | null = registration_id ?? null;
    if (!resolvedRegId && card_id) {
      const { data: regByCard } = await supabase
        .from("consorcio_pending_registrations")
        .select("id")
        .eq("consortium_card_id", card_id)
        .maybeSingle();
      resolvedRegId = regByCard?.id ?? null;
    }
    if (!resolvedRegId && proposal_id) {
      const { data: regByProp } = await supabase
        .from("consorcio_pending_registrations")
        .select("id")
        .eq("proposal_id", proposal_id)
        .maybeSingle();
      resolvedRegId = regByProp?.id ?? null;
    }

    // Resolver proposal_id via registration se não veio
    let resolvedPropId: string | null = proposal_id ?? null;
    if (!resolvedPropId && resolvedRegId) {
      const { data: propByReg } = await supabase
        .from("consorcio_pending_registrations")
        .select("proposal_id")
        .eq("id", resolvedRegId)
        .maybeSingle();
      resolvedPropId = (propByReg as any)?.proposal_id ?? null;
    }

    const [cardRes, regRes, propRes] = await Promise.all([
      card_id
        ? supabase.from("consortium_cards").select("*").eq("id", card_id).maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),
      resolvedRegId
        ? supabase.from("consorcio_pending_registrations").select("*").eq("id", resolvedRegId).maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),
      resolvedPropId
        ? supabase.from("consorcio_proposals").select("*").eq("id", resolvedPropId).maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),
    ]);

    const card = cardRes.data ?? {};
    const reg = regRes.data ?? {};
    const proposal = propRes.data ?? null;

    // Hierarquia de dados: registration (cadastro feito pelo Closer) → proposal → card
    const pick = (...vals: any[]) => {
      for (const v of vals) {
        if (v !== undefined && v !== null && v !== "") return v;
      }
      return null;
    };

    const titular = pick(reg.nome_completo, reg.razao_social, card.nome_completo, card.razao_social);
    const contato = pick(reg.email, reg.email_comercial, reg.telefone, reg.telefone_comercial, card.email, card.telefone);
    const valorCredito = pick(reg.valor_credito, proposal?.valor_credito, card.valor_credito);

    // Guarda: não enviar payload incompleto (evita eventos "vazios" no Make)
    if (!titular || !contato || !valorCredito) {
      const reason = !titular ? "titular ausente" : !contato ? "contato ausente" : "valor_credito ausente";
      console.log("[carta-cadastrada-webhook] skipped:", reason, { registration_id: resolvedRegId, card_id: card_id ?? null });
      return new Response(JSON.stringify({ success: false, skipped: true, reason }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const payload = {
      event: "consorcio.carta.cadastrada",
      occurred_at: new Date().toISOString(),
      lead: {
        nome_completo: pick(reg.nome_completo, card.nome_completo),
        email: pick(reg.email, reg.email_comercial, card.email),
        telefone: pick(reg.telefone, reg.telefone_comercial, card.telefone),
        cpf: pick(reg.cpf, card.cpf),
        tipo_pessoa: pick(reg.tipo_pessoa, card.tipo_pessoa),
        razao_social: pick(reg.razao_social, card.razao_social),
        cnpj: pick(reg.cnpj, card.cnpj),
      },
      carta: {
        card_id: card.id ?? null,
        valor_credito: valorCredito,
        tipo_produto: pick(reg.tipo_produto, proposal?.tipo_produto, card.tipo_produto),
        produto_codigo: pick(reg.produto_codigo, card.produto_embracon),
        categoria: pick(reg.categoria, card.categoria),
        grupo: pick(reg.grupo, card.grupo),
        cota: pick(reg.cota, card.cota),
        prazo_meses: pick(reg.prazo_meses, proposal?.prazo_meses, card.prazo_meses),
        data_contratacao: pick(reg.data_contratacao, card.data_contratacao),
        dia_vencimento: pick(reg.dia_vencimento, card.dia_vencimento),
        condicao_pagamento: pick(reg.condicao_pagamento, card.condicao_pagamento),
        inclui_seguro: reg.inclui_seguro ?? card.inclui_seguro_vida ?? null,
        empresa_paga_parcelas: pick(reg.empresa_paga_parcelas),
        tipo_contrato: pick(reg.tipo_contrato),
        parcelas_pagas_empresa: reg.parcelas_pagas_empresa ?? null,
        inicio_segunda_parcela: pick(reg.inicio_segunda_parcela),
        vendedor_name: pick(reg.vendedor_name_cota, reg.vendedor_name, card.vendedor_name),
        origem: pick(reg.origem, card.origem),
        origem_detalhe: pick(reg.origem_detalhe, card.origem_detalhe),
        origem_lead: pick(proposal?.origem_lead),
        e_transferencia: reg.e_transferencia ?? card.e_transferencia ?? null,
        transferido_de: pick(reg.transferido_de, (card as any).transferido_de),
        valor_comissao: reg.valor_comissao ?? card.valor_comissao ?? null,
        observacoes: pick(reg.observacoes, card.observacoes),
      },
      proposta: proposal,
      registration: {
        id: reg.id ?? null,
        status: reg.status ?? null,
        aceite_date: reg.aceite_date ?? null,
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