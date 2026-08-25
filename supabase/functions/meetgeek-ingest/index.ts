// Ingestão MeetGeek: consome a fila de gravações pendentes, busca detalhe +
// transcrição + resumo + highlights, e pareia com a agenda do CRM.
// Roda por cron. Nunca é chamado pelo webhook (o webhook só enfileira).
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API_BASE = Deno.env.get("MEETGEEK_API_BASE") ?? "https://api.meetgeek.ai";
const LOTE_PADRAO = 10;
const LOTE_MAX = 30;             // teto: o endpoint não pode virar torneira de quota
const MAX_TENTATIVAS = 3;
const PAGINA_TRANSCRICAO = 500;  // máximo permitido pela API

type Sentence = { id?: number; speaker?: string; timestamp?: string; transcript?: string };

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

class QuotaError extends Error {}

async function mgFetch(path: string, token: string): Promise<Response> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (res.status === 429) throw new QuotaError("quota limit reached");
  return res;
}

async function buscarTranscricao(token: string, meetingId: string) {
  const sentences: Sentence[] = [];
  const cursoresVistos = new Set<string>();
  let cursor: string | null = null;
  let paginas = 0;

  do {
    const qs = new URLSearchParams({ limit: String(PAGINA_TRANSCRICAO) });
    if (cursor) qs.set("cursor", cursor);

    const res = await mgFetch(`/v1/meetings/${meetingId}/transcript?${qs}`, token);

    // 404/410 = transcrição ainda não disponível ou expirada
    if (res.status === 404 || res.status === 410) return { sentences: null, status: res.status };
    if (!res.ok) throw new Error(`transcript ${res.status}: ${(await res.text()).slice(0, 200)}`);

    const data = await res.json();
    paginas++;
    if (Array.isArray(data?.sentences)) sentences.push(...data.sentences);

    cursor = data?.pagination?.next_cursor || null;
    // cursor repetido duplicaria sentencas indefinidamente
    if (cursor) {
      if (cursoresVistos.has(cursor)) break;
      cursoresVistos.add(cursor);
    }
    if (paginas > 20) break; // ~10.000 sentencas, ~12h de reuniao
  } while (cursor);

  return { sentences, status: 200 };
}

async function buscarOpcional(token: string, path: string): Promise<unknown | null> {
  try {
    const res = await mgFetch(path, token);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    if (e instanceof QuotaError) throw e;
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const token = Deno.env.get("MEETGEEK_API_KEY");
  if (!token) return jsonResp({ error: "MEETGEEK_API_KEY nao configurada" }, 500);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const url = new URL(req.url);
  let lote = clamp(url.searchParams.get("lote"), LOTE_PADRAO, LOTE_MAX);
  let modo = url.searchParams.get("modo") || "fila";

  if (req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    if (body?.lote !== undefined) lote = clamp(body.lote, LOTE_PADRAO, LOTE_MAX);
    if (typeof body?.modo === "string") modo = body.modo;
  }

  const iniciado = Date.now();

  // ---------------------------------------------------------------
  // MODO DESCOBRIR: rede de segurança caso um webhook se perca.
  // ---------------------------------------------------------------
  if (modo === "descobrir") {
    try {
      const res = await mgFetch(`/v1/meetings?limit=100`, token);
      if (!res.ok) return jsonResp({ error: `meetings ${res.status}` }, 502);
      const data = await res.json();

      const lista = Array.isArray(data?.meetings) ? data.meetings : [];
      const ids: string[] = lista
        .map((m: { meeting_id?: string }) => m?.meeting_id)
        .filter(Boolean);

      // Se o formato da resposta mudar, isso viraria {novos:0} silencioso e
      // pareceria saudável enquanto não faz nada. Melhor gritar.
      if (ids.length === 0) {
        console.warn("[meetgeek-ingest] descobrir nao achou meeting_id. chaves da resposta:",
          Object.keys(data ?? {}));
      }

      if (ids.length === 0) return jsonResp({ modo, vistos: 0, novos: 0, alerta: "resposta sem meeting_id" });

      const { data: existentes } = await supabase
        .from("meeting_recordings")
        .select("meetgeek_meeting_id")
        .in("meetgeek_meeting_id", ids);

      const conhecidos = new Set((existentes ?? []).map((r) => r.meetgeek_meeting_id));
      const novos = ids.filter((id) => !conhecidos.has(id));

      if (novos.length > 0) {
        await supabase.from("meeting_recordings").upsert(
          novos.map((id) => ({ meetgeek_meeting_id: id, ingest_status: "pendente" })),
          { onConflict: "meetgeek_meeting_id", ignoreDuplicates: true },
        );
      }

      const agora = new Date().toISOString();
      await supabase.from("meetgeek_sync_state")
        .upsert({ id: true, last_synced_at: agora, updated_at: agora }, { onConflict: "id" });

      console.log("[meetgeek-ingest] descobrir:", { vistos: ids.length, novos: novos.length });
      return jsonResp({ modo, vistos: ids.length, novos: novos.length });
    } catch (e) {
      const quota = e instanceof QuotaError;
      return jsonResp({ modo, error: String(e) }, quota ? 429 : 500);
    }
  }

  // ---------------------------------------------------------------
  // MODO FILA: claim atômico e processamento
  // ---------------------------------------------------------------
  const { data: fila, error: filaErr } = await supabase
    .rpc("meetgeek_reivindicar_ingest", { _lote: lote });

  if (filaErr) return jsonResp({ error: filaErr.message }, 500);
  if (!fila || fila.length === 0) {
    return jsonResp({ modo, reivindicadas: 0, mensagem: "fila vazia" });
  }

  const resultado = {
    ok: 0, sem_transcricao: 0, erro: 0, quota: false,
    pareamento: {} as Record<string, number>,
  };
  let processadas = 0;

  for (const item of fila as Array<{ id: string; meetgeek_meeting_id: string; ingest_attempts: number }>) {
    const mid = item.meetgeek_meeting_id;
    try {
      const resDet = await mgFetch(`/v1/meetings/${mid}`, token);

      if (resDet.status === 404 || resDet.status === 410) {
        // Pode ser transitório logo após o webhook. Só desiste na última tentativa.
        const desistir = item.ingest_attempts >= MAX_TENTATIVAS;
        await supabase.from("meeting_recordings").update({
          ingest_status: desistir ? "sem_transcricao" : "pendente",
          ingest_error: `detalhe ${resDet.status}`,
          ...(desistir ? { analysis_status: "ignorado" } : {}),
        }).eq("id", item.id);
        if (desistir) resultado.sem_transcricao++;
        processadas++;
        continue;
      }
      if (!resDet.ok) throw new Error(`detalhe ${resDet.status}: ${(await resDet.text()).slice(0, 200)}`);

      const det = await resDet.json();
      const inicio = det?.timestamp_start_utc ?? null;
      const fim = det?.timestamp_end_utc ?? null;
      const duracao = inicio && fim
        ? Math.round((new Date(fim).getTime() - new Date(inicio).getTime()) / 60000)
        : null;

      const { sentences } = await buscarTranscricao(token, mid);
      const temTranscricao = !!sentences && sentences.length > 0;

      // Sem transcrição ainda: devolve para a fila em vez de descartar de vez.
      if (!temTranscricao && item.ingest_attempts < MAX_TENTATIVAS) {
        await supabase.from("meeting_recordings").update({
          ingest_status: "pendente",
          ingest_error: "transcricao ainda indisponivel",
        }).eq("id", item.id);
        processadas++;
        continue;
      }

      const summary = await buscarOpcional(token, `/v1/meetings/${mid}/summary`);
      const highlights = await buscarOpcional(token, `/v1/meetings/${mid}/highlights`);
      const chars = (sentences ?? []).reduce((n, s) => n + (s.transcript?.length ?? 0), 0);

      const { error: upErr } = await supabase.from("meeting_recordings").update({
        title: det?.title ?? null,
        host_email: det?.host_email ?? null,
        participant_emails: det?.participant_emails ?? null,
        language: det?.language ?? null,
        source: det?.source ?? null,
        join_link: det?.join_link ?? null,
        calendar_event_id: det?.event_id ?? null,
        started_at: inicio,
        ended_at: fim,
        duration_minutes: duracao,
        summary: summary ?? null,
        highlights: highlights ?? null,
        transcript: temTranscricao ? sentences : null,
        transcript_chars: chars,
        ingest_status: temTranscricao ? "ingerido" : "sem_transcricao",
        analysis_status: temTranscricao ? "pendente" : "ignorado",
        ingest_error: null,
        ingested_at: new Date().toISOString(),
      }).eq("id", item.id);

      if (upErr) throw new Error(`gravar: ${upErr.message}`);

      const { data: par, error: parErr } = await supabase
        .rpc("meetgeek_parear_gravacao", { _recording_id: item.id });
      if (parErr) console.error("[meetgeek-ingest] pareamento falhou", mid, parErr.message);

      const metodo = (par as { match_method?: string } | null)?.match_method
        ?? (parErr ? "falha_pareamento" : "desconhecido");
      resultado.pareamento[metodo] = (resultado.pareamento[metodo] ?? 0) + 1;

      if (temTranscricao) resultado.ok++;
      else resultado.sem_transcricao++;
      processadas++;
    } catch (e) {
      if (e instanceof QuotaError) {
        // Estourou o limite da API. Devolve esta linha para a fila SEM contar
        // tentativa perdida e para a rodada — o próximo tick continua.
        resultado.quota = true;
        await supabase.from("meeting_recordings").update({
          ingest_status: "pendente",
          ingest_attempts: item.ingest_attempts - 1,
        }).eq("id", item.id);
        console.warn("[meetgeek-ingest] quota atingida, interrompendo rodada");
        break;
      }
      const msg = String(e).slice(0, 500);
      await supabase.from("meeting_recordings").update({
        ingest_status: item.ingest_attempts >= MAX_TENTATIVAS ? "erro" : "pendente",
        ingest_error: msg,
      }).eq("id", item.id);
      resultado.erro++;
      processadas++;
      console.error("[meetgeek-ingest] falha", mid, msg);
    }
  }

  const saida = {
    modo, reivindicadas: fila.length, processadas, ...resultado,
    duracao_ms: Date.now() - iniciado,
  };
  console.log("[meetgeek-ingest]", saida);
  return jsonResp(saida);
});
