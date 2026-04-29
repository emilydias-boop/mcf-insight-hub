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
      ai_verdict_received, // veredito retornado em analyze, devolvido em commit
      ai_payload,          // payload completo da IA devolvido em commit
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
      ai_verdict_received?: string | null;
      ai_payload?: any;
    } = body;

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

    // ========== COMMIT: pula IA, persiste validação com service role ==========
    if (action === "commit") {
      if (!human_decision) {
        return new Response(JSON.stringify({ error: "human_decision required no commit" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Re-executa IA aqui também — não confia no veredito devolvido pelo cliente.
      // (Reutiliza dataUrl já baixado)
    }

    const systemPrompt =
      "Você é um auditor de conversas de WhatsApp para uma operação comercial brasileira. " +
      "Analise o print enviado e responda APENAS via tool call 'no_show_verdict'. " +
      "Considere no-show: lead não respondeu, ignorou, esqueceu da reunião, ou disse que não vai comparecer sem reagendar. " +
      "NÃO é no-show: lead reagendou, lead apareceu, lead chegou atrasado mas chegou, ou conversa indica reunião realizada/feita. " +
      "Extraia o número de telefone visível no topo da conversa (ou no nome do contato se for um número).";

    const userParts: any[] = [
      {
        type: "text",
        text:
          `Lead esperado: ${lead_name ?? "(desconhecido)"}\n` +
          `Telefone do lead no CRM: ${lead_phone ?? "(não informado)"}\n` +
          `Reunião agendada para: ${meeting_scheduled_at ?? "(desconhecido)"}\n\n` +
          "Analise o print abaixo e dê seu parecer.",
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
                    enum: ["confirmed_no_show", "not_no_show", "uncertain"],
                    description: "Classificação final.",
                  },
                  reasoning: {
                    type: "string",
                    description: "Explicação curta (máx 2 frases) do porquê.",
                  },
                  extracted_phone: {
                    type: "string",
                    description: "Telefone visível no print (apenas dígitos com DDI/DDD se houver). Vazio se não for legível.",
                  },
                  conversation_summary: {
                    type: "string",
                    description: "Resumo de 1 frase do que aconteceu na conversa.",
                  },
                },
                required: ["verdict", "reasoning", "extracted_phone", "conversation_summary"],
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
      verdict: "confirmed_no_show" | "not_no_show" | "uncertain";
      reasoning: string;
      extracted_phone: string;
      conversation_summary: string;
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
    const phoneMatch =
      leadNorm && aiNorm ? leadNorm === aiNorm : null;

    // ========== COMMIT: persiste no DB com service role ==========
    if (action === "commit") {
      // Busca settings (modo block?)
      const { data: settings } = await adminClient
        .from("no_show_ai_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();

      const requireEvidence = settings?.require_evidence ?? true;
      const mode = settings?.mode ?? "suggest";

      if (requireEvidence && mode === "block" && parsed.verdict === "not_no_show" && human_decision === "no_show") {
        return new Response(JSON.stringify({
          error: "Modo block: a IA determinou que esta conversa NÃO é No-Show.",
          ai: { verdict: parsed.verdict, reasoning: parsed.reasoning },
        }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const isOverride = parsed.verdict === "not_no_show" && human_decision === "no_show";
      if (isOverride && (!human_justification || human_justification.trim().length < 10)) {
        return new Response(JSON.stringify({
          error: "Justificativa obrigatória (mínimo 10 caracteres) ao discordar da IA.",
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
          ai_verdict: parsed.verdict,
          ai_reasoning: parsed.reasoning,
          ai_extracted_phone: parsed.extracted_phone,
          phone_match: phoneMatch,
          ai_model: "google/gemini-3-flash-preview",
          ai_raw_response: aiJson,
          human_decision,
          human_justification: human_justification ?? null,
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
          override: isOverride,
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
        phone_match: phoneMatch,
        lead_phone_normalized: leadNorm,
        extracted_phone_normalized: aiNorm,
        evidence_hash: evidenceHash,
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