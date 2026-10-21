// Gera um RASCUNHO de script a partir das transcrições de reuniões piloto.
// Não grava nada: devolve as etapas para o editor; só vira oficial no "Publicar".
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const MAX_CHARS_POR_REUNIAO = 120_000;
const Body = z.object({
  recording_ids: z.array(z.string().uuid()).min(1).max(5),
  meeting_type: z.enum(["r1", "r2"]).default("r1"),
});

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["etapas"],
  properties: {
    etapas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["etapa", "descricao", "criterio", "peso", "obrigatoria", "exemplo"],
        properties: {
          etapa: { type: "string" },
          descricao: { type: "string" },
          criterio: { type: "string" },
          peso: { type: "number" },
          obrigatoria: { type: "boolean" },
          exemplo: { type: "string" },
        },
      },
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "Faça login." }, 401);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", u.user.id);
    const ok = (roles ?? []).some((r) => r.role === "admin" || r.role === "manager");
    if (!ok) return json({ error: "Somente admin ou gerente pode gerar o script." }, 403);

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "Selecione de 1 a 5 reuniões piloto." }, 400);
    const { recording_ids, meeting_type } = parsed.data;

    const { data: recs, error } = await admin
      .from("meeting_recordings").select("id, transcript").in("id", recording_ids);
    if (error) throw error;

    const blocos = (recs ?? []).map((r, i) => {
      const linhas = ((r.transcript ?? []) as Array<{ speaker?: string; transcript?: string }>)
        .map((s) => `${s.speaker ?? "?"}: ${s.transcript ?? ""}`).join("\n");
      return `=== REUNIÃO PILOTO ${i + 1} ===\n${linhas.slice(0, MAX_CHARS_POR_REUNIAO)}`;
    }).filter((b) => b.length > 40);
    if (blocos.length === 0) return json({ error: "As reuniões escolhidas não têm transcrição." }, 422);

    const prompt = `Você analisa reuniões ${meeting_type.toUpperCase()} de vendas da MCF Capital (mentoria de incorporação imobiliária) que venderam contrato para 2 ou 3 participantes ao mesmo tempo.
Extraia o ROTEIRO comum que o closer seguiu e devolva de 5 a 12 etapas, na ordem em que acontecem.
Para cada etapa:
- etapa: nome curto.
- descricao: o que acontece, para humanos.
- criterio: regra objetiva e verificável na transcrição para dizer se foi cumprida (ex.: "O lead declara um objetivo com número ou prazo, provocado por pergunta do closer"). Nada vago.
- peso: 1 a 3 (3 = decisivo para a venda).
- obrigatoria: false apenas para etapas situacionais (ex.: tratar objeção).
- exemplo: citação literal e curta de uma das transcrições. Nunca invente fala.
Responda em português do Brasil.

${blocos.join("\n\n")}`;

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ error: "IA não configurada." }, 500);
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        reasoning: { effort: "low" },
        input: prompt,
        text: { format: { type: "json_schema", name: "script_piloto", strict: true, schema: SCHEMA } },
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error("[gerar-script-piloto] IA", res.status, t.slice(0, 300));
      const msg = res.status === 429 ? "Muitas solicitações à IA agora. Tente em alguns minutos."
        : res.status === 402 ? "Créditos de IA esgotados." : "A IA não conseguiu gerar o script.";
      return json({ error: msg }, res.status);
    }
    const out = await res.json();
    const texto = out.output_text ??
      out.output?.flatMap((o: { content?: Array<{ text?: string }> }) => o.content ?? [])
        .map((c: { text?: string }) => c.text ?? "").join("");
    if (!texto) return json({ error: "A IA não devolveu etapas." }, 502);
    const dados = JSON.parse(texto);
    return json({ etapas: dados.etapas ?? [], reunioes: blocos.length });
  } catch (e) {
    console.error("[gerar-script-piloto]", String(e).slice(0, 300));
    return json({ error: "Falha ao gerar o script." }, 500);
  }
});
