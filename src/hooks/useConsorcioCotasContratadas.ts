import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

/** Código do problema — define qual ação a UI oferece (e quando não oferece nenhuma). */
export type CotaProblema =
  | "sem_cadastro"
  | "sem_lead"
  | "deal_inexistente"
  | "sem_reuniao_bu"
  | "reuniao_nao_elegivel"
  | "sem_agendador"
  | "perfil_sem_email"
  | "sem_vendedor";

/** Reunião de consórcio elegível encontrada sem agendador registrado. */
export interface AgendamentoSemAgendador {
  attendeeId: string;
  dia: string | null;
  closerName: string | null;
}

export interface CotaResiduoItem {
  cardId: string;
  cliente: string;
  grupo: string | null;
  cota: string | null;
  dataContratacao: string | null;
  valorCredito: number | null;
  vendedorName: string | null;
  dealId: string | null;
  motivo: string;
  /** Diagnóstico em código: a UI só mostra o botão que resolve ESTE problema. */
  problema?: CotaProblema;
  /** Presente quando o problema é `sem_agendador` — alimenta o editor de agendador. */
  agendamento?: AgendamentoSemAgendador | null;
  /** Cadastro pendente já ligado à cota (quando existe) — define o caminho de correção. */
  pendingRegId: string | null;
  /** Quando o cliente já teve o resultado atribuído por OUTRA cota, o nome do SDR. */
  atribuidoA?: string | null;
  /** Autoria de correção manual do vínculo, quando houve. */
  ajuste?: {
    porId: string | null;
    em: string | null;
    dealAnterior: string | null;
  } | null;
}

export interface ConsorcioCotasContratadas {
  /** Total de cotas contratadas no período (após filtro de funil). */
  total: number;
  /** Cotas por closer_id (via vendedor da cota → closers da BU). */
  byCloser: Map<string, number>;
  /** Cotas por e-mail do SDR (via cota → cadastro pendente → deal → quem agendou a R1 da BU). */
  bySdr: Map<string, number>;
  /** Clientes distintos (identidade do titular da cota) por closer_id. */
  clientesByCloser: Map<string, number>;
  /** Clientes distintos por e-mail de SDR. */
  clientesBySdr: Map<string, number>;
  /** Soma de valor_credito por closer_id. */
  creditoByCloser: Map<string, number>;
  /** Soma de valor_credito por e-mail de SDR. */
  creditoBySdr: Map<string, number>;
  /** Clientes distintos / crédito das linhas residuais. */
  clientesSemVinculo: number;
  creditoSemVinculo: number;
  clientesSemCloser: number;
  creditoSemCloser: number;
  /** Clientes distintos e crédito do período inteiro (base do card). */
  totalClientes: number;
  totalCredito: number;
  /** Nome exibível por e-mail de SDR (para linhas de SDR sem atividade na agenda). */
  sdrNames: Map<string, string>;
  /** Cotas de clientes SEM nenhum agendamento de consórcio (linha da tabela). */
  semVinculo: number;
  /** Cotas cujo vendedor não casou com nenhum closer da BU. */
  semCloser: number;
  /** Detalhe das cotas de clientes sem agendamento de consórcio. */
  semVinculoItems: CotaResiduoItem[];
  /** Qualidade de cadastro: cotas cuja própria linha não tem lead/agendador resolvível. */
  cadastroSemLead: number;
  creditoCadastroSemLead: number;
  cadastroSemLeadItems: CotaResiduoItem[];
  /** Detalhe das cotas sem vendedor casado com closer da BU. */
  semCloserItems: CotaResiduoItem[];
}

const EMPTY: ConsorcioCotasContratadas = {
  total: 0,
  byCloser: new Map(),
  bySdr: new Map(),
  clientesByCloser: new Map(),
  clientesBySdr: new Map(),
  creditoByCloser: new Map(),
  creditoBySdr: new Map(),
  clientesSemVinculo: 0,
  creditoSemVinculo: 0,
  clientesSemCloser: 0,
  creditoSemCloser: 0,
  totalClientes: 0,
  totalCredito: 0,
  sdrNames: new Map(),
  semVinculo: 0,
  semCloser: 0,
  semVinculoItems: [],
  cadastroSemLead: 0,
  creditoCadastroSemLead: 0,
  cadastroSemLeadItems: [],
  semCloserItems: [],
};

/** Normaliza nome para casar "André Duarte" com "Andre dos Santos Duarte". */
export function nameKey(name?: string | null): string | null {
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
 * Identidade da PESSOA titular da cota — base da contagem de clientes.
 * Uma pessoa pode contratar várias cotas; a conversão do comercial é por
 * pessoa atendida, não por cota. Documento (CPF/CNPJ) tem prioridade; sem
 * documento, cai no nome normalizado (sem acento, caixa alta, espaços
 * colapsados) para que a cota órfã não deixe de contar.
 */
function clienteKey(card: any): string {
  const doc = String(card.cpf || "").replace(/\D/g, "") || String(card.cnpj || "").replace(/\D/g, "");
  if (doc) return `doc:${doc}`;
  const nome = String(card.nome_completo || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
  return nome ? `nome:${nome}` : `card:${card.id}`;
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
        .select(
          "id, vendedor_name, data_contratacao, nome_completo, grupo, cota, valor_credito, cpf, cnpj",
        )
        .eq("tipo_registro", "contratacao")
        .gte("data_contratacao", format(startDate, "yyyy-MM-dd"))
        .lte("data_contratacao", format(endDate, "yyyy-MM-dd"));
      if (cardsError) throw cardsError;
      if (!cards || cards.length === 0) return EMPTY;

      const cardIds = cards.map((c) => c.id);

      // Vínculo cota → cadastro pendente → deal
      const { data: regs, error: regsError } = await supabase
        .from("consorcio_pending_registrations")
        .select(
          "id, consortium_card_id, deal_id, created_at, deal_vinculo_ajustado_por, deal_vinculo_ajustado_em, deal_vinculo_anterior",
        )
        .in("consortium_card_id", cardIds);
      if (regsError) throw regsError;

      const cardToDeal = new Map<string, string>();
      const cardsComCadastro = new Set<string>();
      const cardToReg = new Map<string, any>();
      (regs || []).forEach((r: any) => {
        if (r.consortium_card_id) cardsComCadastro.add(r.consortium_card_id);
        if (r.consortium_card_id && !cardToReg.has(r.consortium_card_id)) {
          cardToReg.set(r.consortium_card_id, r);
        }
        if (r.consortium_card_id && r.deal_id && !cardToDeal.has(r.consortium_card_id)) {
          cardToDeal.set(r.consortium_card_id, r.deal_id);
          cardToReg.set(r.consortium_card_id, r);
        }
      });

      const dealIds = [...new Set(Array.from(cardToDeal.values()))];

      // Origem do deal (alimenta o filtro de funil)
      const dealOrigin = new Map<string, string>();
      const dealsExistentes = new Set<string>();
      if (dealIds.length > 0) {
        const { data: deals, error: dealsError } = await supabase
          .from("crm_deals")
          .select("id, origin_id, crm_origins(name)")
          .in("id", dealIds);
        if (dealsError) throw dealsError;
        (deals || []).forEach((d: any) => {
          dealsExistentes.add(String(d.id));
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
      const closerNameById = new Map<string, string>();
      (closers || []).forEach((c: any) => {
        buCloserIds.add(String(c.id));
        if (c.name) closerNameById.set(String(c.id), String(c.name));
        const key = nameKey(c.name);
        if (key && !closerByName.has(key)) closerByName.set(key, c.id);
      });

      // Quem agendou a ÚLTIMA reunião desta BU para o deal.
      const dealBooker = new Map<string, { email: string; at: string }>();
      // Diagnóstico por deal (alimenta a coluna "Motivo" do detalhamento).
      const dealTemReuniaoBU = new Set<string>();
      const dealTemReuniaoElegivel = new Set<string>();
      const dealTemBooker = new Set<string>();
      /** Reunião elegível sem `booked_by` — caminho de correção "Informar agendador". */
      const dealSemAgendador = new Map<string, AgendamentoSemAgendador>();
      if (dealIds.length > 0) {
        const { data: attendees, error: attError } = await supabase
          .from("meeting_slot_attendees")
          .select("id, deal_id, booked_by, booked_at, created_at, status, meeting_slot_id")
          .in("deal_id", dealIds);
        if (attError) throw attError;

        // Só reuniões conduzidas por closer desta BU definem o SDR.
        const slotIds = [...new Set((attendees || []).map((a: any) => a.meeting_slot_id).filter(Boolean))];
        const slotCloser = new Map<string, string>();
        const slotDate = new Map<string, string>();
        if (slotIds.length > 0) {
          const { data: slots, error: slotsError } = await supabase
            .from("meeting_slots")
            .select("id, closer_id, scheduled_at")
            .in("id", slotIds);
          if (slotsError) throw slotsError;
          (slots || []).forEach((s: any) => {
            if (s.closer_id) slotCloser.set(String(s.id), String(s.closer_id));
            if (s.scheduled_at) slotDate.set(String(s.id), String(s.scheduled_at));
          });
        }

        const buAttendeesAll = (attendees || []).filter((a: any) => {
          const closerId = a.meeting_slot_id ? slotCloser.get(String(a.meeting_slot_id)) : undefined;
          return !!closerId && buCloserIds.has(closerId);
        });
        buAttendeesAll.forEach((a: any) => {
          if (!a.deal_id) return;
          dealTemReuniaoBU.add(a.deal_id);
          if (a.status !== "cancelled" && a.status !== "invited") {
            dealTemReuniaoElegivel.add(a.deal_id);
            if (a.booked_by) dealTemBooker.add(a.deal_id);
            else if (!dealSemAgendador.has(a.deal_id)) {
              const closerId = a.meeting_slot_id ? slotCloser.get(String(a.meeting_slot_id)) : undefined;
              dealSemAgendador.set(a.deal_id, {
                attendeeId: String(a.id),
                dia: a.meeting_slot_id ? slotDate.get(String(a.meeting_slot_id)) ?? null : null,
                closerName: closerId ? closerNameById.get(closerId) ?? null : null,
              });
            }
          }
        });
        const buAttendees = buAttendeesAll.filter(
          (a: any) => a.booked_by && a.status !== "cancelled" && a.status !== "invited",
        );

        const bookerIds = [...new Set(buAttendees.map((a: any) => a.booked_by).filter(Boolean))];
        const emailById = new Map<string, string>();
        if (bookerIds.length > 0) {
          const { data: profs, error: profsError } = await supabase
            .from("profiles")
            .select("id, email")
            .in("id", bookerIds);
          if (profsError) throw profsError;
          (profs || []).forEach((p: any) => {
            if (p.email) emailById.set(p.id, String(p.email).toLowerCase());
          });
        }
        // O ÚLTIMO agendamento da BU define o SDR: o crédito vai para quem
        // remarcou e levou o cliente até a reunião que converteu, não para
        // quem tomou o no-show anterior.
        const sorted = [...buAttendees].sort((a: any, b: any) =>
          String(a.booked_at || a.created_at || "").localeCompare(String(b.booked_at || b.created_at || "")),
        );
        sorted.forEach((a: any) => {
          if (!a.deal_id) return;
          const email = emailById.get(a.booked_by);
          if (email) {
            dealBooker.set(a.deal_id, {
              email,
              at: String(a.booked_at || a.created_at || ""),
            });
          }
        });
      }

      const byCloser = new Map<string, number>();
      const bySdr = new Map<string, number>();
      const creditoByCloser = new Map<string, number>();
      const creditoBySdr = new Map<string, number>();
      const clientesCloserSets = new Map<string, Set<string>>();
      const clientesSdrSets = new Map<string, Set<string>>();
      const clientesTotal = new Set<string>();
      const clientesSemVinculoSet = new Set<string>();
      const clientesSemCloserSet = new Set<string>();
      let totalCredito = 0;
      let creditoSemVinculo = 0;
      let creditoSemCloser = 0;
      let total = 0;
      let semVinculo = 0;
      let semCloser = 0;
      const semVinculoItems: CotaResiduoItem[] = [];
      const cadastroSemLeadItems: CotaResiduoItem[] = [];
      let cadastroSemLead = 0;
      let creditoCadastroSemLead = 0;
      const semCloserItems: CotaResiduoItem[] = [];

      const baseItem = (
        card: any,
        dealId: string | null,
        motivo: string,
        problema?: CotaProblema,
        agendamento?: AgendamentoSemAgendador | null,
      ): CotaResiduoItem => {
        const reg = cardToReg.get(card.id);
        return {
          cardId: card.id,
          cliente: card.nome_completo || "—",
          grupo: card.grupo ?? null,
          cota: card.cota ?? null,
          dataContratacao: card.data_contratacao ?? null,
          valorCredito: card.valor_credito ?? null,
          vendedorName: card.vendedor_name ?? null,
          dealId,
          motivo,
          problema,
          agendamento: agendamento ?? null,
          pendingRegId: reg?.id ?? null,
          ajuste: reg?.deal_vinculo_ajustado_em
            ? {
                porId: reg.deal_vinculo_ajustado_por ?? null,
                em: reg.deal_vinculo_ajustado_em ?? null,
                dealAnterior: reg.deal_vinculo_anterior ?? null,
              }
            : null,
        };
      };

      const diaBr = (iso?: string | null) => {
        if (!iso) return null;
        try {
          return format(iso.length <= 10 ? new Date(`${iso}T12:00:00`) : new Date(iso), "dd/MM");
        } catch {
          return null;
        }
      };

      /**
       * Diagnóstico em cascata de UMA cota: para em qual elo a cadeia
       * cota → cadastro → lead → reunião de consórcio → agendador se rompe.
       */
      const diagnosticarCota = (
        cardId: string,
        dealId: string | null,
      ): { problema: CotaProblema; motivo: string; agendamento: AgendamentoSemAgendador | null } => {
        if (!cardsComCadastro.has(cardId)) {
          return {
            problema: "sem_cadastro",
            motivo:
              "Cota sem nenhum cadastro pendente — foi criada direto no Controle Consórcio, sem passar pelo fluxo de venda.",
            agendamento: null,
          };
        }
        if (!dealId) {
          return {
            problema: "sem_lead",
            motivo:
              "Cadastro pendente existe, mas sem lead vinculado (deal_id nulo) — vincular a cota ao negócio no CRM.",
            agendamento: null,
          };
        }
        if (!dealsExistentes.has(dealId)) {
          return {
            problema: "deal_inexistente",
            motivo:
              "Cadastro aponta para um negócio que não existe mais no CRM — revincular a cota a um lead válido.",
            agendamento: null,
          };
        }
        if (!dealTemReuniaoBU.has(dealId)) {
          return {
            problema: "sem_reuniao_bu",
            motivo:
              "Lead vinculado, mas sem nenhuma reunião conduzida por closer da BU Consórcio — a venda não passou por R1 desta BU.",
            agendamento: null,
          };
        }
        if (!dealTemReuniaoElegivel.has(dealId)) {
          return {
            problema: "reuniao_nao_elegivel",
            motivo:
              "As reuniões de consórcio do lead estão todas como convite/cancelada — atualizar o status do attendee.",
            agendamento: null,
          };
        }
        if (!dealTemBooker.has(dealId)) {
          const ag = dealSemAgendador.get(dealId) || null;
          const quando = diaBr(ag?.dia);
          return {
            problema: "sem_agendador",
            motivo: `Reunião de consórcio elegível${quando ? ` em ${quando}` : ""}${
              ag?.closerName ? ` com ${ag.closerName}` : ""
            }, mas sem agendador registrado — informar quem agendou.`,
            agendamento: ag,
          };
        }
        return {
          problema: "perfil_sem_email",
          motivo: "Agendador registrado, mas sem e-mail no perfil — completar o cadastro do usuário.",
          agendamento: null,
        };
      };

      /** Prioridade do diagnóstico do CLIENTE: mostra primeiro o elo que tem correção. */
      const PRIORIDADE: CotaProblema[] = [
        "sem_agendador",
        "perfil_sem_email",
        "sem_lead",
        "sem_cadastro",
        "deal_inexistente",
        "reuniao_nao_elegivel",
        "sem_reuniao_bu",
        "sem_vendedor",
      ];

      // Passo 1 — cotas dentro do filtro, agrupadas por CLIENTE.
      type Linha = { card: any; dealId: string | null; credito: number; pessoa: string };
      const linhas: Linha[] = [];
      const porCliente = new Map<string, Linha[]>();
      cards.forEach((card) => {
        const dealId = cardToDeal.get(card.id) ?? null;
        if (allowedOriginNames) {
          const origin = dealId ? dealOrigin.get(dealId) : undefined;
          if (!origin || !allowedOriginNames.has(origin)) return;
        }
        const linha: Linha = {
          card,
          dealId,
          credito: Number(card.valor_credito) || 0,
          pessoa: clienteKey(card),
        };
        linhas.push(linha);
        if (!porCliente.has(linha.pessoa)) porCliente.set(linha.pessoa, []);
        porCliente.get(linha.pessoa)!.push(linha);
      });

      // Passo 2 — o CLIENTE é a unidade de atribuição: se qualquer cota dele
      // tem lead com agendamento elegível de consórcio, todas as cotas e todo
      // o crédito vão para o SDR do ÚLTIMO desses agendamentos.
      const clienteSdr = new Map<string, string>();
      porCliente.forEach((rs, pessoa) => {
        let melhor: { email: string; at: string } | null = null;
        rs.forEach((r) => {
          const b = r.dealId ? dealBooker.get(r.dealId) : undefined;
          if (b && (!melhor || b.at.localeCompare(melhor.at) > 0)) melhor = b;
        });
        if (melhor) clienteSdr.set(pessoa, melhor.email);
      });

      // Diagnóstico do CLIENTE: entre as cotas dele, o elo rompido que tem a
      // correção mais efetiva. Corrigir o agendador de uma cota resolve todas.
      const clienteDiag = new Map<
        string,
        { problema: CotaProblema; motivo: string; agendamento: AgendamentoSemAgendador | null }
      >();
      porCliente.forEach((rs, pessoa) => {
        let melhor: { problema: CotaProblema; motivo: string; agendamento: AgendamentoSemAgendador | null } | null = null;
        rs.forEach((r) => {
          const d = diagnosticarCota(r.card.id, r.dealId);
          if (!melhor || PRIORIDADE.indexOf(d.problema) < PRIORIDADE.indexOf(melhor.problema)) melhor = d;
        });
        if (melhor) clienteDiag.set(pessoa, melhor);
      });

      linhas.forEach(({ card, dealId, credito, pessoa }) => {
        total++;
        totalCredito += credito;
        clientesTotal.add(pessoa);

        const closerId = closerByName.get(nameKey(card.vendedor_name) || "");
        if (closerId) {
          byCloser.set(closerId, (byCloser.get(closerId) || 0) + 1);
          creditoByCloser.set(closerId, (creditoByCloser.get(closerId) || 0) + credito);
          if (!clientesCloserSets.has(closerId)) clientesCloserSets.set(closerId, new Set());
          clientesCloserSets.get(closerId)!.add(pessoa);
        }
        else {
          semCloser++;
          creditoSemCloser += credito;
          clientesSemCloserSet.add(pessoa);
          const vendedor = (card.vendedor_name || "").trim();
          semCloserItems.push(
            baseItem(
              card,
              dealId ?? null,
              vendedor
                ? `Vendedor gravado como "${vendedor}", que não corresponde a nenhum closer cadastrado na BU Consórcio — corrigir a grafia na cota ou o cadastro do closer.`
                : "Campo Vendedor está vazio na cota — preencher o vendedor no Controle Consórcio.",
              "sem_vendedor",
            ),
          );
        }

        // Atribuição por cliente (não por cota).
        const sdrEmail = clienteSdr.get(pessoa);
        if (sdrEmail) {
          bySdr.set(sdrEmail, (bySdr.get(sdrEmail) || 0) + 1);
          creditoBySdr.set(sdrEmail, (creditoBySdr.get(sdrEmail) || 0) + credito);
          if (!clientesSdrSets.has(sdrEmail)) clientesSdrSets.set(sdrEmail, new Set());
          clientesSdrSets.get(sdrEmail)!.add(pessoa);
        } else {
          semVinculo++;
          creditoSemVinculo += credito;
          clientesSemVinculoSet.add(pessoa);
          const diag = clienteDiag.get(pessoa);
          semVinculoItems.push(
            baseItem(
              card,
              dealId ?? null,
              diag?.motivo ||
                "Nenhuma cota deste cliente tem lead com reunião de consórcio elegível — não há agendador a quem creditar a venda.",
              diag?.problema,
              diag?.agendamento ?? null,
            ),
          );
        }

        // Indicador separado: qualidade do cadastro DESTA cota.
        const temBookerProprio = !!(dealId && dealBooker.get(dealId));
        if (!temBookerProprio) {
          const diag = diagnosticarCota(card.id, dealId ?? null);
          cadastroSemLead++;
          creditoCadastroSemLead += credito;
          const item = baseItem(card, dealId ?? null, diag.motivo, diag.problema, diag.agendamento);
          (item as any).__sdrEmail = sdrEmail || null;
          cadastroSemLeadItems.push(item);
        }
      });

      // Nomes dos SDRs atribuídos (inclui quem não teve atividade na agenda do período).
      const sdrNames = new Map<string, string>();
      const sdrEmails = Array.from(new Set(Array.from(bySdr.keys())));
      if (sdrEmails.length > 0) {
        const { data: sdrProfiles, error: sdrProfilesError } = await supabase
          .from("profiles")
          .select("email, full_name")
          .in("email", sdrEmails);
        if (sdrProfilesError) throw sdrProfilesError;
        (sdrProfiles || []).forEach((p: any) => {
          if (p.email) sdrNames.set(String(p.email).toLowerCase(), p.full_name || String(p.email));
        });
      }

      // Selo por linha: o resultado deste cliente já foi creditado por outra cota.
      cadastroSemLeadItems.forEach((item) => {
        const email = (item as any).__sdrEmail as string | null;
        delete (item as any).__sdrEmail;
        item.atribuidoA = email ? sdrNames.get(email) || email : null;
      });

      const porData = (a: CotaResiduoItem, b: CotaResiduoItem) =>
        String(b.dataContratacao || "").localeCompare(String(a.dataContratacao || ""));
      semVinculoItems.sort(porData);
      cadastroSemLeadItems.sort(porData);
      semCloserItems.sort(porData);

      return {
        total, byCloser, bySdr, sdrNames, semVinculo, semCloser,
        semVinculoItems, semCloserItems,
        cadastroSemLead, creditoCadastroSemLead, cadastroSemLeadItems,
        clientesByCloser: new Map(
          Array.from(clientesCloserSets.entries()).map(([k, s]) => [k, s.size]),
        ),
        clientesBySdr: new Map(
          Array.from(clientesSdrSets.entries()).map(([k, s]) => [k, s.size]),
        ),
        creditoByCloser,
        creditoBySdr,
        clientesSemVinculo: clientesSemVinculoSet.size,
        creditoSemVinculo,
        clientesSemCloser: clientesSemCloserSet.size,
        creditoSemCloser,
        totalClientes: clientesTotal.size,
        totalCredito,
      };
    },
    enabled: !!startDate && !!endDate,
    staleTime: 30000,
  });
}
