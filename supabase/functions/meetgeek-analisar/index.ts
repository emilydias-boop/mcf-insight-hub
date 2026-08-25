// Avaliação de aderência ao script: lê transcrições já ingeridas e pontua
// cada etapa do script de vendas, com o trecho que comprova.
// Roda por cron, sempre ASSÍNCRONO — nunca dentro do webhook.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOTE_PADRAO = 3;
const LOTE_MAX = 10;
const MAX_TENTATIVAS = 3;
// gemini-2.5-flash tem 1M de contexto: teto alto para o corte nunca comer o
// miolo do script (diagnóstico e objeções ficam no meio da conversa).
const MAX_CHARS_TRANSCRICAO = 400_000;

type Sentence = { speaker?: string; transcript?: string; timestamp?: string };
type Etapa = {
  ordem: number; etapa: string; descricao: string | null;
  criterio: string; peso: number; obrigatoria: boolean; versao: number;
};
type EtapaAvaliada = { ordem: number; cumpriu: string; nota: number };

class IAQuotaError extends Error {}

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clamp(v: unknown, padrao: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return padrao;
  return Math.min(Math.max(1, Math.trunc(n)), max);
}

function montarTexto(sentences: Sentence[]): { texto: string; truncado: boolean } {
  const linhas = sentences.map((s) => `${s.speaker ?? "?"}: ${s.transcript ?? ""}`);
  let texto = linhas.join("\n");
  let truncado = false;
  if (texto.length > MAX_CHARS_TRANSCRICAO) {
    const metade = Math.floor(MAX_CHARS_TRANSCRICAO / 2);
    texto = texto.slice(0, metade) +
      "\n\n[...trecho do meio omitido por tamanho...]\n\n" +
      texto.slice(-metade);
    truncado = true;
  }
  return { texto, truncado };
}

function montarPrompt(etapas: Etapa[], tipo: string, texto: string, truncado: boolean) {
  const lista = etapas.map((e) =>
    `${e.ordem}. ${e.etapa} (peso ${e.peso}${e.obrigatoria ? "" : ", opcional"})\n` +
    `   O que é: ${e.descricao ?? "-"}\n` +
    `   Cumpriu se: ${e.criterio}`
  ).join("\n\n");

  return `Você avalia reuniões de vendas da MCF Capital (mentoria de incorporação imobiliária).
Esta é uma reunião do tipo ${tipo.toUpperCase()}.

Sua tarefa: dizer, para cada etapa do script abaixo, se o closer cumpriu, com que qualidade, e QUAL TRECHO DA TRANSCRIÇÃO comprova isso.

REGRAS:
- Devolva EXATAMENTE ${etapas.length} itens em "etapas", um para cada etapa listada, na mesma ordem. Não omita nenhuma.
- "cumpriu" deve ser: "sim", "nao" ou "nao_aplicavel".
- Use "nao_aplicavel" APENAS em etapa marcada como opcional cuja situação não ocorreu (ex.: o lead não levantou nenhuma objeção). Nunca use em etapa obrigatória.
- A evidência deve ser uma citação literal e curta da transcrição. Nunca invente fala.
- Se não houver evidência, "cumpriu" = "nao" e evidencia vazia. Não dê benefício da dúvida.
- "nota" de cada etapa: 0 a 10. Se cumpriu for "nao" ou "nao_aplicavel", nota = 0.
- Seja específico e direto nos pontos de melhoria. Nada de conselho genérico.
- Responda em português do Brasil.
${truncado ? "- ATENÇÃO: o meio da transcrição foi omitido por tamanho. Considere isso antes de afirmar que algo não aconteceu.\n" : ""}
ETAPAS DO SCRIPT:
${lista}

TRANSCRIÇÃO:
${texto}`;
}

// Sem type-arrays anuláveis: o subset de JSON Schema do Google não aceita
// `type: ["boolean","null"]`. Enum de string funciona nos dois provedores.
const SCHEMA = {
  type: "object",
  properties: {
    nota_geral: { type: "number", description: "0 a 10, considerando os pesos das etapas" },
    resumo: { type: "string", description: "2 a 4 frases sobre como foi a reuniao" },
    pontos_fortes: { type: "array", items: { type: "string" } },
    pontos_melhoria: { type: "array", items: { type: "string" } },
    etapas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          ordem: { type: "number" },
          etapa: { type: "string" },
          cumpriu: { type: "string", enum: ["sim", "nao", "nao_aplicavel"] },
          nota: { type: "number" },
          evidencia: { type: "string" },
          comentario: { type: "string" },
        },
        required: ["ordem", "etapa", "cumpriu", "nota", "evidencia", "comentario"],
        additionalProperties: false,
      },
    },
  },
  required: ["nota_geral", "resumo", "pontos_fortes", "pontos_melhoria", "etapas"],
  additionalProperties: false,
};

async function chamarIA(prompt: string): Promise<{ dados: Record<string, unknown>; modelo: string }> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");

  const cfg = lovableKey
    ? { url: "https://ai.gateway.lovable.dev/v1/chat/completions", key: lovableKey, modelo: "google/gemini-2.5-flash" }
    : openaiKey
    ? { url: "https://api.openai.com/v1/chat/completions", key: openaiKey, modelo: "gpt-4o-mini" }
    : null;

  if (!cfg) throw new Error("nenhuma chave de IA configurada (LOVABLE_API_KEY ou OPENAI_API_KEY)");

  const res = await fetch(cfg.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: cfg.modelo,
      messages: [{ role: "user", content: prompt }],
      response_format: {
        type: "json_schema",
        json_schema: { name: "avaliacao_reuniao", strict: true, schema: SCHEMA },
      },
    }),
  });

  // 429/402 são transitórios: classe própria para não queimar a reunião.
  if (res.status === 429 || res.status === 402) {
    throw new IAQuotaError(`IA ${res.status}`);
  }
  if (!res.ok) throw new Error(`IA ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const out = await res.json();
  const conteudo = out?.choices?.[0]?.message?.content;
  if (!conteudo) throw new Error("IA devolveu resposta vazia");

  return { dados: JSON.parse(conteudo), modelo: cfg.modelo };
}

// Etapa AUSENTE na resposta conta como não cumprida. Antes ela saía do
// denominador e inflava a aderência — métrica que mente é pior que métrica ausente.
function calcularAderencia(etapas: Etapa[], avaliadas: EtapaAvaliada[]) {
  let pesoTotal = 0;
  let pesoCumprido = 0;
  for (const e of etapas) {
    const a = avaliadas.find((x) => Number(x.ordem) === e.ordem);
    if (a && a.cumpriu === "nao_aplicavel") continue; // situacao nao ocorreu: sai da conta
    pesoTotal += Number(e.peso);
    if (a && a.cumpriu === "sim") pesoCumprido += Number(e.peso);
  }
  return pesoTotal > 0 ? Math.round((pesoCumprido / pesoTotal) * 10000) / 100 : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const url = new URL(req.url);
  let lote = clamp(url.searchParams.get("lote"), LOTE_PADRAO, LOTE_MAX);
  if (req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    if (body?.lote !== undefined) lote = clamp(body.lote, LOTE_PADRAO, LOTE_MAX);
  }

  const iniciado = Date.now();

  // Claim atomico (FOR UPDATE SKIP LOCKED): duas rodadas sobrepostas nao
  // mandam a mesma transcricao duas vezes para a IA.
  const { data: fila, error: filaErr } = await supabase
    .rpc("meetgeek_reivindicar_analise", { _lote: lote });

  if (filaErr) return jsonResp({ error: filaErr.message }, 500);
  if (!fila || fila.length === 0) return jsonResp({ reivindicadas: 0, mensagem: "fila vazia" });

  const resultado = { ok: 0, erro: 0, sem_script: 0, quota: false };
  let processadas = 0;

  for (const item of fila as Array<{
    id: string; meeting_slot_id: string | null; closer_id: string | null;
    meeting_type: string | null; analysis_attempts: number;
  }>) {
    try {
      // O claim so entrega linhas com slot, entao o tipo vem do slot de verdade.
      const tipo = item.meeting_type ?? "r1";

      const { data: etapasRaw } = await supabase
        .from("sales_script_steps")
        .select("ordem, etapa, descricao, criterio, peso, obrigatoria, versao")
        .eq("meeting_type", tipo)
        .eq("is_active", true)
        .order("versao", { ascending: false })
        .order("ordem", { ascending: true });

      if (!etapasRaw || etapasRaw.length === 0) {
        await supabase.from("meeting_recordings")
          .update({ analysis_status: "ignorado" }).eq("id", item.id);
        resultado.sem_script++;
        processadas++;
        continue;
      }

      const todas = etapasRaw as unknown as Etapa[];
      const versao = todas[0].versao;
      const doVersao = todas.filter((e) => e.versao === versao);

      // A transcricao nao vem no claim (e pesada): busca so a coluna necessaria.
      const { data: rec } = await supabase
        .from("meeting_recordings").select("transcript").eq("id", item.id).single();

      const sentences = ((rec?.transcript ?? []) as Sentence[]);
      if (sentences.length === 0) throw new Error("transcricao vazia no momento da analise");

      const { texto, truncado } = montarTexto(sentences);
      const { dados, modelo } = await chamarIA(montarPrompt(doVersao, tipo, texto, truncado));

      const avaliadas = (dados.etapas ?? []) as EtapaAvaliada[];

      // Resposta incompleta e motivo para retentar, nao para gravar numero errado.
      if (avaliadas.length !== doVersao.length) {
        throw new Error(`IA devolveu ${avaliadas.length} etapas, esperado ${doVersao.length}`);
      }

      const aderencia = calcularAderencia(doVersao, avaliadas);
      const notaBruta = Number(dados.nota_geral);
      const nota = Number.isFinite(notaBruta) ? Math.min(10, Math.max(0, notaBruta)) : null;

      const { error: insErr } = await supabase.from("meeting_ai_reviews").upsert({
        recording_id: item.id,
        meeting_slot_id: item.meeting_slot_id,
        closer_id: item.closer_id,
        script_versao: versao,
        meeting_type: tipo,
        nota_geral: nota,
        aderencia_pct: aderencia,
        etapas: dados.etapas ?? [],
        pontos_fortes: dados.pontos_fortes ?? [],
        pontos_melhoria: dados.pontos_melhoria ?? [],
        resumo: dados.resumo ?? null,
        modelo,
      }, { onConflict: "recording_id,script_versao" });

      if (insErr) throw new Error(`gravar avaliacao: ${insErr.message}`);

      await supabase.from("meeting_recordings")
        .update({ analysis_status: "analisado", analysis_error: null }).eq("id", item.id);

      resultado.ok++;
      processadas++;
    } catch (e) {
      // Quota de IA: devolve para a fila SEM contar tentativa e para a rodada.
      if (e instanceof IAQuotaError) {
        resultado.quota = true;
        await supabase.from("meeting_recordings").update({
          analysis_status: "pendente",
          analysis_attempts: Math.max(0, item.analysis_attempts - 1),
        }).eq("id", item.id);
        console.warn("[meetgeek-analisar] quota de IA, interrompendo rodada");
        break;
      }

      const msg = String(e).slice(0, 500);
      console.error("[meetgeek-analisar] falha", item.id, msg);
      await supabase.from("meeting_recordings").update({
        // volta para a fila ate esgotar as tentativas
        analysis_status: item.analysis_attempts >= MAX_TENTATIVAS ? "erro" : "pendente",
        analysis_error: msg,   // coluna propria: nao sobrescreve o erro da ingestao
      }).eq("id", item.id);
      resultado.erro++;
      processadas++;
    }
  }

  const saida = {
    reivindicadas: fila.length, processadas, ...resultado,
    duracao_ms: Date.now() - iniciado,
  };
  console.log("[meetgeek-analisar]", saida);
  return jsonResp(saida);
});
