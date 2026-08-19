import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export interface ConsorcioCotasContratadas {
  /** Total de cotas contratadas no período (após filtro de funil). */
  total: number;
  /** Cotas por closer_id (via vendedor da cota → closers da BU). */
  byCloser: Map<string, number>;
  /** Cotas por e-mail do SDR (via cota → cadastro pendente → deal → quem agendou). */
  bySdr: Map<string, number>;
  /** Nome exibível por e-mail de SDR (para linhas de SDR sem atividade na agenda). */
  sdrNames: Map<string, string>;
  /** Cotas que não puderam ser atribuídas a um SDR (sem vínculo com lead). */
  semVinculo: number;
  /** Cotas cujo vendedor não casou com nenhum closer da BU. */
  semCloser: number;
}

const EMPTY: ConsorcioCotasContratadas = {
  total: 0,
  byCloser: new Map(),
  bySdr: new Map(),
  sdrNames: new Map(),
  semVinculo: 0,
  semCloser: 0,
};

/** Normaliza nome para casar "André Duarte" com "Andre dos Santos Duarte". */
function nameKey(name?: string | null): string | null {
  if (!name) return null;
  const clean = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (clean.length === 0) return null;
  const first = clean[0];
  const last = clean[clean.length - 1];
  return `${first}|${last}`;
}

/**
 * Cotas Contratadas — a única métrica de venda fechada do Consórcio.
 *
 * Fonte: `consortium_cards` com `tipo_registro = 'contratacao'`, eixo de data
 * `data_contratacao`. Atribuição:
 *  - Closer: vendedor da cota (`vendedor_name`) casado com `closers` da BU.
 *  - SDR: cota → `consorcio_pending_registrations.deal_id` → quem agendou a R1
 *    (`meeting_slot_attendees.booked_by`), com fallback no dono do negócio.
 *
 * Filtro de funil: aplicado pela origem do deal vinculado. Cota sem vínculo com
 * lead não tem origem — fica de fora quando há funil selecionado (conservador).
 */
export function useConsorcioCotasContratadas(
  startDate: Date | null,
  endDate: Date | null,
  allowedOriginNames: Set<string> | null,
  bu: string = "consorcio",
) {
  return useQuery({
    queryKey: [
      "consorcio-cotas-contratadas",
      startDate ? format(startDate, "yyyy-MM-dd") : null,
      endDate ? format(endDate, "yyyy-MM-dd") : null,
      allowedOriginNames ? Array.from(allowedOriginNames).sort().join("|") : "all",
      bu,
    ],
    queryFn: async (): Promise<ConsorcioCotasContratadas> => {
      if (!startDate || !endDate) return EMPTY;

      const { data: cards, error: cardsError } = await supabase
        .from("consortium_cards")
        .select("id, vendedor_name, data_contratacao")
        .eq("tipo_registro", "contratacao")
        .gte("data_contratacao", format(startDate, "yyyy-MM-dd"))
        .lte("data_contratacao", format(endDate, "yyyy-MM-dd"));
      if (cardsError) throw cardsError;
      if (!cards || cards.length === 0) return EMPTY;

      const cardIds = cards.map((c) => c.id);

      // Vínculo cota → cadastro pendente → deal
      const { data: regs, error: regsError } = await supabase
        .from("consorcio_pending_registrations")
        .select("consortium_card_id, deal_id")
        .in("consortium_card_id", cardIds);
      if (regsError) throw regsError;

      const cardToDeal = new Map<string, string>();
      (regs || []).forEach((r: any) => {
        if (r.consortium_card_id && r.deal_id && !cardToDeal.has(r.consortium_card_id)) {
          cardToDeal.set(r.consortium_card_id, r.deal_id);
        }
      });

      const dealIds = [...new Set(Array.from(cardToDeal.values()))];

      // Origem + dono do negócio (origem alimenta o filtro de funil)
      const dealOrigin = new Map<string, string>();
      const dealOwner = new Map<string, string>();
      if (dealIds.length > 0) {
        const { data: deals, error: dealsError } = await supabase
          .from("crm_deals")
          .select("id, owner_id, origin_id, crm_origins(name)")
          .in("id", dealIds);
        if (dealsError) throw dealsError;
        (deals || []).forEach((d: any) => {
          const originName = d.crm_origins?.name;
          if (originName) dealOrigin.set(d.id, String(originName).toLowerCase());
          if (d.owner_id) dealOwner.set(d.id, String(d.owner_id).toLowerCase());
        });
      }

      // Quem agendou a R1 do deal
      const dealBooker = new Map<string, string>();
      if (dealIds.length > 0) {
        const { data: attendees, error: attError } = await supabase
          .from("meeting_slot_attendees")
          .select("deal_id, booked_by, booked_at, created_at")
          .in("deal_id", dealIds)
          .not("booked_by", "is", null)
          .neq("status", "cancelled");
        if (attError) throw attError;

        const bookerIds = [...new Set((attendees || []).map((a: any) => a.booked_by).filter(Boolean))];
        const emailById = new Map<string, string>();
        if (bookerIds.length > 0) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, email")
            .in("id", bookerIds);
          (profs || []).forEach((p: any) => {
            if (p.email) emailById.set(p.id, String(p.email).toLowerCase());
          });
        }
        // O primeiro agendamento define o SDR da cota.
        const sorted = [...(attendees || [])].sort((a: any, b: any) =>
          String(a.booked_at || a.created_at || "").localeCompare(String(b.booked_at || b.created_at || "")),
        );
        sorted.forEach((a: any) => {
          if (!a.deal_id || dealBooker.has(a.deal_id)) return;
          const email = emailById.get(a.booked_by);
          if (email) dealBooker.set(a.deal_id, email);
        });
      }

      // Vendedor da cota → closer da BU
      const { data: closers, error: closersError } = await supabase
        .from("closers")
        .select("id, name")
        .eq("bu", bu);
      if (closersError) throw closersError;
      const closerByName = new Map<string, string>();
      (closers || []).forEach((c: any) => {
        const key = nameKey(c.name);
        if (key && !closerByName.has(key)) closerByName.set(key, c.id);
      });

      const byCloser = new Map<string, number>();
      const bySdr = new Map<string, number>();
      let total = 0;
      let semVinculo = 0;
      let semCloser = 0;

      cards.forEach((card) => {
        const dealId = cardToDeal.get(card.id);
        // Filtro de funil pela origem do deal vinculado.
        if (allowedOriginNames) {
          const origin = dealId ? dealOrigin.get(dealId) : undefined;
          if (!origin || !allowedOriginNames.has(origin)) return;
        }
        total++;

        const closerId = closerByName.get(nameKey(card.vendedor_name) || "");
        if (closerId) byCloser.set(closerId, (byCloser.get(closerId) || 0) + 1);
        else semCloser++;

        const sdrEmail = dealId ? dealBooker.get(dealId) || dealOwner.get(dealId) : undefined;
        if (sdrEmail) bySdr.set(sdrEmail, (bySdr.get(sdrEmail) || 0) + 1);
        else semVinculo++;
      });

      // Nomes dos SDRs atribuídos (inclui quem não teve atividade na agenda do período).
      const sdrNames = new Map<string, string>();
      const sdrEmails = Array.from(bySdr.keys());
      if (sdrEmails.length > 0) {
        const { data: sdrProfiles } = await supabase
          .from("profiles")
          .select("email, full_name")
          .in("email", sdrEmails);
        (sdrProfiles || []).forEach((p: any) => {
          if (p.email) sdrNames.set(String(p.email).toLowerCase(), p.full_name || String(p.email));
        });
      }

      return { total, byCloser, bySdr, sdrNames, semVinculo, semCloser };
    },
    enabled: !!startDate && !!endDate,
    staleTime: 30000,
  });
}
