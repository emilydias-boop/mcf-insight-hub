// Twilio Voice Intelligence -> AI Summary pipeline.
// Triggered by Twilio when a Transcript reaches a terminal state.
// Fetches sentences, asks Lovable AI to extract a structured summary,
// then persists it on calls / crm_deals / attendee_notes / deal_activities.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-twilio-signature",
};

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
const TWILIO_API_KEY_SID = Deno.env.get("TWILIO_API_KEY_SID");
const TWILIO_API_KEY_SECRET = Deno.env.get("TWILIO_API_KEY_SECRET");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

function twilioAuthHeader(): string {
  if (TWILIO_API_KEY_SID && TWILIO_API_KEY_SECRET) {
    return "Basic " + btoa(`${TWILIO_API_KEY_SID}:${TWILIO_API_KEY_SECRET}`);
  }
  return "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
}

async function fetchSentences(transcriptSid: string): Promise<string> {
  const url = `https://intelligence.twilio.com/v2/Transcripts/${transcriptSid}/Sentences?PageSize=1000`;
  const resp = await fetch(url, { headers: { Authorization: twilioAuthHeader() } });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Twilio sentences fetch failed: ${resp.status} ${t}`);
  }
  const data = await resp.json();
  const sentences: any[] = data.sentences || [];
  return sentences
    .map((s) => {
      const speaker = s.media_channel === 1 ? "SDR" : s.media_channel === 2 ? "Lead" : "Pessoa";
      return `${speaker}: ${s.transcript || ""}`;
    })
    .filter((l) => l.trim().length > 0)
    .join("\n");
}

async function fetchTranscriptMeta(transcriptSid: string): Promise<any> {
  const url = `https://intelligence.twilio.com/v2/Transcripts/${transcriptSid}`;
  const resp = await fetch(url, { headers: { Authorization: twilioAuthHeader() } });
  if (!resp.ok) return null;
  return await resp.json();
}

const SYSTEM_PROMPT = `Você é um analista sênior de Inside Sales da MCF (Minha Casa Financiada).
Analise a transcrição de uma ligação entre um SDR e um lead em português brasileiro.
Produza um resumo estruturado, objetivo e útil para o time comercial.

Não invente informações. Se algo não foi dito, use "não informado".`;

const TOOL_SCHEMA = {
  type: "object",
  properties: {
    bullets: {
      type: "array",
      description: "3 a 5 bullets curtos com os pontos principais da conversa.",
      items: { type: "string" },
      minItems: 3,
      maxItems: 5,
    },
    discovery: {
      type: "object",
      description: "Respostas do script de descoberta da MCF.",
      properties: {
        tempo_conhece_mcf: { type: "string", description: "Há quanto tempo o lead conhece a MCF." },
        profissao: { type: "string", description: "Profissão atual do lead." },
        renda: { type: "string", description: "Renda mensal declarada." },
        ja_constroi: { type: "string", description: "Já constrói/construiu ou ainda não?" },
        possui_imovel: { type: "string", description: "Possui imóvel? Quais?" },
        possui_terreno: { type: "string", description: "Possui terreno? Onde?" },
        tem_socio: { type: "string", description: "Tem sócio na operação?" },
      },
      required: [
        "tempo_conhece_mcf",
        "profissao",
        "renda",
        "ja_constroi",
        "possui_imovel",
        "possui_terreno",
        "tem_socio",
      ],
    },
    next_steps: {
      type: "string",
      description: "Próximos passos sugeridos para o SDR/Closer (1-2 frases).",
    },
  },
  required: ["bullets", "discovery", "next_steps"],
};

async function summarizeWithAI(transcript: string): Promise<any> {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Transcrição da ligação:\n\n${transcript}\n\nGere o resumo estruturado.`,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "save_call_summary",
            description: "Salva o resumo estruturado da ligação.",
            parameters: TOOL_SCHEMA,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "save_call_summary" } },
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Lovable AI error ${resp.status}: ${txt}`);
  }
  const data = await resp.json();
  const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("AI did not return tool_call arguments");
  return JSON.parse(args);
}

function bulletsToText(summary: any, processedAt: string): string {
  const bullets = (summary.bullets || []).map((b: string) => `• ${b}`).join("\n");
  const d = summary.discovery || {};
  const discovery = [
    `Conhece MCF há: ${d.tempo_conhece_mcf || "não informado"}`,
    `Profissão: ${d.profissao || "não informado"}`,
    `Renda: ${d.renda || "não informado"}`,
    `Já constrói: ${d.ja_constroi || "não informado"}`,
    `Possui imóvel: ${d.possui_imovel || "não informado"}`,
    `Possui terreno: ${d.possui_terreno || "não informado"}`,
    `Tem sócio: ${d.tem_socio || "não informado"}`,
  ].join("\n");
  const dt = new Date(processedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  return `🤖 Resumo de Ligação IA — ${dt}\n\n${bullets}\n\n— Descoberta —\n${discovery}\n\n— Próximos passos —\n${summary.next_steps || "—"}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Twilio Voice Intelligence sends form-encoded payloads.
    let transcriptSid: string | null = null;
    let eventType: string | null = null;
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await req.json();
      transcriptSid = body.transcript_sid || body.TranscriptSid || null;
      eventType = body.event_type || body.EventType || null;
    } else {
      const fd = await req.formData();
      transcriptSid = (fd.get("transcript_sid") || fd.get("TranscriptSid"))?.toString() || null;
      eventType = (fd.get("event_type") || fd.get("EventType"))?.toString() || null;
    }

    console.log(`[transcript-callback] event=${eventType} sid=${transcriptSid}`);

    if (!transcriptSid) {
      return new Response(JSON.stringify({ ok: false, error: "missing transcript_sid" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only act on completed events. Other events (started, failed) are logged only.
    const isCompleted =
      !eventType || eventType.toLowerCase().includes("complete") || eventType === "transcript.completed";
    if (!isCompleted) {
      if (eventType?.toLowerCase().includes("fail")) {
        await supabase
          .from("calls")
          .update({ transcript_status: "failed", updated_at: new Date().toISOString() })
          .eq("transcript_sid", transcriptSid);
      }
      return new Response(JSON.stringify({ ok: true, ignored: eventType }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotency: skip if already processed.
    const { data: existing } = await supabase
      .from("calls")
      .select("id, deal_id, transcript_status")
      .eq("transcript_sid", transcriptSid)
      .maybeSingle();

    if (existing?.transcript_status === "completed") {
      console.log(`[transcript-callback] already processed: ${transcriptSid}`);
      return new Response(JSON.stringify({ ok: true, already_processed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let callId = existing?.id || null;
    let dealId = existing?.deal_id || null;

    // If we can't find the call by transcript_sid yet, try CustomerKey from Twilio meta.
    if (!callId) {
      const meta = await fetchTranscriptMeta(transcriptSid);
      const customerKey = meta?.customer_key;
      if (customerKey) {
        const { data: byKey } = await supabase
          .from("calls")
          .select("id, deal_id")
          .eq("id", customerKey)
          .maybeSingle();
        if (byKey) {
          callId = byKey.id;
          dealId = byKey.deal_id;
          await supabase
            .from("calls")
            .update({ transcript_sid: transcriptSid })
            .eq("id", callId);
        }
      }
    }

    if (!callId) {
      console.error(`[transcript-callback] cannot map transcript ${transcriptSid} to a call`);
      return new Response(JSON.stringify({ ok: false, error: "call not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch sentences from Twilio
    const transcriptText = await fetchSentences(transcriptSid);
    if (!transcriptText.trim()) {
      await supabase
        .from("calls")
        .update({ transcript_status: "failed", updated_at: new Date().toISOString() })
        .eq("id", callId);
      return new Response(JSON.stringify({ ok: false, error: "empty transcript" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Ask Lovable AI for the structured summary
    const summary = await summarizeWithAI(transcriptText);
    const processedAt = new Date().toISOString();
    const formattedNote = bulletsToText(summary, processedAt);

    // 3. Update the call row
    await supabase
      .from("calls")
      .update({
        ai_summary: summary,
        transcript_status: "completed",
        ai_processed_at: processedAt,
        summary: formattedNote,
        updated_at: processedAt,
      })
      .eq("id", callId);

    // 4. Update the deal: push into custom_fields.callSummaries history
    if (dealId) {
      const { data: dealRow } = await supabase
        .from("crm_deals")
        .select("custom_fields")
        .eq("id", dealId)
        .maybeSingle();
      const cf: any = dealRow?.custom_fields || {};
      const history: any[] = Array.isArray(cf.callSummaries) ? cf.callSummaries : [];
      history.unshift({
        call_id: callId,
        processed_at: processedAt,
        bullets: summary.bullets,
        discovery: summary.discovery,
        next_steps: summary.next_steps,
      });
      cf.callSummaries = history.slice(0, 50);
      cf.lastCallSummaryAt = processedAt;
      await supabase
        .from("crm_deals")
        .update({ custom_fields: cf, updated_at: processedAt })
        .eq("id", dealId);

      // 5. Insert attendee_notes for every meeting_slot_attendee tied to this deal
      //    (R1 + R2 + futuros — useAttendeeNotes já busca todos os attendees do deal)
      const { data: attendees } = await supabase
        .from("meeting_slot_attendees")
        .select("id")
        .eq("deal_id", dealId);

      if (attendees && attendees.length > 0) {
        const rows = attendees.map((a) => ({
          attendee_id: a.id,
          note: formattedNote,
          note_type: "call_summary",
          created_by: null,
        }));
        const { error: notesErr } = await supabase.from("attendee_notes").insert(rows);
        if (notesErr) console.error("[transcript-callback] attendee_notes insert error:", notesErr);
      }

      // 6. Timeline entry
      await supabase.from("deal_activities").insert({
        deal_id: dealId,
        activity_type: "ai_call_summary",
        description: `Resumo IA da ligação (${summary.bullets?.length || 0} pontos)`,
        metadata: {
          call_id: callId,
          transcript_sid: transcriptSid,
          summary,
        },
      });
    }

    console.log(`[transcript-callback] ✅ processed transcript=${transcriptSid} call=${callId} deal=${dealId}`);

    return new Response(JSON.stringify({ ok: true, call_id: callId, deal_id: dealId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[transcript-callback] error:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});