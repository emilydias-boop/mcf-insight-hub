// Painel OTE — métricas SOMENTE-LEITURA do funil de Consórcio.
// Autenticação por token fixo (secret OTE_METRICS_TOKEN).
// Nenhuma escrita no banco: apenas SELECTs.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-ote-token",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Origens do funil de Consórcio (espelha CONSORCIO_ORIGIN_IDS do frontend)
const CONSORCIO_ORIGIN_IDS = [
  "4e2b810a-6782-4ce9-9c0d-10d04c018636", // Viver de Aluguel
  "7d7b1cb5-2a44-4552-9eff-c3b798646b78", // Efeito Alavanca
];

// Status que NÃO contam como agendamento vigente
const STATUS_EXCLUIDOS = new Set([
  "cancelled",
  "canceled",
  "cancelada",
  "rescheduled",
  "remanejada",
]);

const TZ = "America/Sao_Paulo";

/** Mês corrente (YYYY-MM) em America/Sao_Paulo. */
function mesCorrenteSP(): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const y = p.find((x) => x.type === "year")?.value;
  const m = p.find((x) => x.type === "month")?.value;
  return `${y}-${m}`;
}

/** Dia (YYYY-MM-DD) de um ISO em America/Sao_Paulo. */
function diaSP(iso: string): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const y = p.find((x) => x.type === "year")?.value;
  const m = p.find((x) => x.type === "month")?.value;
  const d = p.find((x) => x.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

/** Limites do mês em ISO (UTC-3 fixo, horário de Brasília). */
function limitesMes(month: string) {
  const [y, m] = month.split("-").map(Number);
  const inicio = `${month}-01T00:00:00-03:00`;
  const proxAno = m === 12 ? y + 1 : y;
  const proxMes = m === 12 ? 1 : m + 1;
  const fim = `${proxAno}-${String(proxMes).padStart(2, "0")}-01T00:00:00-03:00`;
  const ultimoDia = new Date(new Date(fim).getTime() - 86400000);
  const fimData = diaSP(ultimoDia.toISOString());
  return { inicio, fim, primeiroDia: `${month}-01`, ultimoDia: fimData };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const tokenEsperado = (Deno.env.get("OTE_METRICS_TOKEN") ?? "").trim();
  if (!tokenEsperado) return json({ error: "token_nao_configurado" }, 500);

  // Aceita "Authorization: Bearer <token>" ou header "x-ote-token"
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const recebido = (req.headers.get("x-ote-token") ?? "").trim() || bearer;
  if (!recebido || recebido !== tokenEsperado) return json({ error: "unauthorized" }, 401);

  const url = new URL(req.url);
  const month = url.searchParams.get("month") || mesCorrenteSP();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return json({ error: "month_invalido", esperado: "YYYY-MM" }, 400);
  }
  const { inicio, fim, primeiroDia, ultimoDia } = limitesMes(month);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    // ---- R1 do funil consórcio no mês (attendees + slot + deal) ----
    const linhas: Array<{
      deal_id: string | null;
      status: string | null;
      slot_status: string | null;
      scheduled_at: string;
    }> = [];

    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await admin
        .from("meeting_slot_attendees")
        .select(
          "deal_id, status, meeting_slot:meeting_slots!inner(scheduled_at, meeting_type, status), deal:crm_deals!inner(origin_id)",
        )
        .eq("meeting_slots.meeting_type", "r1")
        .gte("meeting_slots.scheduled_at", inicio)
        .lt("meeting_slots.scheduled_at", fim)
        .in("crm_deals.origin_id", CONSORCIO_ORIGIN_IDS)
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const rows = (data ?? []) as unknown as Array<{
        deal_id: string | null;
        status: string | null;
        meeting_slot: { scheduled_at: string; status: string | null };
      }>;
      rows.forEach((r) =>
        linhas.push({
          deal_id: r.deal_id,
          status: r.status,
          slot_status: r.meeting_slot?.status ?? null,
          scheduled_at: r.meeting_slot?.scheduled_at,
        }),
      );
      if (rows.length < PAGE) break;
    }

    // Exclui canceladas/reagendadas (attendee ou slot)
    const vigentes = linhas.filter(
      (l) =>
        !STATUS_EXCLUIDOS.has((l.status ?? "").toLowerCase()) &&
        !STATUS_EXCLUIDOS.has((l.slot_status ?? "").toLowerCase()),
    );

    // Dedup por (deal, dia) com cap 2 dias distintos por deal
    const porDeal = new Map<string, Set<string>>();
    vigentes.forEach((l) => {
      const deal = l.deal_id;
      if (!deal || !l.scheduled_at) return;
      const set = porDeal.get(deal) ?? new Set<string>();
      if (set.size < 2) set.add(diaSP(l.scheduled_at));
      porDeal.set(deal, set);
    });
    let r1_agendadas = 0;
    porDeal.forEach((dias) => {
      r1_agendadas += Math.min(dias.size, 2);
    });

    // Realizadas — predicado canônico: attendee.status = 'completed' (deals distintos)
    const dealsRealizados = new Set<string>();
    const dealsRealizadosSlot = new Set<string>();
    vigentes.forEach((l) => {
      if (!l.deal_id) return;
      if ((l.status ?? "").toLowerCase() === "completed") dealsRealizados.add(l.deal_id);
      if ((l.slot_status ?? "").toLowerCase() === "completed") dealsRealizadosSlot.add(l.deal_id);
    });
    const r1_realizadas = dealsRealizados.size;
    const r1_realizadas_slot = dealsRealizadosSlot.size;

    // ---- Cotas contratadas no mês (uma linha = uma carta) ----
    // Também deriva "Vendas Realizadas" = CLIENTES distintos, com a MESMA
    // identidade do Painel Comercial (`clienteKey` em useConsorcioCotasContratadas):
    // documento (CPF/CNPJ) tem prioridade; sem documento, nome normalizado;
    // sem nome, o próprio card (nunca agrupa dois desconhecidos).
    const cartas: Array<{
      id: string;
      cpf: string | null;
      cnpj: string | null;
      nome_completo: string | null;
    }> = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await admin
        .from("consortium_cards")
        .select("id, cpf, cnpj, nome_completo")
        .eq("tipo_registro", "contratacao")
        .gte("data_contratacao", primeiroDia)
        .lte("data_contratacao", ultimoDia)
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const rows = data ?? [];
      cartas.push(...(rows as typeof cartas));
      if (rows.length < PAGE) break;
    }
    const cotas_contratadas = cartas.length;

    const clienteKey = (c: { id: string; cpf: string | null; cnpj: string | null; nome_completo: string | null }) => {
      const doc = String(c.cpf ?? "").replace(/\D/g, "") || String(c.cnpj ?? "").replace(/\D/g, "");
      if (doc) return `doc:${doc}`;
      const nome = String(c.nome_completo ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/\s+/g, " ")
        .trim();
      return nome ? `nome:${nome}` : `card:${c.id}`;
    };
    const vendas_realizadas = new Set(cartas.map(clienteKey)).size;

    // Conversão do OTE: PESSOAS que compraram ÷ R1 realizadas.
    const conversao_pct =
      r1_realizadas > 0
        ? Math.round((vendas_realizadas / r1_realizadas) * 1000) / 10
        : null;

    return json({
      month,
      periodo: { inicio, fim },
      r1_agendadas,
      r1_realizadas,
      r1_realizadas_slot,
      cotas_contratadas,
      vendas_realizadas,
      conversao_pct,
      gerado_em: new Date().toISOString(),
    });
  } catch (e) {
    console.error("ote-consorcio-metrics erro:", e);
    return json({ error: "erro_interno", detalhe: String((e as Error)?.message ?? e) }, 500);
  }
});
