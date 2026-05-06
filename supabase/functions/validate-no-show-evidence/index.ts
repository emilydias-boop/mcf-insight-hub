import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Normaliza telefone para os últimos 9 dígitos (padrão brasileiro de celular).
 * Mantém o padrão usado no resto do sistema (ver memória CRM dedup).
 */
function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D+/g, "");
  if (digits.length < 8) return null;
  return digits.slice(-9);
}

/**
 * Extrai assinatura do telefone brasileiro tolerando variações de formato:
 * - com/sem código do país (55)
 * - com/sem o "9" extra do celular
 * - com 8, 9, 10 ou 11 dígitos
 *
 * Retorna { last8, ddd } onde:
 *  - last8 = últimos 8 dígitos do número local (parte invariante)
 *  - ddd  = DDD (2 dígitos) quando identificável, caso contrário null
 *
 * Match considera dois telefones equivalentes quando os últimos 8 dígitos
 * batem E (DDD ausente em um lado OU iguais).
 */
function phoneSignature(raw: string | null | undefined): { last8: string; ddd: string | null } | null {
  if (!raw) return null;
  let digits = raw.replace(/\D+/g, "");
  if (digits.length < 8) return null;
  // remove código do país (55) quando presente em formatos longos
  if (digits.length >= 12 && digits.startsWith("55")) digits = digits.slice(2);
  // tira o "9" extra do celular: DDD + 9XXXXXXXX -> DDD + XXXXXXXX
  if (digits.length === 11 && digits[2] === "9") digits = digits.slice(0, 2) + digits.slice(3);
  const last8 = digits.slice(-8);
  const ddd = digits.length >= 10 ? digits.slice(-10, -8) : null;
  return { last8, ddd };
}

function phonesEquivalent(a: string | null | undefined, b: string | null | undefined): boolean | null {
  const sa = phoneSignature(a);
  const sb = phoneSignature(b);
  if (!sa || !sb) return null;
  if (sa.last8 !== sb.last8) return false;
  if (sa.ddd && sb.ddd && sa.ddd !== sb.ddd) return false;
  return true;
}

async function sha256Hex(buf: Uint8Array): Promise<string> {
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  const arr = Array.from(new Uint8Array(hashBuf));
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json();
    const {
      action = "analyze",
      evidence_path,
      lead_phone,
      lead_name,
      meeting_scheduled_at,
      deal_id,
      meeting_slot_id,
      attendee_id,
      bu_origin_id,
      performed_by_role,
      human_decision,
      human_justification,
      meeting_type,
      sdr_justification,
      contest,
    }: {
      action?: "analyze" | "commit";
      evidence_path: string;
      lead_phone?: string | null;
      lead_name?: string | null;
      meeting_scheduled_at?: string | null;
      deal_id?: string | null;
      meeting_slot_id?: string | null;
      attendee_id?: string | null;
      bu_origin_id?: string | null;
      performed_by_role?: string | null;
      human_decision?: "no_show" | "not_no_show" | null;
      human_justification?: string | null;
      meeting_type?: "R1" | "R2";
      sdr_justification?: string | null;
      contest?: boolean;
      prior_verdict?: "confirmed" | "not_no_show" | "inconclusive" | null;
    } = body;
    const priorVerdict = (body as any)?.prior_verdict ?? null;

    if (!evidence_path) {
      return new Response(JSON.stringify({ error: "evidence_path required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Garante que o path pertence ao próprio usuário (mesmo padrão da policy de Storage)
    const firstSegment = evidence_path.split("/")[0];
    if (firstSegment !== userId) {
      return new Response(JSON.stringify({ error: "evidence_path não pertence ao usuário" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cria signed URL temporária para a IA acessar a imagem
    const { data: signed, error: signErr } = await adminClient.storage
      .from("no-show-evidence")
      .createSignedUrl(evidence_path, 300);
    if (signErr || !signed?.signedUrl) {
      console.error("signed url error", signErr);
      return new Response(
        JSON.stringify({ error: "Could not access evidence file" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Baixa imagem e converte em data URL para enviar ao gateway
    const imgResp = await fetch(signed.signedUrl);
    if (!imgResp.ok) {
      return new Response(JSON.stringify({ error: "Failed to fetch image" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const contentType = imgResp.headers.get("content-type") ?? "image/png";
    const imgBuf = new Uint8Array(await imgResp.arrayBuffer());
    const evidenceHash = await sha256Hex(imgBuf);
    let binary = "";
    for (let i = 0; i < imgBuf.length; i++) binary += String.fromCharCode(imgBuf[i]);
    const base64 = btoa(binary);
    const dataUrl = `data:${contentType};base64,${base64}`;

    // ========== Bloqueia hash duplicado (print reusado) ==========
    if (deal_id) {
      const { data: dupHash } = await adminClient
        .from("no_show_validations")
        .select("id, deal_id")
        .eq("evidence_hash", evidenceHash)
        .neq("deal_id", deal_id)
        .limit(1)
        .maybeSingle();
      if (dupHash) {
        await adminClient.from("no_show_blocked_attempts").insert({
          deal_id,
          meeting_slot_id: meeting_slot_id ?? null,
          attendee_id: attendee_id ?? null,
          evidence_hash: evidenceHash,
          evidence_path,
          lead_phone: lead_phone ?? null,
          lead_name: lead_name ?? null,
          attempted_by: userId,
          attempt_reason: "duplicate_hash",
          conflicting_validation_id: dupHash.id,
          conflicting_deal_id: dupHash.deal_id,
          meeting_type: meeting_type ?? null,
          bu_origin_id: bu_origin_id ?? null,
        });
        return new Response(JSON.stringify({
          error: "Este print já foi usado em outro lead. Envie uma evidência única para esta reunião.",
        }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // ========== Bloqueia reenvio para a MESMA reunião ==========
    // Regra: para o mesmo attendee_id (ou, na ausência dele, mesmo
    // meeting_slot_id + deal_id), só pode existir UMA validação ativa
    // (auto-aprovada, aprovada pelo gestor ou pendente de revisão).
    // Reenvio só é permitido se a anterior foi REJEITADA pelo gestor.
    {
      let activeQuery = adminClient
        .from("no_show_validations")
        .select("id, final_status, manager_review_status, ai_verdict, created_at")
        .order("created_at", { ascending: false })
        .limit(1);

      if (attendee_id) {
        activeQuery = activeQuery.eq("attendee_id", attendee_id);
      } else if (meeting_slot_id && deal_id) {
        activeQuery = activeQuery.eq("meeting_slot_id", meeting_slot_id).eq("deal_id", deal_id);
      } else if (deal_id) {
        activeQuery = activeQuery.eq("deal_id", deal_id);
      } else {
        activeQuery = null as any;
      }

      if (activeQuery) {
        const { data: lastValidation } = await activeQuery.maybeSingle();
        if (lastValidation) {
          const wasRejectedByManager = lastValidation.manager_review_status === "rejected";
          if (!wasRejectedByManager) {
            await adminClient.from("no_show_blocked_attempts").insert({
              deal_id: deal_id ?? null,
              meeting_slot_id: meeting_slot_id ?? null,
              attendee_id: attendee_id ?? null,
              evidence_hash: evidenceHash,
              evidence_path,
              lead_phone: lead_phone ?? null,
              lead_name: lead_name ?? null,
              attempted_by: userId,
              attempt_reason: "duplicate_active",
              conflicting_validation_id: lastValidation.id,
              conflicting_deal_id: deal_id ?? null,
              ai_verdict: lastValidation.ai_verdict ?? null,
              meeting_type: meeting_type ?? null,
              bu_origin_id: bu_origin_id ?? null,
            });
            return new Response(JSON.stringify({
              error: "Já existe uma solicitação de No-Show ativa para esta reunião. Aguarde a decisão do gestor antes de enviar uma nova evidência.",
              code: "duplicate_active_validation",
              existing_validation_id: lastValidation.id,
              existing_status: lastValidation.final_status,
              existing_manager_review: lastValidation.manager_review_status,
            }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        }
      }
    }

    // ========== Busca histórico de no-shows do lead (contexto para IA) ==========
    let priorNoShows = 0;
    if (deal_id) {
      const { count } = await adminClient
        .from("no_show_validations")
        .select("id", { count: "exact", head: true })
        .eq("deal_id", deal_id)
        .in("ai_verdict", ["confirmed", "confirmed_no_show"]);
      priorNoShows = count ?? 0;
    }

    const mtype = meeting_type ?? "R1";
    const meetingLabel = mtype === "R1" ? "R1 (primeira reunião com SDR)" : "R2 (reunião de fechamento com closer)";

    const systemPrompt =
      `Você é um auditor de evidências de NO-SHOW para a ${meetingLabel} de uma operação comercial brasileira. ` +
      "Sua tarefa é analisar o print de uma conversa (geralmente WhatsApp) e decidir se caracteriza no-show legítimo. " +
      "\n\n## REGRA #1 — IDENTIDADE DO LEAD (BLOQUEANTE)\n" +
      "ANTES de qualquer outra análise, você PRECISA ver no print uma prova visível de que a conversa é com o lead esperado:\n" +
      "- Telefone do lead aparecendo no topo/cabeçalho da conversa OU em uma mensagem, OU\n" +
      "- Nome do lead aparecendo no topo/cabeçalho do contato (ex: '~Renato', 'Renato Silva') compatível com o esperado.\n" +
      "Se o print mostra APENAS as mensagens (balões verdes/brancos) sem cabeçalho com telefone/nome, OU se o telefone/nome visível NÃO bate com o lead esperado, " +
      "isso é PROVA INSUFICIENTE de identidade. Nesse caso retorne OBRIGATORIAMENTE 'inconclusive' (NUNCA 'confirmed'), " +
      "marque criteria_met.identity_match = false, e em 'reasoning' explique exatamente o que está faltando " +
      "(ex: 'O print não mostra o cabeçalho da conversa com o telefone/nome do contato, então não é possível confirmar que é o lead esperado. Peça um print incluindo o topo da conversa do WhatsApp mostrando o número/nome do contato.').\n" +
      "\n## CRITÉRIOS OBRIGATÓRIOS PARA 'confirmed' (TODOS precisam ser atendidos):\n" +
      "1. IDENTIDADE: telefone OU nome visível no print bate com o lead esperado (regra #1 acima).\n" +
      "2. CONTATO: existe pelo menos UMA mensagem enviada PELO VENDEDOR (balões à direita / verdes) sem resposta do lead, OU o lead respondeu confirmando que não compareceria/não compareceu.\n" +
      "3. JANELA TEMPORAL: as mensagens são próximas (±24h) ao horário da reunião agendada.\n" +
      "4. SINAIS REFORÇADORES (bônus): frases como 'esqueci', 'não vou poder', 'não tenho mais interesse', 'desculpa não apareci', 'acabei não conseguindo entrar na reunião', silêncio após mensagens insistindo.\n" +
      "\n## RETORNE 'not_no_show' SE:\n" +
      "- O lead respondeu e remarcou ou apareceu/atrasou (reunião aconteceu).\n" +
      "- A conversa indica reunião realizada/feita.\n" +
      "- Não há tentativa visível de contato sobre a reunião.\n" +
      "- O telefone/nome no print é claramente de OUTRA pessoa (diferente do lead esperado).\n" +
      "\n## RETORNE 'inconclusive' SE:\n" +
      "- O print não mostra o cabeçalho com telefone/nome do contato (não dá para confirmar identidade).\n" +
      "- Print ilegível, cortado, ou sem contexto da reunião.\n" +
      "- Datas/horários das mensagens não são identificáveis.\n" +
      "- Não dá para ter certeza dos critérios acima.\n" +
      "\n## EXEMPLOS DE PRINT BOM (confirmed possível):\n" +
      "- Topo do WhatsApp visível com '+55 11 99999-9999' ou '~Renato' batendo com o lead, mensagens do vendedor próximas ao horário e sem resposta do lead.\n" +
      "## EXEMPLOS DE PRINT INSUFICIENTE (sempre 'inconclusive'):\n" +
      "- Apenas balões de mensagem, sem cabeçalho mostrando telefone/nome do contato — mesmo que o lead diga 'desculpa não consegui entrar', não dá para provar que é ESTE lead. " +
      "Peça um novo print incluindo o topo da conversa.\n" +
      "\nSeja RIGOROSO. Em caso de dúvida real sobre a identidade, SEMPRE prefira 'inconclusive' a 'confirmed'. " +
      "A prova de identidade é o ponto mais importante — sem ela o no-show não pode ser auto-aprovado.";

    const userParts: any[] = [
      {
        type: "text",
        text:
          `## Dados do lead esperado\n` +
          `- Nome: ${lead_name ?? "(desconhecido)"}\n` +
          `- Telefone CRM: ${lead_phone ?? "(não informado)"}\n` +
          `- Reunião (${mtype}) agendada para: ${meeting_scheduled_at ?? "(desconhecido)"}\n` +
          `- No-shows anteriores deste lead: ${priorNoShows}\n\n` +
          "Analise o print abaixo conforme os critérios e responda via tool call.",
      },
      { type: "image_url", image_url: { url: dataUrl } },
    ];

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userParts },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "no_show_verdict",
              description: "Retorna o parecer sobre se a conversa caracteriza no-show.",
              parameters: {
                type: "object",
                properties: {
                  verdict: {
                    type: "string",
                    enum: ["confirmed", "not_no_show", "inconclusive"],
                    description: "Classificação final.",
                  },
                  reasoning: {
                    type: "string",
                    description: "Explicação curta (máx 3 frases) citando quais critérios bateram ou faltaram.",
                  },
                  extracted_phone: {
                    type: "string",
                    description: "Telefone visível no print (apenas dígitos com DDI/DDD se houver). Vazio se não for legível.",
                  },
                  conversation_summary: {
                    type: "string",
                    description: "Resumo de 1 frase do que aconteceu na conversa.",
                  },
                  criteria_met: {
                    type: "object",
                    properties: {
                      identity_match: { type: "boolean", description: "Telefone/nome bate com o lead?" },
                      vendor_message_no_response: { type: "boolean", description: "Há mensagem do vendedor sem resposta OU resposta confirmando ausência?" },
                      timing_close_to_meeting: { type: "boolean", description: "Mensagens próximas (±24h) do horário da reunião?" },
                      lead_confirmed_absence: { type: "boolean", description: "Lead respondeu confirmando que não compareceria/desistiu?" },
                    },
                    required: ["identity_match", "vendor_message_no_response", "timing_close_to_meeting", "lead_confirmed_absence"],
                    additionalProperties: false,
                  },
                },
                required: ["verdict", "reasoning", "extracted_phone", "conversation_summary", "criteria_met"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "no_show_verdict" } },
      }),
    });

    if (aiResp.status === 429) {
      return new Response(
        JSON.stringify({ error: "Limite de uso da IA atingido. Tente novamente em alguns minutos." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (aiResp.status === 402) {
      return new Response(
        JSON.stringify({ error: "Créditos da IA esgotados. Recarregue na aba de Workspace." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      return new Response(JSON.stringify({ error: "Erro ao chamar a IA", detail: t }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call returned", aiJson);
      return new Response(JSON.stringify({ error: "IA não retornou parecer estruturado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: {
      verdict: "confirmed" | "not_no_show" | "inconclusive";
      reasoning: string;
      extracted_phone: string;
      conversation_summary: string;
      criteria_met: {
        identity_match: boolean;
        vendor_message_no_response: boolean;
        timing_close_to_meeting: boolean;
        lead_confirmed_absence: boolean;
      };
    };
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      return new Response(JSON.stringify({ error: "Falha ao interpretar parecer da IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const leadNorm = normalizePhone(lead_phone ?? null);
    const aiNorm = normalizePhone(parsed.extracted_phone ?? null);
    // Comparação tolerante a 8/9/10/11 dígitos, com ou sem "9" extra de celular.
    const phoneMatch = phonesEquivalent(lead_phone, parsed.extracted_phone);

    // ========== COMMIT: persiste no DB com service role ==========
    if (action === "commit") {
      // ========== GUARD DE INTEGRIDADE: attendee_id ↔ meeting_slot_id ↔ lead_phone ==========
      // Bug histórico: o frontend, em slots multi-lead, podia mandar attendee_id de outro
      // lead (fallback silencioso para participants[0]). Aqui rejeitamos qualquer
      // combinação inconsistente para garantir que o no-show seja gravado contra o
      // attendee certo.
      if (attendee_id) {
        const { data: att, error: attErr } = await adminClient
          .from("meeting_slot_attendees")
          .select("id, meeting_slot_id, attendee_phone, deal_id")
          .eq("id", attendee_id)
          .maybeSingle();

        if (attErr || !att) {
          return new Response(JSON.stringify({
            error: "Attendee não encontrado. Atualize a página e selecione novamente o lead.",
          }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        if (meeting_slot_id && att.meeting_slot_id !== meeting_slot_id) {
          return new Response(JSON.stringify({
            error: "O lead selecionado não pertence a este horário. Atualize a página e tente novamente.",
          }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        // GUARD CRÍTICO: o deal_id enviado precisa ser o mesmo do attendee selecionado.
        // Sem isto, em slot multi-lead um SDR pode abrir o drawer do lead A, escolher o
        // participante B e gravar a validação cruzada (deal=A + attendee=B).
        // Caso histórico: Edney/Diogo/Roseane (06/05/2026).
        if (deal_id && att.deal_id && att.deal_id !== deal_id) {
          return new Response(JSON.stringify({
            error: "O lead selecionado pertence a outro negócio. Abra o card correto desse lead e tente novamente.",
          }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        if (lead_phone && att.attendee_phone) {
          const attNorm = normalizePhone(att.attendee_phone);
          const sentNorm = normalizePhone(lead_phone);
          if (attNorm && sentNorm && attNorm !== sentNorm) {
            return new Response(JSON.stringify({
              error: "O telefone enviado não confere com o lead selecionado. Atualize a página e tente novamente.",
            }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        }
      }

      // Estabilidade: se o cliente passou o veredicto da fase 'analyze',
      // usamos ele para decidir as validações (a IA não é determinística e
      // pode oscilar entre chamadas, gerando UX confusa para o usuário).
      // O veredicto fresco continua sendo gravado em ai_verdict para auditoria.
      const effectiveVerdict = (priorVerdict ?? parsed.verdict) as
        | "confirmed"
        | "not_no_show"
        | "inconclusive";

      // Validações por verdict
      if (effectiveVerdict === "inconclusive") {
        if (!sdr_justification || sdr_justification.trim().length < 10) {
          return new Response(JSON.stringify({
            error: "Justificativa obrigatória (mínimo 10 caracteres) quando a IA fica em dúvida.",
            verdict: effectiveVerdict,
          }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      const isContest = effectiveVerdict === "not_no_show" && contest === true;
      if (effectiveVerdict === "not_no_show" && !isContest) {
        return new Response(JSON.stringify({
          error: "A IA determinou que esta conversa NÃO é No-Show. Use o fluxo de contestação se discordar.",
          verdict: effectiveVerdict,
          reasoning: parsed.reasoning,
        }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (isContest && (!sdr_justification || sdr_justification.trim().length < 20)) {
        return new Response(JSON.stringify({
          error: "Para contestar a IA, descreva o motivo em pelo menos 20 caracteres.",
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // final_status
      let finalStatus: "approved" | "blocked" | "pending_review" = "approved";
      let managerReviewStatus: "pending" | null = null;
      if (effectiveVerdict === "confirmed") finalStatus = "approved";
      else if (effectiveVerdict === "inconclusive") {
        // Inconclusivo + justificativa NÃO conta automaticamente —
        // exige aprovação do gestor antes de virar no-show de fato.
        finalStatus = "pending_review";
        managerReviewStatus = "pending";
      }
      else if (isContest) {
        finalStatus = "pending_review";
        managerReviewStatus = "pending";
      }

      const { data: inserted, error: insertErr } = await adminClient
        .from("no_show_validations")
        .insert({
          deal_id: deal_id ?? null,
          meeting_slot_id: meeting_slot_id ?? null,
          attendee_id: attendee_id ?? null,
          lead_phone: lead_phone ?? null,
          evidence_path,
          evidence_hash: evidenceHash,
          ai_verdict: parsed.verdict, // 'confirmed' | 'not_no_show' | 'inconclusive'
          ai_reasoning: parsed.reasoning,
          ai_extracted_phone: parsed.extracted_phone,
          phone_match: phoneMatch,
          ai_model: "google/gemini-3-flash-preview",
          ai_raw_response: aiJson,
          human_decision: human_decision ?? "no_show",
          human_overrode_ai: isContest,
          human_justification: human_justification ?? null,
          sdr_justification: sdr_justification ?? null,
          meeting_type: mtype,
          manager_review_status: managerReviewStatus,
          final_status: finalStatus,
          performed_by: userId,             // forçado server-side
          performed_by_role: performed_by_role ?? null,
          bu_origin_id: bu_origin_id ?? null,
        })
        .select("id")
        .single();

      if (insertErr) {
        console.error("insert validation failed", insertErr);
        return new Response(JSON.stringify({ error: "Falha ao registrar validação", detail: insertErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          committed: true,
          validation_id: inserted.id,
          verdict: parsed.verdict,
          reasoning: parsed.reasoning,
          phone_match: phoneMatch,
          contest: isContest,
          final_status: finalStatus,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ========== ANALYZE (default): só retorna parecer, NÃO persiste ==========
    return new Response(
      JSON.stringify({
        verdict: parsed.verdict,
        reasoning: parsed.reasoning,
        extracted_phone: parsed.extracted_phone,
        conversation_summary: parsed.conversation_summary,
        criteria_met: parsed.criteria_met,
        phone_match: phoneMatch,
        lead_phone_normalized: leadNorm,
        extracted_phone_normalized: aiNorm,
        evidence_hash: evidenceHash,
        prior_no_shows: priorNoShows,
        meeting_type: mtype,
        model: "google/gemini-3-flash-preview",
        user_id: userId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("validate-no-show-evidence error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});