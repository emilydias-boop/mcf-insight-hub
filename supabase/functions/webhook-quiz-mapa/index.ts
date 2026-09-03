// Receptor dedicado do Quiz Mapa do Mercado (consultoriamcf.com/quiz-mapa).
//
// Por que uma função nova em vez de usar o webhook-lead-receiver: o receptor
// genérico tem contrato próprio de payload e nunca escreve
// `custom_fields.qualification_answers` — que é exatamente o caminho lido pelo
// gatilho `trg_classify_lead_icp_segment` da `crm_deals`. Aqui o objeto de
// respostas do quiz é gravado cru, sem renomear chave nenhuma.
//
// Nada de icp_segment / lead_income_estimate na mão: quem classifica é o gatilho.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Mesma régua do webhook-lead-receiver: dígitos + prefixo 55 + '+'. */
function normalizarTelefone(phone: unknown): string | null {
  if (!phone) return null;
  let clean = String(phone).replace(/\D/g, "");
  if (!clean) return null;
  if (clean.startsWith("0")) clean = clean.substring(1);
  // 10 ou 11 dígitos = número nacional sem DDI → prefixa 55.
  if (!clean.startsWith("55") && clean.length <= 11) clean = "55" + clean;
  return "+" + clean;
}

/**
 * Resolve o profile_id do owner sem escolher "o primeiro" silenciosamente
 * (mesma política do _shared/resolveOwnerProfile do receptor genérico).
 */
// deno-lint-ignore no-explicit-any
async function resolverOwnerProfileId(supabase: any, email: string | null) {
  const normalized = (email ?? "").trim();
  if (!normalized) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, access_status")
    .ilike("email", normalized);
  if (error) {
    console.warn("[QUIZ-MAPA] erro ao resolver profile do owner:", error.message);
    return null;
  }
  const elegiveis = (data ?? []).filter(
    (r: { access_status: string | null }) =>
      !r.access_status || r.access_status === "ativo",
  );
  if (elegiveis.length === 1) return elegiveis[0].id as string;
  console.warn(
    `[QUIZ-MAPA] owner_profile_id não resolvido para ${normalized} (elegíveis: ${elegiveis.length})`,
  );
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "metodo_nao_permitido" }, 405);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // deno-lint-ignore no-explicit-any
  let payload: Record<string, any> = {};

  try {
    payload = await req.json().catch(() => ({}));
    console.log("[QUIZ-MAPA] payload recebido:", JSON.stringify(payload));

    // 1) Configuração vem do banco (nada chumbado).
    const { data: endpoint, error: endpointError } = await supabase
      .from("webhook_endpoints")
      .select(
        "id, name, origin_id, stage_id, auto_tags, required_fields, is_active, fixed_owner_email, leads_received",
      )
      .eq("slug", "quiz-mapa")
      .maybeSingle();

    if (endpointError) throw endpointError;
    if (!endpoint) return json({ ok: false, erro: "endpoint_nao_encontrado" });

    // Endpoint desligado nunca vira erro — a página de captura não pode quebrar.
    if (endpoint.is_active === false) {
      console.log("[QUIZ-MAPA] endpoint inativo, ignorando lead");
      return json({ ignorado: "endpoint_inativo" });
    }

    // 2) Campos obrigatórios conforme configuração do endpoint.
    const required: string[] = Array.isArray(endpoint.required_fields)
      ? endpoint.required_fields
      : [];
    const faltando = required.filter((campo) => {
      const v = payload[campo];
      return v === undefined || v === null || String(v).trim() === "";
    });
    if (faltando.length > 0) {
      return json({ error: "campos_obrigatorios", faltando }, 400);
    }

    // 3) Telefone no padrão da base: +55DDDNUMERO.
    const telefone = normalizarTelefone(payload.whatsapp ?? payload.telefone);
    const email = payload.email ? String(payload.email).trim().toLowerCase() : null;
    const nome = String(payload.nome ?? "").trim();

    // 4) Contato: e-mail primeiro, telefone (últimos 9 dígitos) como fallback.
    let contato: { id: string; name: string | null; email: string | null; phone: string | null } | null = null;

    if (email) {
      const { data } = await supabase
        .from("crm_contacts")
        .select("id, name, email, phone")
        .ilike("email", email)
        .order("created_at", { ascending: true })
        .limit(1);
      contato = data?.[0] ?? null;
      if (contato) console.log("[QUIZ-MAPA] contato encontrado por e-mail:", contato.id);
    }

    if (!contato && telefone) {
      const sufixo = telefone.replace(/\D/g, "").slice(-9);
      if (sufixo.length === 9) {
        const { data } = await supabase
          .from("crm_contacts")
          .select("id, name, email, phone")
          .ilike("phone", `%${sufixo}`)
          .order("created_at", { ascending: true })
          .limit(1);
        contato = data?.[0] ?? null;
        if (contato) console.log("[QUIZ-MAPA] contato encontrado por telefone:", contato.id);
      }
    }

    let contactId: string;
    if (contato) {
      // Só completa o que está vazio — nunca sobrescreve dado existente.
      const enriquecer: Record<string, string> = {};
      if (!contato.name && nome) enriquecer.name = nome;
      if (!contato.email && email) enriquecer.email = email;
      if (!contato.phone && telefone) enriquecer.phone = telefone;
      if (Object.keys(enriquecer).length > 0) {
        enriquecer.updated_at = new Date().toISOString();
        await supabase.from("crm_contacts").update(enriquecer).eq("id", contato.id);
      }
      contactId = contato.id;
    } else {
      // clint_id é NOT NULL sem default em crm_contacts (igual a crm_deals):
      // precisa ser gerado aqui, no mesmo estilo do negócio.
      const { data: novoContato, error: contatoError } = await supabase
        .from("crm_contacts")
        .insert({
          clint_id: `quiz-mapa-contact-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          name: nome || email || telefone,
          email,
          phone: telefone,
        })
        .select("id")
        .single();
      if (contatoError) throw contatoError;
      contactId = novoContato.id;
      console.log("[QUIZ-MAPA] contato criado:", contactId);
    }

    // 5) Negócio existente pelo mesmo critério do handler da Hubla:
    //    contact_id + origin_id (assim os dois fluxos se encontram depois).
    // Não é maybeSingle: há contatos com mais de um negócio nessa origem e o
    // PostgREST lança erro quando volta mais de uma linha — o handler da Hubla
    // usa o mesmo critério de "mais recente" (order + limit 1).
    const { data: deals } = await supabase
      .from("crm_deals")
      .select("id, tags, custom_fields, owner_id")
      .eq("contact_id", contactId)
      .eq("origin_id", endpoint.origin_id)
      .order("created_at", { ascending: false })
      .limit(1);
    const dealExistente = deals?.[0] ?? null;

    const autoTags: string[] = Array.isArray(endpoint.auto_tags) ? endpoint.auto_tags : [];
    // deno-lint-ignore no-explicit-any
    const respostas: Record<string, any> =
      payload.qualification_answers && typeof payload.qualification_answers === "object"
        ? payload.qualification_answers
        : {};

    // === custom_fields do negócio ===
    // `qualification_answers` é CONTRATO com o gatilho trg_classify_lead_icp_segment:
    // vai o objeto inteiro, sem renomear nenhuma chave.
    const customFieldsNovos: Record<string, unknown> = {
      qualification_answers: respostas,
      source: payload.origem || "quiz-mapa",
      lead_channel: "QUIZ-MAPA",
      webhook_endpoint: endpoint.name,
      utm: payload.utm ?? {},
      variante_teste: payload.variante_teste ?? null,
      quiz_respondido_em: new Date().toISOString(),
    };

    let dealId: string;
    let criado: boolean;
    let ownerEmail: string | null = null;

    if (dealExistente) {
      criado = false;
      dealId = dealExistente.id;
      ownerEmail = dealExistente.owner_id ?? null;

      // Tags somadas sem duplicar.
      const tagsAtuais: string[] = Array.isArray(dealExistente.tags) ? dealExistente.tags : [];
      const tagsFinais = Array.from(new Set([...tagsAtuais, ...autoTags]));

      // Mescla custom_fields; em qualification_answers só preenche chave vazia,
      // preservando qualquer resposta anterior do lead.
      const cfAtuais = (dealExistente.custom_fields ?? {}) as Record<string, unknown>;
      const respostasAtuais = (cfAtuais.qualification_answers ?? {}) as Record<string, unknown>;
      const respostasMescladas: Record<string, unknown> = { ...respostasAtuais };
      for (const [chave, valor] of Object.entries(respostas)) {
        const atual = respostasMescladas[chave];
        const vazio = atual === undefined || atual === null || String(atual).trim() === "";
        if (vazio) respostasMescladas[chave] = valor;
      }

      // Não muda etapa nem dono do negócio existente.
      const { error: updateError } = await supabase
        .from("crm_deals")
        .update({
          tags: tagsFinais,
          custom_fields: {
            ...cfAtuais,
            ...customFieldsNovos,
            qualification_answers: respostasMescladas,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", dealId);
      if (updateError) throw updateError;
      console.log("[QUIZ-MAPA] negócio atualizado:", dealId);
    } else {
      criado = true;

      // 6) Dono só para negócio NOVO: fixo do endpoint ou rodízio da RPC.
      let ownerProfileId: string | null = null;
      if (endpoint.fixed_owner_email) {
        ownerEmail = endpoint.fixed_owner_email;
        ownerProfileId = await resolverOwnerProfileId(supabase, ownerEmail);
      } else {
        const { data: nextOwner, error: ownerError } = await supabase.rpc(
          "get_next_lead_owner",
          { p_origin_id: endpoint.origin_id },
        );
        if (ownerError) {
          console.warn("[QUIZ-MAPA] erro no rodízio de owner:", ownerError.message);
        } else if (nextOwner) {
          ownerEmail = nextOwner as string;
          ownerProfileId = await resolverOwnerProfileId(supabase, ownerEmail);
        }
      }

      const { data: novoDeal, error: dealError } = await supabase
        .from("crm_deals")
        .insert({
          clint_id: `quiz-mapa-deal-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          name: nome || email || telefone,
          value: 0,
          contact_id: contactId,
          origin_id: endpoint.origin_id,
          stage_id: endpoint.stage_id,
          owner_id: ownerEmail,
          owner_profile_id: ownerProfileId,
          product_name: endpoint.name,
          tags: autoTags,
          custom_fields: customFieldsNovos,
          data_source: "webhook",
          stage_moved_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (dealError) throw dealError;
      dealId = novoDeal.id;
      console.log("[QUIZ-MAPA] negócio criado:", dealId, "owner:", ownerEmail);
    }

    // 8) Métricas do endpoint.
    await supabase
      .from("webhook_endpoints")
      .update({
        leads_received: (endpoint.leads_received ?? 0) + 1,
        last_lead_at: new Date().toISOString(),
      })
      .eq("id", endpoint.id);

    // 9) Atividade no negócio (deal_id é TEXT nesta tabela).
    const { error: atividadeError } = await supabase.from("deal_activities").insert({
      deal_id: String(dealId),
      activity_type: "lead_entered",
      description: "Lead entrou pelo Quiz Mapa do Mercado",
      metadata: { payload, slug: "quiz-mapa", webhook_endpoint: endpoint.name },
    });
    if (atividadeError) {
      // Atividade é registro auxiliar: não derruba a ingestão do lead.
      console.warn("[QUIZ-MAPA] falha ao registrar atividade:", atividadeError.message);
    }

    // 10) Lê o segmento já classificado pelo gatilho (só para conferência no teste).
    const { data: dealFinal } = await supabase
      .from("crm_deals")
      .select("icp_segment")
      .eq("id", dealId)
      .maybeSingle();

    return json({
      ok: true,
      deal_id: dealId,
      contact_id: contactId,
      criado,
      owner: ownerEmail,
      segmento: dealFinal?.icp_segment ?? null,
    });
  } catch (e) {
    // A página de captura não pode quebrar por causa do CRM: sempre 200.
    console.error("[QUIZ-MAPA] erro inesperado:", e, "payload:", JSON.stringify(payload));
    return json({ ok: false, erro: String((e as Error)?.message ?? e) });
  }
});
