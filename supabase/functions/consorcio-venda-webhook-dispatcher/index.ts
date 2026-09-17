import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAKE_WEBHOOK_URL = "https://hook.us1.make.com/pk492b4dfi83s1u4k566i98mg34k8xto";

/**
 * TRAVA ANTI-BACKFILL — não remover.
 *
 * Nenhuma linha criada antes deste instante é enviada, em nenhuma circunstância.
 * As 28 vendas que não chegaram ao Make no histórico NÃO devem ser reenviadas:
 * mandar aviso de venda de semanas atrás para o grupo comercial é inaceitável.
 * A fila nascer vazia não basta como garantia — a data abaixo é a garantia.
 */
const DEPLOY_CUTOFF_ISO = "2026-09-17T17:00:00.000Z"; // 14:00 America/Sao_Paulo

const MAX_TENTATIVAS = 5;
const BATCH_SIZE = 10;

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 })
    .format(v)
    .replace(/\u00a0/g, " ");

/** Agrupa cartas de mesmo valor: "2 cartas de R$ 200.000,00 e 1 carta de R$ 150.000,00". */
function resumoCartas(valores: number[]): string {
  const grupos = new Map<number, number>();
  for (const v of valores) grupos.set(v, (grupos.get(v) ?? 0) + 1);
  const partes = [...grupos.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([valor, qtd]) => `${qtd} ${qtd === 1 ? "carta" : "cartas"} de ${brl(valor)}`);
  if (partes.length === 0) return "";
  if (partes.length === 1) return partes[0];
  return `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
}

function montarMensagem(p: {
  cliente: string;
  credito_total_formatado: string;
  cartas_resumo: string;
  parcelas_mcf: number | null;
  closer: string;
  sdr: string;
}): string {
  return [
    "*FECHAMOS MAIS UMA CARTA*",
    "",
    `Cliente: ${p.cliente}`,
    `Crédito Total: ${p.credito_total_formatado}`,
    "",
    p.cartas_resumo,
    "",
    `Parcelas pagas pela MCF: ${p.parcelas_mcf ?? "Não informado"}`,
    "",
    `Closer: ${p.closer}`,
    `SDR: ${p.sdr}`,
  ].join("\n");
}

const pick = (...vals: unknown[]) => {
  for (const v of vals) if (v !== undefined && v !== null && v !== "") return v as string;
  return null;
};

/** Monta o payload de uma venda a partir do que já está gravado. Nada é recalculado. */
export async function buildVendaPayload(
  supabase: ReturnType<typeof createClient>,
  vendaId: string,
): Promise<Record<string, unknown>> {
  const { data: proposal, error: propErr } = await supabase
    .from("consorcio_proposals")
    .select("id, deal_id, valor_credito, qtd_cartas, aceite_at, created_at")
    .eq("id", vendaId)
    .maybeSingle();
  if (propErr) throw new Error(`proposta: ${propErr.message}`);
  if (!proposal) throw new Error("proposta não encontrada");

  const [cartasRes, regsRes] = await Promise.all([
    supabase
      .from("consorcio_proposal_cartas")
      .select("valor_credito, ordem, parcelas_mcf")
      .eq("proposal_id", vendaId)
      .is("declinada_at", null)
      .order("ordem", { ascending: true }),
    supabase
      .from("consorcio_pending_registrations")
      .select("nome_completo, razao_social, vendedor_name, vendedor_name_cota, parcelas_pagas_empresa, status")
      .eq("proposal_id", vendaId)
      .order("created_at", { ascending: true }),
  ]);

  const cartasRows = (cartasRes.data ?? []) as Array<{ valor_credito: number | null; parcelas_mcf: number[] | null }>;
  const regs = ((regsRes.data ?? []) as Array<Record<string, unknown>>).filter((r) => r.status !== "excluida");

  const valores = cartasRows.map((c) => Number(c.valor_credito ?? 0)).filter((v) => v > 0);
  const creditoTotal = Number(proposal.valor_credito ?? 0);

  // Nome do cliente: cadastro do cliente primeiro; sem cadastro, o contato do CRM.
  let cliente = pick(regs[0]?.nome_completo, regs[0]?.razao_social);
  if (!cliente && proposal.deal_id) {
    const { data: deal } = await supabase
      .from("crm_deals")
      .select("contact_id, crm_contacts(name)")
      .eq("id", proposal.deal_id)
      .maybeSingle();
    cliente = pick((deal as { crm_contacts?: { name?: string } } | null)?.crm_contacts?.name);
  }

  const closer = pick(regs[0]?.vendedor_name_cota, regs[0]?.vendedor_name) ?? "Não identificado";

  // Parcelas que a MCF paga: só leitura do que está gravado (nada recalculado).
  const parcelasGravadas = regs
    .map((r) => (r.parcelas_pagas_empresa == null ? null : Number(r.parcelas_pagas_empresa)))
    .filter((n): n is number => n != null && n > 0);
  const parcelasMcf = parcelasGravadas.length > 0
    ? Math.max(...parcelasGravadas)
    : (cartasRows[0]?.parcelas_mcf?.length ?? null);

  // SDR: agendador da R1 = agendamento mais antigo do negócio.
  let sdr = "Não identificado";
  if (proposal.deal_id) {
    const { data: att } = await supabase
      .from("meeting_slot_attendees")
      .select("booked_by, booked_at")
      .eq("deal_id", proposal.deal_id)
      .not("booked_by", "is", null)
      .order("booked_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const bookedBy = (att as { booked_by?: string } | null)?.booked_by;
    if (bookedBy) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", bookedBy)
        .maybeSingle();
      sdr = pick((prof as { full_name?: string } | null)?.full_name) ?? "Não identificado";
    }
  }

  const cartasResumo = resumoCartas(valores);
  const base = {
    cliente: cliente ?? "Não identificado",
    credito_total_formatado: brl(creditoTotal),
    cartas_resumo: cartasResumo,
    parcelas_mcf: parcelasMcf,
    closer,
    sdr,
  };

  return {
    mensagem: montarMensagem(base),
    cliente: base.cliente,
    credito_total: creditoTotal,
    credito_total_formatado: base.credito_total_formatado,
    qtd_cartas: valores.length || Number(proposal.qtd_cartas ?? 0),
    cartas: valores.map((v) => ({ valor: v, valor_formatado: brl(v) })),
    cartas_resumo: cartasResumo,
    parcelas_mcf: parcelasMcf,
    closer,
    sdr,
    venda_id: vendaId,
    lancada_em: proposal.aceite_at ?? proposal.created_at ?? null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const resultados: Array<Record<string, unknown>> = [];

  try {
    const { data: jobs, error } = await supabase
      .from("consorcio_venda_webhook_queue")
      .select("id, venda_id, tentativas, created_at")
      .eq("status", "pending")
      .lt("tentativas", MAX_TENTATIVAS)
      // Trava anti-backfill: nada anterior ao deploy sai daqui.
      .gte("created_at", DEPLOY_CUTOFF_ISO)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (error) throw new Error(error.message);

    for (const job of jobs ?? []) {
      const tentativas = Number(job.tentativas ?? 0) + 1;
      try {
        const payload = await buildVendaPayload(supabase, job.venda_id as string);
        const body = JSON.stringify(payload);

        const resp = await fetch(MAKE_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body,
        });
        const respText = (await resp.text()).slice(0, 500);

        if (resp.ok) {
          await supabase
            .from("consorcio_venda_webhook_queue")
            .update({
              status: "sent",
              tentativas,
              payload,
              ultimo_erro: null,
              sent_at: new Date().toISOString(),
            })
            .eq("id", job.id)
            .eq("status", "pending"); // 'sent' é terminal: nunca reenvia
          resultados.push({ id: job.id, ok: true });
        } else {
          const erro = `HTTP ${resp.status}: ${respText}`;
          await supabase
            .from("consorcio_venda_webhook_queue")
            .update({
              status: tentativas >= MAX_TENTATIVAS ? "failed" : "pending",
              tentativas,
              payload,
              ultimo_erro: erro,
            })
            .eq("id", job.id);
          resultados.push({ id: job.id, ok: false, erro });
        }
      } catch (e) {
        const erro = (e as Error).message?.slice(0, 1000) ?? "erro desconhecido";
        await supabase
          .from("consorcio_venda_webhook_queue")
          .update({
            status: tentativas >= MAX_TENTATIVAS ? "failed" : "pending",
            tentativas,
            ultimo_erro: erro,
          })
          .eq("id", job.id);
        resultados.push({ id: job.id, ok: false, erro });
      }
    }

    return new Response(JSON.stringify({ processados: resultados.length, resultados }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[consorcio-venda-webhook-dispatcher]", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
