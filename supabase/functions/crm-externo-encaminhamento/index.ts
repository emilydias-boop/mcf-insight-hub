// Recebimento de encaminhamentos de clientes vindos do app MCF Administrativo.
// Cria um negócio na etapa "ENCAMINHADO GR" do pipeline de destino (Consórcio ou MCF Solar)
// e registra o pacote completo em crm_externo_encaminhamentos.
// Somente adição: não altera nenhum fluxo existente do CRM.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-crm-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Destinos suportados (pipelines deste CRM)
const AREAS: Record<string, { origin_id: string; rota: string; label: string }> = {
  consorcio: {
    origin_id: "7d7b1cb5-2a44-4552-9eff-c3b798646b78",
    rota: "/consorcio/crm/negocios",
    label: "Consórcio",
  },
  solar: {
    origin_id: "c0a10a52-7f3e-4b21-9a2d-5f1b8e0a1002",
    rota: "/solar/crm/negocios",
    label: "MCF Solar",
  },
};

const STAGE_NAME = "ENCAMINHADO GR";
const SOURCE_APP_DEFAULT = "mcfadministrativo";

function digits(v?: string | null) {
  return (v ?? "").replace(/\D/g, "");
}

function resumoHistorico(historico: any[]): string {
  if (!Array.isArray(historico) || historico.length === 0) return "";
  return historico
    .slice(0, 30)
    .map((h) => {
      const data = h?.data || h?.date || h?.created_at || "";
      const tipo = h?.tipo || h?.type || "registro";
      const texto = h?.descricao || h?.description || h?.texto || h?.nota || "";
      return `• [${String(data).slice(0, 10)}] ${tipo}: ${texto}`;
    })
    .join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const secret = Deno.env.get("CRM_EXTERNO_SECRET");
  if (!secret) return json({ erro: "integracao_nao_configurada" }, 500);

  const key = req.headers.get("x-crm-key");
  if (!key || key !== secret) return json({ erro: "nao_autorizado" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    // ---------- Consulta de andamento (retorno para o app de origem) ----------
    if (req.method === "GET") {
      const url = new URL(req.url);
      const externalId = url.searchParams.get("external_id");
      const sourceApp = url.searchParams.get("source_app") ?? SOURCE_APP_DEFAULT;
      if (!externalId) return json({ erro: "external_id_obrigatorio" }, 400);

      const { data, error } = await supabase
        .from("crm_externo_encaminhamentos")
        .select(
          "external_id, area, status, responsavel_nome, status_atualizado_em, deal_id, recebido_em",
        )
        .eq("source_app", sourceApp)
        .eq("external_id", externalId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return json({ erro: "encaminhamento_nao_encontrado" }, 404);

      return json({
        external_id: data.external_id,
        area: data.area,
        status: data.status,
        responsavel: data.responsavel_nome,
        atualizado_em: data.status_atualizado_em,
        recebido_em: data.recebido_em,
        negocio_id: data.deal_id,
      });
    }

    if (req.method !== "POST") return json({ erro: "metodo_nao_permitido" }, 405);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ erro: "payload_invalido" }, 400);

    const externalId = String(body.external_id ?? body.encaminhamento_id ?? "").trim();
    const area = String(body.area ?? body.destino ?? "").trim().toLowerCase();
    const motivo = String(body.motivo ?? body.motivo_encaminhamento ?? "").trim();
    const sourceApp = String(body.source_app ?? SOURCE_APP_DEFAULT).trim();
    const cliente = body.cliente ?? {};
    const nome = String(cliente.nome ?? cliente.name ?? body.cliente_nome ?? "").trim();

    const faltando: string[] = [];
    if (!externalId) faltando.push("external_id");
    if (!area) faltando.push("area");
    if (!motivo) faltando.push("motivo");
    if (!nome) faltando.push("cliente.nome");
    if (faltando.length) return json({ erro: "campos_obrigatorios", campos: faltando }, 400);

    const destino = AREAS[area];
    if (!destino) {
      return json({ erro: "area_invalida", areas_suportadas: Object.keys(AREAS) }, 400);
    }

    // ---------- Idempotência: mesmo encaminhamento não duplica negócio ----------
    const { data: existente } = await supabase
      .from("crm_externo_encaminhamentos")
      .select("id, deal_id, status, area")
      .eq("source_app", sourceApp)
      .eq("external_id", externalId)
      .maybeSingle();

    if (existente) {
      return json({
        ok: true,
        duplicado: true,
        encaminhamento_id: existente.id,
        negocio_id: existente.deal_id,
        status: existente.status,
        area: existente.area,
        rota: AREAS[existente.area]?.rota ?? destino.rota,
      });
    }

    const email = String(cliente.email ?? "").trim().toLowerCase() || null;
    const telefone = String(cliente.telefone ?? cliente.phone ?? "").trim() || null;
    const documento =
      String(cliente.documento ?? cliente.cpf_cnpj ?? cliente.cpf ?? cliente.cnpj ?? "").trim() ||
      null;
    const endereco = cliente.endereco ?? {};
    const perfil = cliente.perfil ?? {};
    const historico = Array.isArray(body.historico) ? body.historico : [];
    const anamnese = body.anamnese ?? {};
    const score = body.score ?? anamnese?.score ?? null;
    const faixa = body.faixa_classificacao ?? anamnese?.faixa ?? null;
    const gerente = body.gerente ?? {};
    const callbackUrl = String(body.callback_url ?? "").trim() || null;

    // ---------- Etapa de destino ----------
    const { data: stage, error: stageErr } = await supabase
      .from("crm_stages")
      .select("id")
      .eq("origin_id", destino.origin_id)
      .eq("stage_name", STAGE_NAME)
      .maybeSingle();
    if (stageErr) throw stageErr;
    if (!stage) return json({ erro: "etapa_destino_ausente", area }, 500);

    // ---------- Contato: reaproveita existente por e-mail ou telefone ----------
    let contactId: string | null = null;
    if (email) {
      const { data } = await supabase
        .from("crm_contacts")
        .select("id")
        .eq("email", email)
        .eq("is_archived", false)
        .limit(1);
      contactId = data?.[0]?.id ?? null;
    }
    if (!contactId && telefone) {
      const suffix = digits(telefone).slice(-9);
      if (suffix.length === 9) {
        const { data } = await supabase
          .from("crm_contacts")
          .select("id, phone")
          .ilike("phone", `%${suffix}%`)
          .eq("is_archived", false)
          .limit(1);
        contactId = data?.[0]?.id ?? null;
      }
    }
    if (!contactId) {
      const { data: novoContato, error: contatoErr } = await supabase
        .from("crm_contacts")
        .insert({
          clint_id: `ext-gr-${sourceApp}-${externalId}`,
          name: nome,
          email,
          phone: telefone,
          origin_id: destino.origin_id,
          custom_fields: {
            documento,
            endereco,
            perfil,
            origem_externa: sourceApp,
          },
        })
        .select("id")
        .single();
      if (contatoErr) {
        // Trigger de duplicidade pode recusar: tenta reaproveitar o contato existente
        console.error("[crm-externo] contato:", contatoErr.message);
        if (email) {
          const { data } = await supabase
            .from("crm_contacts")
            .select("id")
            .eq("email", email)
            .limit(1);
          contactId = data?.[0]?.id ?? null;
        }
        if (!contactId) throw contatoErr;
      } else {
        contactId = novoContato.id;
      }
    }

    // ---------- Negócio na etapa ENCAMINHADO GR (sem responsável) ----------
    const { data: deal, error: dealErr } = await supabase
      .from("crm_deals")
      .insert({
        clint_id: `ext-gr-${sourceApp}-${externalId}`,
        name: nome,
        contact_id: contactId,
        origin_id: destino.origin_id,
        stage_id: stage.id,
        data_source: "webhook",
        product_name: destino.label,
        custom_fields: {
          origem_externa: sourceApp,
          encaminhamento_external_id: externalId,
          motivo_encaminhamento: motivo,
          telefone,
          email,
          documento,
          endereco,
          perfil,
          anamnese,
          score,
          faixa_classificacao: faixa,
          gerente_nome: gerente.nome ?? gerente.name ?? null,
          gerente_email: gerente.email ?? null,
          historico_externo: historico,
        },
      })
      .select("id")
      .single();
    if (dealErr) throw dealErr;

    // ---------- Registro do encaminhamento ----------
    const { data: enc, error: encErr } = await supabase
      .from("crm_externo_encaminhamentos")
      .insert({
        external_id: externalId,
        source_app: sourceApp,
        area,
        motivo,
        cliente_nome: nome,
        cliente_email: email,
        cliente_telefone: telefone,
        cliente_documento: documento,
        cliente_endereco: endereco,
        cliente_perfil: perfil,
        historico,
        anamnese,
        score: typeof score === "number" ? score : null,
        faixa_classificacao: faixa,
        gerente_nome: gerente.nome ?? gerente.name ?? null,
        gerente_email: gerente.email ?? null,
        payload_original: body,
        deal_id: deal.id,
        contact_id: contactId,
        status: "recebida",
        callback_url: callbackUrl,
      })
      .select("id")
      .single();
    if (encErr) throw encErr;

    // ---------- Histórico visível no negócio ----------
    const descricao = [
      `Encaminhado pelo gerente de relacionamento (${destino.label}).`,
      `Motivo: ${motivo}`,
      score !== null && score !== undefined ? `Score: ${score}${faixa ? ` (${faixa})` : ""}` : "",
      resumoHistorico(historico) ? `\nHistórico de atendimento:\n${resumoHistorico(historico)}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    await supabase.from("deal_activities").insert({
      deal_id: deal.id,
      activity_type: "note",
      description: descricao,
      metadata: { origem_externa: sourceApp, external_id: externalId },
    });

    return json({
      ok: true,
      encaminhamento_id: enc.id,
      negocio_id: deal.id,
      contato_id: contactId,
      area,
      rota: destino.rota,
      status: "recebida",
    }, 201);
  } catch (e) {
    console.error("[crm-externo-encaminhamento]", (e as Error).message);
    return json({ erro: "falha_ao_processar", detalhe: (e as Error).message }, 500);
  }
});
