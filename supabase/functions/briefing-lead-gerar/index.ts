// Briefing do lead (IA) para o closer — fase 1: PIPELINE INSIDE SALES.
// Molde: supabase/functions/sonax-ligacao-analisar/index.ts (configIA, IAQuotaError).
// Nunca devolve o conteúdo do briefing na resposta HTTP: a rodada do cron não exige JWT.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOTE_PADRAO = 5;
const LOTE_MAX = 10;
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class IAQuotaError extends Error {}

type Item = { deal_id: string; fontes_hash: string | null; conteudo: unknown };

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

const FONTES = ["anamnese", "qualificacao", "agendamento", "nota_closer", "nota_equipe", "contato", "ligacao", "r1", "r2", "pagamento", "agenda"];
const fontesProp = { type: "array", items: { type: "string", enum: FONTES } };
const item = (extra: Record<string, unknown> = {}) => ({
  type: "object",
  properties: { ...extra, texto: { type: "string" }, fontes: fontesProp },
  required: [...Object.keys(extra), "texto", "fontes"],
  additionalProperties: false,
});

const SCHEMA = {
  type: "object",
  properties: {
    resumo_curto: { type: "string", description: "1 linha, até 120 caracteres" },
    alerta_curto: { type: "string", description: "1 linha com o risco/divergência mais importante, ou vazio" },
    quem_e: { type: "array", items: item({ rotulo: { type: "string" } }) },
    como_chegou: { type: "array", items: item() },
    ja_falado: { type: "array", items: item() },
    combinado: { type: "array", items: item() },
    atencao: { type: "array", items: item({ tipo: { type: "string", enum: ["risco", "divergencia", "lacuna"] } }) },
    perguntas: { type: "array", items: { type: "string" } },
  },
  required: ["resumo_curto", "alerta_curto", "quem_e", "como_chegou", "ja_falado", "combinado", "atencao", "perguntas"],
  additionalProperties: false,
};

function prompt(momento: string, nome: string, json: string) {
  return `Você prepara o briefing que o closer da MCF Capital lê antes da ${momento} com o lead ${nome}. A MCF é uma mentoria de incorporação imobiliária; o closer vende a parceria. Use SOMENTE o JSON de CONTEXTO abaixo.
REGRAS
- Nunca deduza nem complete com o que seria plausível. Só escreva o que está no contexto.
- Cada item tem "fontes": anamnese (formulário de entrada), qualificacao (qualificação do SDR), agendamento (nota_do_agendamento da reunião), nota_closer (nota_do_closer, observacao_r2, notas_extras, motivo_resultado), nota_equipe (notas_da_equipe), contato (registros_de_contato), ligacao (resumos_de_ligacao), r1 / r2 (gravação da reunião desse tipo), pagamento (compras_e_pagamentos), agenda (datas e status das reuniões).
- quem_e: até 7 linhas, rótulos curtos: Profissão, Renda, Experiência, Terreno, Sócio, Objetivo, Aporte, Já comprou. Se duas fontes dão valores diferentes, mostre os dois na mesma linha, cada um com sua fonte.
- como_chegou: até 4 linhas em ordem de data (canal de entrada, anamnese, ligações/contatos, qualificação, agendamento).
- ja_falado e combinado: só o que aconteceu em reuniões anteriores (R1 realizada, no-show, combinados da gravação). Na primeira R1 sem histórico, deixe vazio.
- atencao:
  - risco: situacao_credito negativado ou com restrição, possui_divida, tentou_financiamento recusado, caução reembolsada, no-show repetido, lead que disse não ser decisor.
  - divergencia: duas fontes que se contradizem (renda, empresário, terreno, sócio, experiência) e segmento_crm diferente de classificacao_formulario. Cite as duas fontes.
  - lacuna: renda, terreno, sócio, experiência ou objetivo que não aparecem em nenhuma fonte; combinado da R1 sem registro de que foi feito.
- REUNIÃO EM GRUPO: se a reunião tem "outros_participantes_no_horario", o resumo da gravação fala de várias pessoas. Use apenas o que for claramente sobre ${nome}; na dúvida, não use. Se "lead_estava_na_gravacao" for false, ignore a gravação.
- Status de reunião: invited = agendada, completed = realizada, no_show = faltou, contract_paid = pagou o contrato na reunião, desistencia = desistiu, rescheduled = reagendada.
- faixa_aporte é a faixa do formulário em milhares (50 = R$ 50 mil). Não interprete códigos que você não entende (ex.: urgencia_operacao "1_3"): omita.
- perguntas: 2 a 4 perguntas para o closer fazer, tiradas das lacunas, divergências e riscos.
- Nunca inclua telefone, e-mail, CPF ou Instagram.
- Frases curtas (até 20 palavras), datas DD/MM, valores em R$, português do Brasil.
CONTEXTO
${json}`;
}

function configIA() {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (lovableKey) return { url: GATEWAY_URL, key: lovableKey, modelo: "google/gemini-2.5-flash" };
  if (openaiKey) return { url: "https://api.openai.com/v1/chat/completions", key: openaiKey, modelo: "gpt-4o-mini" };
  return null;
}

async function chamarIA(cfg: { url: string; key: string; modelo: string }, texto: string) {
  const res = await fetch(cfg.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: cfg.modelo,
      messages: [{ role: "user", content: texto }],
      response_format: { type: "json_schema", json_schema: { name: "briefing_lead", strict: true, schema: SCHEMA } },
    }),
  });
  if (res.status === 429 || res.status === 402) {
    await res.text();
    throw new IAQuotaError(`IA ${res.status}`);
  }
  if (!res.ok) throw new Error(`IA ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const out = await res.json();
  const conteudo = out?.choices?.[0]?.message?.content;
  if (!conteudo) throw new Error("IA devolveu resposta vazia");
  return JSON.parse(String(conteudo));
}

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// deno-lint-ignore no-explicit-any
function temFontes(ctx: any): boolean {
  if (ctx?.anamnese && Object.keys(ctx.anamnese).length) return true;
  if (ctx?.qualificacao_sdr) return true;
  if (Array.isArray(ctx?.notas_da_equipe) && ctx.notas_da_equipe.length) return true;
  // deno-lint-ignore no-explicit-any
  return Array.isArray(ctx?.reunioes) && ctx.reunioes.some((r: any) =>
    r?.nota_do_agendamento || r?.nota_do_closer || r?.observacao_r2 || r?.motivo_resultado ||
    (Array.isArray(r?.notas_extras) && r.notas_extras.length) || r?.gravacao
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResp({ error: "método não permitido" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // deno-lint-ignore no-explicit-any
  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }

  let itens: Item[] = [];
  if (body?.deal_id !== undefined && body?.deal_id !== null) {
    const dealId = String(body.deal_id);
    if (!UUID_RE.test(dealId)) return jsonResp({ error: "deal_id inválido" }, 400);
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return jsonResp({ error: "não autenticado" }, 401);
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: claims, error: cErr } = await userClient.auth.getClaims(auth.replace("Bearer ", ""));
    if (cErr || !claims?.claims?.sub) return jsonResp({ error: "não autenticado" }, 401);
    const { data: vis } = await userClient.from("crm_deals").select("id").eq("id", dealId).maybeSingle();
    if (!vis) return jsonResp({ error: "sem acesso a este negócio" }, 403);
    const { data, error } = await admin.rpc("reivindicar_briefing", { p_deal_id: dealId });
    if (error) return jsonResp({ error: error.message }, 500);
    itens = (data ?? []) as Item[];
  } else {
    const { data, error } = await admin.rpc("reivindicar_briefings", { _lote: clamp(body?.lote, LOTE_PADRAO, LOTE_MAX) });
    if (error) return jsonResp({ error: error.message }, 500);
    itens = (data ?? []) as Item[];
  }

  const cfg = configIA();
  const cont = { reivindicados: itens.length, gerados: 0, sem_mudanca: 0, sem_fontes: 0, erros: 0, devolvidos: 0 };
  const salvar = (id: string, status: string, conteudo: unknown, hash: string | null, modelo: string | null, momento: string | null, erro: string | null, gerou: boolean) =>
    admin.rpc("salvar_briefing", {
      p_deal_id: id, p_status: status, p_conteudo: conteudo, p_hash: hash, p_modelo: modelo,
      p_momento: momento, p_erro: erro, p_gerou: gerou,
    });

  for (let i = 0; i < itens.length; i++) {
    const it = itens[i];
    try {
      const { data: ctx, error } = await admin.rpc("montar_contexto_briefing", { p_deal_id: it.deal_id });
      if (error) throw new Error(error.message);
      if (!ctx) throw new Error("negócio não encontrado");
      // deno-lint-ignore no-explicit-any
      const { hoje: _hoje, ...semHoje } = ctx as any;
      const hash = await sha256(JSON.stringify(semHoje));
      const momento = (ctx as { momento?: string }).momento ?? null;

      if (hash === it.fontes_hash && it.conteudo) {
        await salvar(it.deal_id, "pronto", null, hash, null, momento, null, false);
        cont.sem_mudanca++;
        continue;
      }
      if (!temFontes(ctx)) {
        await salvar(it.deal_id, "sem_fontes", null, hash, null, momento, null, false);
        cont.sem_fontes++;
        continue;
      }
      if (!cfg) throw new Error("IA não configurada (LOVABLE_API_KEY/OPENAI_API_KEY)");
      const nome = (ctx as { lead?: { nome?: string } }).lead?.nome ?? "o lead";
      const conteudo = await chamarIA(cfg, prompt(momento ?? "R1", nome, JSON.stringify(ctx)));
      await salvar(it.deal_id, "pronto", conteudo, hash, cfg.modelo, momento, null, true);
      cont.gerados++;
    } catch (e) {
      if (e instanceof IAQuotaError) {
        // Devolve este e os restantes para a fila e encerra a rodada.
        for (const resto of itens.slice(i)) {
          await salvar(resto.deal_id, "pendente", null, null, null, null, e.message, false);
          cont.devolvidos++;
        }
        return jsonResp({ ok: false, motivo: "quota", ...cont }, 429);
      }
      const msg = e instanceof Error ? e.message : String(e);
      await salvar(it.deal_id, "erro", null, null, null, null, msg.slice(0, 500), false);
      cont.erros++;
    }
  }

  return jsonResp({ ok: true, ...cont });
});
