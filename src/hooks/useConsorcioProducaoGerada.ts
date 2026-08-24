import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { nameKey } from "@/hooks/useConsorcioCotasContratadas";

/**
 * PRODUÇÃO GERADA — crédito de TODAS as vendas lançadas, de "Termo de Adesão
 * Pendente" (etapa 3) em diante, contando cada venda UMA única vez, no mês em
 * que ela apareceu no sistema.
 *
 * União de duas fontes, deduplicada:
 *  - Perna A (funil): cartas de propostas `status='aceita'`, âncora
 *    `coalesce(aceite_date, proposal_date)`. Cartas DECLINADAS contam (o closer
 *    gerou a venda). Propostas apagadas (`deleted_at`) ou marcadas
 *    `carta_excluida` NÃO contam — e essa é a única exclusão.
 *  - Perna B (legado/avulso): cotas de `consortium_cards`
 *    (`tipo_registro='contratacao'`) que NÃO vieram de proposta nenhuma,
 *    âncora `data_contratacao` ESTRITA (sem fallback em `data_reserva` nem
 *    `created_at`, para a coluna ser comparável ao Consórcio Efetivado).
 *
 * Dedup: o conjunto "vinculado" é a UNIÃO dos três caminhos
 * (`consorcio_proposals.consortium_card_id`,
 *  `consorcio_proposal_cartas.consortium_card_id` e
 *  `consorcio_proposal_cartas.pending_registration_id` →
 *  `consorcio_pending_registrations.consortium_card_id`). Existe cota que só
 * aparece pelo terceiro caminho: usar menos que os três conta ela duas vezes.
 *
 * À medida que o funil vira a única porta de entrada, a perna B cai a zero
 * sozinha — a definição da coluna não muda.
 *
 * 100% leitura. Nenhuma escrita, nenhum backfill.
 */

export interface ProducaoGeradaLinha {
  credito: number;
  /** Cartas (perna A) + cotas sem proposta (perna B). */
  cartas: number;
  /** Vendas: propostas (perna A) + clientes distintos das cotas avulsas (perna B). */
  vendas: number;
}

export interface ConsorcioProducaoGerada {
  byCloser: Map<string, ProducaoGeradaLinha>;
  /** Balde explícito: nunca descartamos nem chutamos atribuição. */
  semAtribuicao: ProducaoGeradaLinha;
  total: ProducaoGeradaLinha;
  /** Diagnóstico das duas pernas, para conferência. */
  pernaA: ProducaoGeradaLinha;
  pernaB: ProducaoGeradaLinha;
}

const zero = (): ProducaoGeradaLinha => ({ credito: 0, cartas: 0, vendas: 0 });

const EMPTY: ConsorcioProducaoGerada = {
  byCloser: new Map(),
  semAtribuicao: zero(),
  total: zero(),
  pernaA: zero(),
  pernaB: zero(),
};

const SEM_ATRIBUICAO = "__sem_atribuicao__";

function chunk<T>(arr: T[], size = 200): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function emailKey(email?: string | null): string | null {
  const e = String(email || "").trim().toLowerCase();
  return e || null;
}

/** Identidade da pessoa titular (mesma regra da coluna Vendas Realizadas). */
function clientePessoaKey(card: {
  id: string;
  cpf?: string | null;
  cnpj?: string | null;
  nome_completo?: string | null;
}): string {
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

export function useConsorcioProducaoGerada(
  startDate: Date | null,
  endDate: Date | null,
  bu: string = "consorcio",
) {
  return useQuery({
    queryKey: [
      "consorcio-producao-gerada",
      startDate ? format(startDate, "yyyy-MM-dd") : null,
      endDate ? format(endDate, "yyyy-MM-dd") : null,
      bu,
    ],
    queryFn: async (): Promise<ConsorcioProducaoGerada> => {
      if (!startDate || !endDate) return EMPTY;
      const ini = format(startDate, "yyyy-MM-dd");
      const fim = format(endDate, "yyyy-MM-dd");

      // ── Closers canônicos da BU ────────────────────────────────────────────
      // A mesma pessoa pode ter mais de uma linha em `closers` com o mesmo
      // e-mail (uma inativa). Colapsamos por e-mail normalizado preferindo a
      // ativa; empate resolve pela mais antiga. A chave de merge entre as duas
      // pernas é SEMPRE o closer_id canônico, nunca a string do nome.
      const { data: closers, error: closersError } = await supabase
        .from("closers")
        .select("id, name, email, is_active, created_at")
        .eq("bu", bu);
      if (closersError) throw closersError;

      const canonicoPorEmail = new Map<string, { id: string; name: string | null }>();
      const semEmail: { id: string; name: string | null }[] = [];
      (closers || []).forEach((c) => {
        const ek = emailKey(c.email);
        if (!ek) {
          semEmail.push({ id: c.id, name: c.name });
          return;
        }
        const atual = (closers || []).find((x) => x.id === canonicoPorEmail.get(ek)?.id);
        if (!atual) {
          canonicoPorEmail.set(ek, { id: c.id, name: c.name });
          return;
        }
        const melhorAtivo = (atual.is_active === true) !== (c.is_active === true)
          ? (c.is_active === true ? c : atual)
          : String(c.created_at || "") < String(atual.created_at || "")
            ? c
            : atual;
        canonicoPorEmail.set(ek, { id: melhorAtivo.id, name: melhorAtivo.name });
      });

      /** id de qualquer linha de `closers` da BU → id canônico. */
      const idCanonico = new Map<string, string>();
      (closers || []).forEach((c) => {
        const ek = emailKey(c.email);
        const canon = ek ? canonicoPorEmail.get(ek)?.id : c.id;
        idCanonico.set(c.id, canon || c.id);
      });

      const emailParaCloser = new Map<string, string>();
      canonicoPorEmail.forEach((v, ek) => emailParaCloser.set(ek, v.id));

      const nomeParaCloser = new Map<string, string>();
      [...canonicoPorEmail.values(), ...semEmail].forEach((c) => {
        const k = nameKey(c.name);
        if (k && !nomeParaCloser.has(k)) nomeParaCloser.set(k, c.id);
      });

      // ── Acumuladores ──────────────────────────────────────────────────────
      const byCloser = new Map<string, ProducaoGeradaLinha>();
      const pernaA = zero();
      const pernaB = zero();
      const add = (closerId: string, credito: number, cartas: number, vendas: number) => {
        const alvo = byCloser.get(closerId) || zero();
        alvo.credito += credito;
        alvo.cartas += cartas;
        alvo.vendas += vendas;
        byCloser.set(closerId, alvo);
      };

      // ══ PERNA A — cartas de propostas lançadas (etapa 3 em diante) ════════
      const { data: propsRaw, error: propsError } = await supabase
        .from("consorcio_proposals")
        .select("id, deal_id, created_by, proposal_date, aceite_date, deleted_at, carta_excluida")
        .eq("status", "aceita");
      if (propsError) throw propsError;

      const propostas = (propsRaw || []).filter((p) => {
        if (p.deleted_at) return false;
        if (p.carta_excluida === true) return false;
        const ancora = String(p.aceite_date || p.proposal_date || "").slice(0, 10);
        return !!ancora && ancora >= ini && ancora <= fim;
      });

      const propostaIds = propostas.map((p) => p.id);

      // Cartas das propostas do período (declinadas incluídas de propósito).
      const cartasPorProposta = new Map<string, { credito: number; qtd: number }>();
      for (const parte of chunk(propostaIds)) {
        if (parte.length === 0) continue;
        const { data: cartas, error: cartasError } = await supabase
          .from("consorcio_proposal_cartas")
          .select("id, proposal_id, valor_credito")
          .in("proposal_id", parte);
        if (cartasError) throw cartasError;
        (cartas || []).forEach((c) => {
          const acc = cartasPorProposta.get(c.proposal_id) || { credito: 0, qtd: 0 };
          acc.credito += Number(c.valor_credito || 0);
          acc.qtd += 1;
          cartasPorProposta.set(c.proposal_id, acc);
        });
      }

      // Cadeia de atribuição: created_by → perfil → closer.
      const criadorIds = [...new Set(propostas.map((p) => p.created_by).filter(Boolean) as string[])];
      const criadorParaCloser = new Map<string, string>();
      for (const parte of chunk(criadorIds)) {
        if (parte.length === 0) continue;
        const { data: profs } = await supabase.from("profiles").select("id, email").in("id", parte);
        (profs || []).forEach((p) => {
          const cid = emailParaCloser.get(emailKey(p.email) || "");
          if (cid) criadorParaCloser.set(p.id, cid);
        });
      }

      // Fallback 1: dono do deal (owner_id guarda e-mail).
      const dealIdsA = [...new Set(propostas.map((p) => p.deal_id).filter(Boolean) as string[])];
      const dealParaCloser = new Map<string, string>();
      for (const parte of chunk(dealIdsA)) {
        if (parte.length === 0) continue;
        const { data: deals } = await supabase.from("crm_deals").select("id, owner_id").in("id", parte);
        (deals || []).forEach((d) => {
          const cid = emailParaCloser.get(emailKey(d.owner_id) || "");
          if (cid) dealParaCloser.set(d.id, cid);
        });
      }

      // Fallback 2: closer da reunião (a mais recente do deal).
      const dealParaCloserReuniao = new Map<string, { closerId: string; at: string }>();
      for (const parte of chunk(dealIdsA)) {
        if (parte.length === 0) continue;
        const { data: atts } = await supabase
          .from("meeting_slot_attendees")
          .select("deal_id, meeting_slot_id")
          .in("deal_id", parte);
        const slotIds = [...new Set((atts || []).map((a) => a.meeting_slot_id).filter(Boolean) as string[])];
        const slotInfo = new Map<string, { closerId: string | null; at: string }>();
        for (const slotParte of chunk(slotIds)) {
          if (slotParte.length === 0) continue;
          const { data: slots } = await supabase
            .from("meeting_slots")
            .select("id, closer_id, scheduled_at")
            .in("id", slotParte);
          (slots || []).forEach((s) => {
            slotInfo.set(s.id, { closerId: s.closer_id, at: String(s.scheduled_at || "") });
          });
        }
        (atts || []).forEach((a) => {
          if (!a.deal_id) return;
          const info = slotInfo.get(a.meeting_slot_id);
          if (!info?.closerId) return;
          const canon = idCanonico.get(info.closerId);
          if (!canon) return; // reunião de closer de outra BU não atribui
          const atual = dealParaCloserReuniao.get(a.deal_id);
          if (!atual || info.at.localeCompare(atual.at) > 0) {
            dealParaCloserReuniao.set(a.deal_id, { closerId: canon, at: info.at });
          }
        });
      }

      propostas.forEach((p) => {
        const agg = cartasPorProposta.get(p.id);
        if (!agg) return; // proposta sem carta não gera crédito
        let closerId: string | undefined;
        if (p.created_by) closerId = criadorParaCloser.get(p.created_by);
        if (!closerId && p.deal_id) closerId = dealParaCloser.get(p.deal_id);
        if (!closerId && p.deal_id) closerId = dealParaCloserReuniao.get(p.deal_id)?.closerId;
        add(closerId || SEM_ATRIBUICAO, agg.credito, agg.qtd, 1);
        pernaA.credito += agg.credito;
        pernaA.cartas += agg.qtd;
        pernaA.vendas += 1;
      });

      // ══ PERNA B — cotas sem proposta nenhuma ═════════════════════════════
      const { data: cards, error: cardsError } = await supabase
        .from("consortium_cards")
        .select("id, vendedor_name, valor_credito, cpf, cnpj, nome_completo")
        .eq("tipo_registro", "contratacao")
        .gte("data_contratacao", ini)
        .lte("data_contratacao", fim);
      if (cardsError) throw cardsError;

      const cardIds = (cards || []).map((c) => c.id);

      // Conjunto vinculado: UNIÃO dos três caminhos.
      const vinculadas = new Set<string>();
      for (const parte of chunk(cardIds)) {
        if (parte.length === 0) continue;
        const [viaProposta, viaCarta, viaCadastro] = await Promise.all([
          supabase.from("consorcio_proposals").select("consortium_card_id").in("consortium_card_id", parte),
          supabase.from("consorcio_proposal_cartas").select("consortium_card_id").in("consortium_card_id", parte),
          supabase
            .from("consorcio_pending_registrations")
            .select("consortium_card_id, id")
            .in("consortium_card_id", parte),
        ]);
        (viaProposta.data || []).forEach((r) => r.consortium_card_id && vinculadas.add(r.consortium_card_id));
        (viaCarta.data || []).forEach((r) => r.consortium_card_id && vinculadas.add(r.consortium_card_id));

        // Terceiro caminho: cadastro pendente que é referenciado por uma carta.
        const regs = (viaCadastro.data || []).filter((r) => r.consortium_card_id);
        const regIds = regs.map((r) => r.id);
        const regsComCarta = new Set<string>();
        for (const regParte of chunk(regIds)) {
          if (regParte.length === 0) continue;
          const { data: cartasReg } = await supabase
            .from("consorcio_proposal_cartas")
            .select("pending_registration_id")
            .in("pending_registration_id", regParte);
          (cartasReg || []).forEach((c) => {
            if (c.pending_registration_id) regsComCarta.add(c.pending_registration_id);
          });
        }
        regs.forEach((r) => {
          if (regsComCarta.has(r.id) && r.consortium_card_id) vinculadas.add(r.consortium_card_id);
        });
      }

      const avulsas = (cards || []).filter((c) => !vinculadas.has(c.id));
      // Vendas da perna B = clientes distintos (uma pessoa com 3 cotas = 1 venda).
      const pessoasPorCloser = new Map<string, Set<string>>();
      avulsas.forEach((card) => {
        const credito = Number(card.valor_credito || 0);
        const closerId = nomeParaCloser.get(nameKey(card.vendedor_name) || "") || SEM_ATRIBUICAO;
        add(closerId, credito, 1, 0);
        if (!pessoasPorCloser.has(closerId)) pessoasPorCloser.set(closerId, new Set());
        pessoasPorCloser.get(closerId)!.add(clientePessoaKey(card));
        pernaB.credito += credito;
        pernaB.cartas += 1;
      });
      pessoasPorCloser.forEach((pessoas, closerId) => {
        add(closerId, 0, 0, pessoas.size);
        pernaB.vendas += pessoas.size;
      });

      const semAtribuicao = byCloser.get(SEM_ATRIBUICAO) || zero();
      byCloser.delete(SEM_ATRIBUICAO);

      const total = zero();
      byCloser.forEach((l) => {
        total.credito += l.credito;
        total.cartas += l.cartas;
        total.vendas += l.vendas;
      });
      total.credito += semAtribuicao.credito;
      total.cartas += semAtribuicao.cartas;
      total.vendas += semAtribuicao.vendas;

      return { byCloser, semAtribuicao, total, pernaA, pernaB };
    },
    enabled: !!startDate && !!endDate,
  });
}
