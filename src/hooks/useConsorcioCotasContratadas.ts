import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export interface ConsorcioCotasContratadas {
  /** Total de cotas contratadas no período (após filtro de funil). */
  total: number;
  /** Cotas por closer_id (via vendedor da cota → closers da BU). */
  byCloser: Map<string, number>;
  /** Cotas por e-mail do SDR (via cota → cadastro pendente → deal → quem agendou a R1 da BU). */
  bySdr: Map<string, number>;
  /** Nome exibível por e-mail de SDR (para linhas de SDR sem atividade na agenda). */
  sdrNames: Map<string, string>;
  /** Cotas que não puderam ser atribuídas a um SDR (sem vínculo ou sem agendador da BU). */
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
 *  - SDR: cota → `consorcio_pending_registrations.deal_id` → quem agendou a
 *    PRIMEIRA reunião conduzida por closer DESTA BU (`meeting_slots.closer_id`).
 *    Reunião conduzida por closer de outra BU nunca define o SDR da cota, por
 *    mais antiga que seja. Attendees `invited` e `cancelled` são
 *    ignorados; `no_show` vale (prospecção existe mesmo sem comparecimento).
 *    Não há fallback no dono do negócio: sem agendador identificado
 *    a cota vai para a linha "Não atribuído".
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

      // Origem do deal (alimenta o filtro de funil)
      const dealOrigin = new Map<string, string>();
      if (dealIds.length > 0) {
        const { data: deals, error: dealsError } = await supabase
          .from("crm_deals")
          .select("id, origin_id, crm_origins(name)")
          .in("id", dealIds);
        if (dealsError) throw dealsError;
        (deals || []).forEach((d: any) => {
          const originName = d.crm_origins?.name;
          if (originName) dealOrigin.set(d.id, String(originName).toLowerCase());
        });
      }

      // Closers da BU: definem tanto o lado closer quanto quais reuniões contam
      // para a atribuição do SDR.
      const { data: closers, error: closersError } = await supabase
        .from("closers")
        .select("id, name")
        .eq("bu", bu);
      if (closersError) throw closersError;
      const closerByName = new Map<string, string>();
      const buCloserIds = new Set<string>();
      (closers || []).forEach((c: any) => {
        buCloserIds.add(String(c.id));
        const key = nameKey(c.name);
        if (key && !closerByName.has(key)) closerByName.set(key, c.id);
      });

      // Quem agendou a PRIMEIRA reunião desta BU para o deal.
      const dealBooker = new Map<string, string>();
      if (dealIds.length > 0) {
        const { data: attendees, error: attError } = await supabase
          .from("meeting_slot_attendees")
          .select("deal_id, booked_by, booked_at, created_at, status, meeting_slot_id")
          .in("deal_id", dealIds)
          .not("booked_by", "is", null)
          .not("status", "in", "(cancelled,invited)");
        if (attError) throw attError;

        // Só reuniões conduzidas por closer desta BU definem o SDR.
        const slotIds = [...new Set((attendees || []).map((a: any) => a.meeting_slot_id).filter(Boolean))];
        const slotCloser = new Map<string, string>();
        if (slotIds.length > 0) {
          const { data: slots, error: slotsError } = await supabase
            .from("meeting_slots")
            .select("id, closer_id")
            .in("id", slotIds);
          if (slotsError) throw slotsError;
          (slots || []).forEach((s: any) => {
            if (s.closer_id) slotCloser.set(String(s.id), String(s.closer_id));
          });
        }

        const buAttendees = (attendees || []).filter((a: any) => {
          const closerId = a.meeting_slot_id ? slotCloser.get(String(a.meeting_slot_id)) : undefined;
          return !!closerId && buCloserIds.has(closerId);
        });

        const bookerIds = [...new Set(buAttendees.map((a: any) => a.booked_by).filter(Boolean))];
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
        // O primeiro agendamento da BU define o SDR da cota.
        const sorted = [...buAttendees].sort((a: any, b: any) =>
          String(a.booked_at || a.created_at || "").localeCompare(String(b.booked_at || b.created_at || "")),
        );
        sorted.forEach((a: any) => {
          if (!a.deal_id || dealBooker.has(a.deal_id)) return;
          const email = emailById.get(a.booked_by);
          if (email) dealBooker.set(a.deal_id, email);
        });
      }

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

        // Sem fallback em owner_id: sem agendador desta BU → "Não atribuído".
        const sdrEmail = dealId ? dealBooker.get(dealId) : undefined;
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
