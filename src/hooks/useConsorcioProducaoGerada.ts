import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { nameKey } from "@/hooks/useConsorcioCotasContratadas";

/**
 * PRODUÇÃO GERADA — crédito de TODAS as vendas lançadas, de "Termo de Adesão
 * Pendente" (etapa 3) em diante, contando cada venda UMA única vez, no mês em
 * que ela APARECEU no sistema. A venda nunca sai desse mês: nem se contratar
 * depois, nem se nunca contratar.
 *
 * TRÊS PERNAS DECLARADAS, deduplicadas:
 *  - Perna A (funil): cartas de propostas `status='aceita'`, âncora
 *    `coalesce(aceite_date, proposal_date)`. Cartas DECLINADAS contam (o closer
 *    gerou a venda). Propostas apagadas (`deleted_at`) ou marcadas
 *    `carta_excluida` NÃO contam — e essa é a única exclusão.
 *  - Perna B (avulso): a unidade é o CADASTRO (`consorcio_pending_registrations`),
 *    não a cota. Todo cadastro não vinculado a proposta pelos QUATRO caminhos,
 *    âncora `aceite_date`, QUALQUER status (`aguardando_abertura`, `cota_aberta`,
 *    `vinculada`, `declinada` — sem lista branca de status, de propósito: status
 *    novo entra sozinho). Cadastro parado na etapa 4 ou 5 conta igual.
 *  - Perna C (resíduo legado): `consortium_cards` SEM cadastro nenhum apontando
 *    para eles e sem proposta, âncora `data_contratacao` ESTRITA. É a base
 *    histórica/importada, onde não existe data confiável de primeira aparição.
 *    Encolhe sozinha.
 *
 * REGRA ANTI-DUPLA-CONTAGEM NO TEMPO (explícita): o CADASTRO é a unidade; o card
 * só entra (perna C) quando NÃO existe cadastro apontando para ele. Um cadastro
 * de agosto que vira cota contratada em setembro continua sendo o mesmo registro,
 * contado uma única vez, em agosto.
 *
 * DEDUP — QUATRO caminhos, e esta lista é o coração da coluna:
 *  1. `consorcio_proposals.consortium_card_id`
 *  2. `consorcio_proposal_cartas.consortium_card_id`
 *  3. `consorcio_proposal_cartas.pending_registration_id` → `…​.consortium_card_id`
 *  4. `consorcio_pending_registrations.proposal_id`
 * ATENÇÃO: REMOVER QUALQUER UM DESTES CAMINHOS DUPLICA DINHEIRO. O caminho 4 é
 * o único que pega cadastro de proposta que ainda não abriu cota (etapa 4) —
 * sem ele, agosto/2026 infla R$ 2,09 mi contando o mesmo crédito na perna A e
 * na perna B.
 *
 * SINALIZADOR DE ANTEDATAÇÃO: cadastro cujo `aceite_date` é de um mês ANTERIOR
 * ao mês do `created_at`. Só marca; o crédito conta normalmente. Sem severidade.
 *
 * 100% leitura. Nenhuma escrita, nenhum backfill.
 */

export interface ProducaoGeradaLinha {
  credito: number;
  /** Cartas (perna A) + cadastros (perna B) + cotas legadas (perna C). */
  cartas: number;
  /** Vendas: propostas (perna A) + clientes distintos nas pernas B e C. */
  vendas: number;
  /** Registros com `aceite_date` em mês anterior ao do lançamento (só sinaliza). */
  antedatados: number;
  /** Crédito desses registros — contado normalmente na soma. */
  antedatadosCredito: number;
  /**
   * AVISO, NÃO NÚMERO. Registros LANÇADOS neste período (`created_at` dentro do
   * filtro) cujo `aceite_date` é de mês anterior — ou seja, o crédito deles NÃO
   * está em `credito` aqui: ele conta no mês do aceite. Nunca somar isto na
   * coluna nem no total; serve só para o mês do lançamento poder dizer que
   * alguém lançou venda com data de aceite retroativa.
   */
  lancadosRetroativos: number;
  /** Crédito desses registros, contado em OUTRO mês (o do aceite). */
  lancadosRetroativosCredito: number;
}

export interface ConsorcioProducaoGerada {
  byCloser: Map<string, ProducaoGeradaLinha>;
  /** Balde explícito: nunca descartamos nem chutamos atribuição. */
  semAtribuicao: ProducaoGeradaLinha;
  total: ProducaoGeradaLinha;
  /** Diagnóstico das três pernas, para conferência. */
  pernaA: ProducaoGeradaLinha;
  pernaB: ProducaoGeradaLinha;
  pernaC: ProducaoGeradaLinha;
  /** Meses de âncora (YYYY-MM) onde o crédito dos lançamentos retroativos conta. */
  retroMesesAncora: string[];
}

const zero = (): ProducaoGeradaLinha => ({
  credito: 0,
  cartas: 0,
  vendas: 0,
  antedatados: 0,
  antedatadosCredito: 0,
  lancadosRetroativos: 0,
  lancadosRetroativosCredito: 0,
});

const EMPTY: ConsorcioProducaoGerada = {
  byCloser: new Map(),
  semAtribuicao: zero(),
  total: zero(),
  pernaA: zero(),
  pernaB: zero(),
  pernaC: zero(),
  retroMesesAncora: [],
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

      type CloserRow = { id: string; name: string | null; email: string | null; is_active: boolean | null; created_at: string | null };
      const linhas = (closers || []) as CloserRow[];
      const canonicoPorEmail = new Map<string, CloserRow>();
      const semEmail: CloserRow[] = [];
      linhas.forEach((c) => {
        const ek = emailKey(c.email);
        if (!ek) {
          semEmail.push(c);
          return;
        }
        const atual = canonicoPorEmail.get(ek);
        if (!atual) {
          canonicoPorEmail.set(ek, c);
          return;
        }
        const ativoDesempata = (atual.is_active === true) !== (c.is_active === true);
        const vencedor = ativoDesempata
          ? (c.is_active === true ? c : atual)
          : String(c.created_at || "") < String(atual.created_at || "")
            ? c
            : atual;
        canonicoPorEmail.set(ek, vencedor);
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
      const pernaC = zero();
      const add = (
        closerId: string,
        credito: number,
        cartas: number,
        vendas: number,
        antedatados = 0,
        antedatadosCredito = 0,
      ) => {
        const alvo = byCloser.get(closerId) || zero();
        alvo.credito += credito;
        alvo.cartas += cartas;
        alvo.vendas += vendas;
        alvo.antedatados += antedatados;
        alvo.antedatadosCredito += antedatadosCredito;
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

      // ══ PERNA B — CADASTROS sem proposta, âncora `aceite_date` ════════════
      // A unidade é o cadastro, não a cota: cadastro parado na etapa 4 (sem cota
      // aberta) ou na etapa 5 (reserva não contratada) conta igual. QUALQUER
      // status entra — não existe lista branca aqui de propósito.
      const { data: regsRaw, error: regsError } = await supabase
        .from("consorcio_pending_registrations")
        .select(
          "id, proposal_id, consortium_card_id, aceite_date, created_at, valor_credito, vendedor_name, vendedor_name_cota, cpf, cnpj, nome_completo, razao_social, status",
        )
        .gte("aceite_date", ini)
        .lte("aceite_date", fim);
      if (regsError) throw regsError;

      type RegRow = {
        id: string;
        proposal_id: string | null;
        consortium_card_id: string | null;
        aceite_date: string | null;
        created_at: string | null;
        valor_credito: number | null;
        vendedor_name: string | null;
        vendedor_name_cota: string | null;
        cpf: string | null;
        cnpj: string | null;
        nome_completo: string | null;
        razao_social: string | null;
        status: string | null;
      };
      const regs = (regsRaw || []) as RegRow[];

      /**
       * Cards vinculados a proposta pelos caminhos 1, 2 e 3.
       * REMOVER UM CAMINHO DUPLICA DINHEIRO — ver o cabeçalho deste arquivo.
       */
      const cardsVinculados = async (ids: string[]) => {
        const out = new Set<string>();
        for (const parte of chunk(ids.filter(Boolean))) {
          if (parte.length === 0) continue;
          const [viaProposta, viaCarta, viaCadastro] = await Promise.all([
            // caminho 1
            supabase.from("consorcio_proposals").select("consortium_card_id").in("consortium_card_id", parte),
            // caminho 2
            supabase
              .from("consorcio_proposal_cartas")
              .select("consortium_card_id")
              .in("consortium_card_id", parte),
            // caminho 3 (parte 1): cadastros que apontam para esses cards
            supabase
              .from("consorcio_pending_registrations")
              .select("id, consortium_card_id, proposal_id")
              .in("consortium_card_id", parte),
          ]);
          (viaProposta.data || []).forEach((r) => r.consortium_card_id && out.add(r.consortium_card_id));
          (viaCarta.data || []).forEach((r) => r.consortium_card_id && out.add(r.consortium_card_id));

          const ligados = (viaCadastro.data || []).filter((r) => r.consortium_card_id);
          // caminho 4 aplicado ao card: cadastro com proposta já traz o card.
          ligados.forEach((r) => {
            if (r.proposal_id && r.consortium_card_id) out.add(r.consortium_card_id);
          });
          // caminho 3 (parte 2): cadastro referenciado por uma carta.
          const regIds = ligados.map((r) => r.id);
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
          ligados.forEach((r) => {
            if (regsComCarta.has(r.id) && r.consortium_card_id) out.add(r.consortium_card_id);
          });
        }
        return out;
      };

      // Vínculo dos cadastros do período: caminho 4 (proposal_id direto),
      // caminho 2 (carta que referencia o cadastro) e caminhos 1/3 (o card do
      // cadastro já é um card de proposta).
      const regsComCartaPeriodo = new Set<string>();
      for (const parte of chunk(regs.map((r) => r.id))) {
        if (parte.length === 0) continue;
        const { data: cartasReg } = await supabase
          .from("consorcio_proposal_cartas")
          .select("pending_registration_id")
          .in("pending_registration_id", parte);
        (cartasReg || []).forEach((c) => {
          if (c.pending_registration_id) regsComCartaPeriodo.add(c.pending_registration_id);
        });
      }
      const cardsVincPeriodo = await cardsVinculados(
        regs.map((r) => r.consortium_card_id).filter(Boolean) as string[],
      );

      const regsAvulsos = regs.filter((r) => {
        if (r.proposal_id) return false; // caminho 4
        if (regsComCartaPeriodo.has(r.id)) return false; // caminho 2
        if (r.consortium_card_id && cardsVincPeriodo.has(r.consortium_card_id)) return false; // 1 e 3
        return true;
      });

      /** Antedatação: mês do aceite anterior ao mês do lançamento. Só sinaliza. */
      const antedatado = (r: RegRow) =>
        !!r.aceite_date &&
        !!r.created_at &&
        String(r.aceite_date).slice(0, 7) < String(r.created_at).slice(0, 7);

      const pessoasPorCloserB = new Map<string, Set<string>>();
      regsAvulsos.forEach((r) => {
        const credito = Number(r.valor_credito || 0);
        const nome = r.vendedor_name_cota || r.vendedor_name;
        const closerId = nomeParaCloser.get(nameKey(nome) || "") || SEM_ATRIBUICAO;
        const flag = antedatado(r);
        add(closerId, credito, 1, 0, flag ? 1 : 0, flag ? credito : 0);
        if (!pessoasPorCloserB.has(closerId)) pessoasPorCloserB.set(closerId, new Set());
        pessoasPorCloserB
          .get(closerId)!
          .add(clientePessoaKey({ id: r.id, cpf: r.cpf, cnpj: r.cnpj, nome_completo: r.nome_completo || r.razao_social }));
        pernaB.credito += credito;
        pernaB.cartas += 1;
        if (flag) {
          pernaB.antedatados += 1;
          pernaB.antedatadosCredito += credito;
        }
      });
      pessoasPorCloserB.forEach((pessoas, closerId) => {
        add(closerId, 0, 0, pessoas.size);
        pernaB.vendas += pessoas.size;
      });

      // ══ PERNA C — resíduo legado: card SEM cadastro nenhum e sem proposta ══
      // Âncora `data_contratacao` estrita. Para esse grupo não existe data de
      // primeira aparição confiável (importação/digitação), e é exatamente por
      // isso que ele fica numa perna separada e declarada.
      const { data: cards, error: cardsError } = await supabase
        .from("consortium_cards")
        .select("id, vendedor_name, valor_credito, cpf, cnpj, nome_completo")
        .eq("tipo_registro", "contratacao")
        .gte("data_contratacao", ini)
        .lte("data_contratacao", fim);
      if (cardsError) throw cardsError;

      const cardIds = (cards || []).map((c) => c.id);
      const cardsComCadastro = new Set<string>();
      for (const parte of chunk(cardIds)) {
        if (parte.length === 0) continue;
        const { data: regsDoCard } = await supabase
          .from("consorcio_pending_registrations")
          .select("consortium_card_id")
          .in("consortium_card_id", parte);
        (regsDoCard || []).forEach((r) => r.consortium_card_id && cardsComCadastro.add(r.consortium_card_id));
      }
      const cardsVincC = await cardsVinculados(cardIds);

      const residuo = (cards || []).filter(
        // Card com cadastro NÃO entra aqui: ele já é (ou será) contado como
        // cadastro na perna B, no mês do aceite. É esta linha que impede a
        // dupla contagem entre meses.
        (c) => !cardsComCadastro.has(c.id) && !cardsVincC.has(c.id),
      );
      const pessoasPorCloserC = new Map<string, Set<string>>();
      residuo.forEach((card) => {
        const credito = Number(card.valor_credito || 0);
        const closerId = nomeParaCloser.get(nameKey(card.vendedor_name) || "") || SEM_ATRIBUICAO;
        add(closerId, credito, 1, 0);
        if (!pessoasPorCloserC.has(closerId)) pessoasPorCloserC.set(closerId, new Set());
        pessoasPorCloserC.get(closerId)!.add(clientePessoaKey(card));
        pernaC.credito += credito;
        pernaC.cartas += 1;
      });
      pessoasPorCloserC.forEach((pessoas, closerId) => {
        add(closerId, 0, 0, pessoas.size);
        pernaC.vendas += pessoas.size;
      });

      const semAtribuicao = byCloser.get(SEM_ATRIBUICAO) || zero();
      byCloser.delete(SEM_ATRIBUICAO);

      const total = zero();
      byCloser.forEach((l) => {
        total.credito += l.credito;
        total.cartas += l.cartas;
        total.vendas += l.vendas;
        total.antedatados += l.antedatados;
        total.antedatadosCredito += l.antedatadosCredito;
      });
      total.credito += semAtribuicao.credito;
      total.cartas += semAtribuicao.cartas;
      total.vendas += semAtribuicao.vendas;
      total.antedatados += semAtribuicao.antedatados;
      total.antedatadosCredito += semAtribuicao.antedatadosCredito;

      return { byCloser, semAtribuicao, total, pernaA, pernaB, pernaC };
    },
    enabled: !!startDate && !!endDate,
  });
}

