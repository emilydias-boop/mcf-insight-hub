// Transcrição + resumo IA das gravações de ligação da Sonax.
// Roda por cron, sempre ASSÍNCRONO — nunca dentro do webhook da Sonax.
// Molde: supabase/functions/meetgeek-analisar/index.ts (mesmo claim, mesma
// política de retentativa, mesma classe IAQuotaError, mesmo chamarIA).
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOTE_PADRAO = 3;
const LOTE_MAX = 10;
const MAX_TENTATIVAS = 3;
const MAX_AUDIO_BYTES = 20 * 1024 * 1024; // 20 MB
const SONAX_BASE = "https://api.sonax.net.br/a2billing_v2/admin/Public/dbdial_webapi.php";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

class IAQuotaError extends Error {}

type Item = {
  id: string;
  call_event_id: string | null;
  deal_id: string | null;
  id_chamada: string;
  duracao_segundos: number | null;
  tentativas: number;
};

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

// btoa estoura com string gigante: converte em blocos de 32 KB.
function paraBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const passo = 32768;
  for (let i = 0; i < bytes.length; i += passo) {
    bin += String.fromCharCode(...bytes.subarray(i, i + passo));
  }
  return btoa(bin);
}

const SCHEMA = {
  type: "object",
  properties: {
    bullets: {
      type: "array",
      items: { type: "string" },
      description: "exatamente 3 frases curtas do que aconteceu na ligacao",
    },
    next_steps: { type: "string", description: "proximo passo concreto" },
    discovery: {
      type: "object",
      properties: {
        renda: { type: "string" },
        renda_mensal: {
          type: "number",
          description: "renda mensal do lead em reais, apenas o numero; 0 quando nao informado",
        },
        socio: { type: "string" },
        profissao: { type: "string" },
        tempo_mcf: { type: "string" },
        constroi_venda: { type: "string" },
        terreno_imovel: { type: "string" },
        finalidade_obra: { type: "string" },
      },
      required: [
        "renda",
        "renda_mensal",
        "socio",
        "profissao",
        "tempo_mcf",
        "constroi_venda",
        "terreno_imovel",
        "finalidade_obra",
      ],
      additionalProperties: false,
    },
  },
  required: ["bullets", "next_steps", "discovery"],
  additionalProperties: false,
};

function configIA() {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");

  if (lovableKey) {
    return { url: GATEWAY_URL, key: lovableKey, modelo: "google/gemini-2.5-flash" };
  }
  if (openaiKey) {
    return { url: "https://api.openai.com/v1/chat/completions", key: openaiKey, modelo: "gpt-4o-mini" };
  }
  return null;
}

// Erro de formato/áudio não suportado cai aqui como erro comum (retentativa),
// com a mensagem crua preservada: é ela que vai dizer se trocamos de provedor.
async function postIA(cfg: { url: string; key: string }, body: unknown) {
  const res = await fetch(cfg.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  // 429/402 são transitórios: classe própria para não queimar a ligação.
  if (res.status === 429 || res.status === 402) throw new IAQuotaError(`IA ${res.status}`);
  if (!res.ok) throw new Error(`IA ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const out = await res.json();
  const conteudo = out?.choices?.[0]?.message?.content;
  if (!conteudo) throw new Error("IA devolveu resposta vazia");
  return String(conteudo);
}

async function transcrever(
  cfg: { url: string; key: string; modelo: string },
  audioBase64: string,
): Promise<string> {
  const texto = await postIA(cfg, {
    model: cfg.modelo,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "Transcreva literalmente esta ligação telefônica em português do Brasil. " +
              "Não resuma, não corrija, não invente fala. Quando for possível distinguir " +
              "as vozes, marque cada fala com \"SDR:\" (quem ligou, da MCF Capital) ou " +
              "\"LEAD:\" (quem recebeu a ligação), uma fala por linha. " +
              "Se não der para distinguir, transcreva sem os marcadores.",
          },
          { type: "input_audio", input_audio: { data: audioBase64, format: "wav" } },
        ],
      },
    ],
  });

  const limpo = texto.trim();
  if (!limpo) throw new Error("transcricao vazia");
  return limpo;
}

function montarPromptResumo(transcricao: string) {
  return `Você analisa ligações de prospecção da MCF Capital, mentoria de incorporação imobiliária. Quem liga é o SDR; quem recebe é o lead.

REGRAS:
- "bullets": exatamente 3 frases curtas sobre o que aconteceu na ligação.
- "next_steps": o próximo passo concreto, em uma frase.
- Preencha cada campo de "discovery" SOMENTE com o que o lead disse nesta ligação. Nunca deduza, nunca complete com o que seria plausível.
- Campo sem informação na ligação = exatamente a string: não informado
- "renda": transcreva o que o lead falou, com o número (ex.: "Ganha cerca de 10 mil por mês"). Não converta e não arredonde.
- "renda_mensal": o MESMO valor da renda convertido em número puro de reais (ex.: "oito mil" vira 8000, "10k" vira 10000, "R$ 12.500" vira 12500). Se o lead falou faixa, use o menor valor. Se o lead falou renda do casal ou da família, use o valor total mencionado. Se não informou renda, use 0.
- "finalidade_obra": use exatamente uma destas opções, quando o lead deixar claro: Construir para morar | Construir para vender ou investir | Construir para alugar. Se não ficou claro: não informado
- "constroi_venda" é EXPERIÊNCIA (se o lead já constrói hoje), não intenção futura.
- "tempo_mcf": há quanto tempo o lead conhece a MCF.
- "socio": se o lead tem sócio no negócio/obra.
- "terreno_imovel": se o lead possui terreno e/ou imóvel.
- Responda em português do Brasil.

TRANSCRIÇÃO:
${transcricao}`;
}

async function resumir(
  cfg: { url: string; key: string; modelo: string },
  transcricao: string,
): Promise<Record<string, unknown>> {
  const conteudo = await postIA(cfg, {
    model: cfg.modelo,
    messages: [{ role: "user", content: montarPromptResumo(transcricao) }],
    response_format: {
      type: "json_schema",
      json_schema: { name: "resumo_ligacao", strict: true, schema: SCHEMA },
    },
  });
  return JSON.parse(conteudo);
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

  const cfg = configIA();
  if (!cfg) return jsonResp({ error: "nenhuma chave de IA configurada (LOVABLE_API_KEY ou OPENAI_API_KEY)" }, 500);

  const idCliente = Deno.env.get("SONAX_ID_CLIENTE") ?? "";
  const token = Deno.env.get("SONAX_TOKEN") ?? "";
  if (!idCliente || !token) return jsonResp({ error: "credenciais Sonax ausentes" }, 500);

  // Claim atômico (FOR UPDATE SKIP LOCKED): duas rodadas sobrepostas não
  // mandam a mesma gravação duas vezes para a IA.
  const { data: fila, error: filaErr } = await supabase
    .rpc("sonax_reivindicar_analise", { _lote: lote });

  if (filaErr) return jsonResp({ error: filaErr.message }, 500);
  if (!fila || (fila as Item[]).length === 0) {
    return jsonResp({ reivindicadas: 0, mensagem: "fila vazia" });
  }

  const resultado = { ok: 0, erro: 0, ignorado: 0, quota: false };
  let processadas = 0;

  for (const item of fila as Item[]) {
    try {
      // ---- 1. baixa o áudio da Sonax ------------------------------------
      const alvo = new URL(SONAX_BASE);
      alvo.searchParams.set("acao", "pega_gravacao");
      alvo.searchParams.set("id_cliente", idCliente);
      alvo.searchParams.set("token", token);
      alvo.searchParams.set("id_chamada", item.id_chamada);

      const upstream = await fetch(alvo.toString(), { method: "GET" });
      const buf = await upstream.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const isRiff = bytes.length >= 4 &&
        bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;

      // Sem RIFF é a resposta de texto "404 not found". NÃO retentar: não muda
      // e a Sonax bloqueia o token após três 404 consecutivos.
      if (!isRiff) {
        await supabase.from("sonax_call_ai")
          .update({ status: "ignorado", erro: "gravacao_indisponivel" }).eq("id", item.id);
        resultado.ignorado++;
        processadas++;
        continue;
      }

      if (buf.byteLength > MAX_AUDIO_BYTES) {
        await supabase.from("sonax_call_ai")
          .update({ status: "ignorado", erro: "audio_muito_grande" }).eq("id", item.id);
        resultado.ignorado++;
        processadas++;
        continue;
      }

      // ---- 2. transcreve e 3. extrai -----------------------------------
      const transcricao = await transcrever(cfg, paraBase64(buf));
      const dados = await resumir(cfg, transcricao);
      const discovery = (dados.discovery ?? {}) as Record<string, unknown>;

      // ---- 4. grava o resultado ----------------------------------------
      const { error: upErr } = await supabase.from("sonax_call_ai").update({
        transcricao,
        resumo: dados,
        modelo: cfg.modelo,
        status: "analisado",
        analisado_em: new Date().toISOString(),
        erro: null,
      }).eq("id", item.id);
      if (upErr) throw new Error(`gravar analise: ${upErr.message}`);

      // ---- 5. atividade no negócio e 6. propagação ---------------------
      // Sem deal vinculado (cold call) não há para onde propagar — a análise
      // fica gravada em sonax_call_ai e o item é encerrado como ok.
      if (item.deal_id) {
        await supabase.from("deal_activities").insert({
          deal_id: String(item.deal_id), // a coluna é text, não uuid
          activity_type: "ai_call_summary",
          description: "Resumo IA da ligação (3 pontos)",
          user_id: null,
          metadata: {
            id_chamada: item.id_chamada,
            call_event_id: item.call_event_id,
            modelo: cfg.modelo,
            summary: {
              bullets: dados.bullets ?? [],
              discovery,
              next_steps: dados.next_steps ?? null,
            },
          },
        });

        const { data: prop } = await supabase.rpc("propagar_qualificacao", {
          _deal_id: item.deal_id,
          _respostas: discovery,
          _origem: "ia",
          _fonte: item.id_chamada,
        });

        if (prop !== null && prop !== undefined) {
          await supabase.from("sonax_call_ai").update({ propagacao: prop }).eq("id", item.id);
        }
      }

      resultado.ok++;
      processadas++;
    } catch (e) {
      // Quota de IA: devolve para a fila SEM contar tentativa e para a rodada.
      if (e instanceof IAQuotaError) {
        resultado.quota = true;
        await supabase.from("sonax_call_ai").update({
          status: "pendente",
          tentativas: Math.max(0, (item.tentativas ?? 0) - 1),
        }).eq("id", item.id);
        console.warn("[sonax-ligacao-analisar] quota de IA, interrompendo rodada");
        break;
      }

      const msg = String(e).slice(0, 500);
      console.error("[sonax-ligacao-analisar] falha", item.id, msg);
      await supabase.from("sonax_call_ai").update({
        // volta para a fila até esgotar as tentativas
        status: (item.tentativas ?? 0) >= MAX_TENTATIVAS ? "erro" : "pendente",
        erro: msg,
      }).eq("id", item.id);
      resultado.erro++;
      processadas++;
    }
  }

  const saida = {
    reivindicadas: (fila as Item[]).length,
    processadas,
    ...resultado,
    duracao_ms: Date.now() - iniciado,
  };
  console.log("[sonax-ligacao-analisar]", saida);
  return jsonResp(saida);
});
