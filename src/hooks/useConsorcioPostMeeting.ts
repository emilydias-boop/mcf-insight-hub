import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { fetchPendingRegsWithDocs } from '@/lib/consorcioDocumentosPendentes';
import type { PropostaCarta, PropostaCartaInput } from '@/types/consorcioCartas';

import {
  PAGE_SIZE,
  CHUNK_SIZE,
  MAX_PAGES,
  isRangeExhausted,
  fetchAllPages,
  fetchAllByIds,
} from '@/lib/supabasePaginacao';

// Stage IDs
const CONSORCIO_STAGE_IDS = {
  // Viver de Aluguel
  VDA_R1_REALIZADA: '0f450ec9-0f00-4fbe-8400-cdb2440897e5',
  VDA_PROPOSTA_ENVIADA: '09a0a99e-feee-46df-a817-bc4d0e1ac3d9',
  VDA_CONTRATO_PAGO: 'a35fea26-805e-40d5-b604-56fd6319addf',
  VDA_VENDA_REALIZADA: 'aa194279-c40e-458d-80aa-c5179b414658',
  VDA_SEM_SUCESSO: '86bcc03c-17be-4e1c-8018-497c46b6eee4',
  // Efeito Alavanca
  EA_R1_REALIZADA: 'f7c48a43-4ca3-45a1-85d0-e6da76c3cff2',
  EA_SEM_SUCESSO: 'c2c7288b-809a-4c65-8ea9-ac4bcbe795ab',
};

const CONSORCIO_ORIGIN_IDS = [
  '4e2b810a-6782-4ce9-9c0d-10d04c018636', // Viver de Aluguel
  '7d7b1cb5-2a44-4552-9eff-c3b798646b78', // Efeito Alavanca
];

const R1_REALIZADA_IDS = [
  CONSORCIO_STAGE_IDS.VDA_R1_REALIZADA,
  CONSORCIO_STAGE_IDS.EA_R1_REALIZADA,
];

const SEM_SUCESSO_IDS = [
  CONSORCIO_STAGE_IDS.VDA_SEM_SUCESSO,
  CONSORCIO_STAGE_IDS.EA_SEM_SUCESSO,
];

// ---------------------------------------------------------------------------
// Helpers robustos contra o limite de 1000 linhas do PostgREST
// ---------------------------------------------------------------------------

// Os helpers de paginação vivem em '@/lib/supabasePaginacao'.
export { PAGE_SIZE, CHUNK_SIZE, MAX_PAGES, isRangeExhausted, fetchAllPages, fetchAllByIds };

export interface DealMeetingInfo {
  date: string;
  closer_notes: string;
  notes: string;
}

/**
 * Data REAL da reunião por deal.
 * - Busca em lotes de 200 deal_ids (nunca estoura o limite de 1000 linhas)
 * - Ignora reuniões canceladas
 * - Prioriza meeting_type='r1' quando existir
 * - Entre as opções válidas, usa o scheduled_at mais recente
 */
export async function fetchMeetingInfoByDeal(
  dealIds: string[]
): Promise<Record<string, DealMeetingInfo>> {
  const result: Record<string, DealMeetingInfo> = {};
  const unique = Array.from(new Set(dealIds.filter(Boolean)));
  if (unique.length === 0) return result;

  // rank: r1 não cancelada > outra não cancelada
  const rankOf = (meetingType: string | null) =>
    (meetingType || '').toLowerCase() === 'r1' ? 2 : 1;
  const bestRank: Record<string, number> = {};

  for (let i = 0; i < unique.length; i += CHUNK_SIZE) {
    const chunk = unique.slice(i, i + CHUNK_SIZE);
    let rows: any[] = [];
    try {
      rows = await fetchAllPages<any>((from, to) =>
        supabase
          .from('meeting_slot_attendees')
          .select('deal_id, closer_notes, notes, meeting_slots (scheduled_at, meeting_type, status)')
          .in('deal_id', chunk)
          .order('id', { ascending: true })
          .range(from, to)
      );
    } catch (e) {
      // Nunca deixar a data da reunião derrubar a listagem inteira
      console.error('[PosReuniao] falha ao buscar data da reunião:', e);
      continue;
    }

    rows.forEach((a: any) => {
      const dealId = a.deal_id;
      if (!dealId) return;
      const slot = a.meeting_slots;
      const scheduledAt: string | null = slot?.scheduled_at || null;
      const slotStatus = (slot?.status || '').toLowerCase();
      if (!scheduledAt) return;
      if (slotStatus === 'cancelled' || slotStatus === 'canceled' || slotStatus === 'cancelada') return;

      const rank = rankOf(slot?.meeting_type);
      const currentRank = bestRank[dealId] ?? 0;
      const current = result[dealId];

      const better =
        rank > currentRank ||
        (rank === currentRank && (!current?.date || scheduledAt > current.date));

      if (better) {
        bestRank[dealId] = rank;
        result[dealId] = {
          date: scheduledAt,
          closer_notes: a.closer_notes || '',
          notes: a.notes || '',
        };
      } else if (current) {
        // preserva notas quando existirem em outro attendee
        if (!current.closer_notes && a.closer_notes) current.closer_notes = a.closer_notes;
        if (!current.notes && a.notes) current.notes = a.notes;
      }
    });
  }

  return result;
}

/** Ordena desc pela data real da reunião; sem data vai para o fim. */
function byMeetingDateDesc<T extends { meeting_date?: string }>(a: T, b: T) {
  const da = a.meeting_date || '';
  const db = b.meeting_date || '';
  if (!da && !db) return 0;
  if (!da) return 1;
  if (!db) return -1;
  return db.localeCompare(da);
}

export interface CompletedMeeting {
  deal_id: string;
  deal_name: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  closer_name: string;
  origin_name: string;
  origin_id: string;
  stage_id: string;
  stage_name: string;
  updated_at: string;
  meeting_date: string;
  region: string;
  renda: string;
  closer_notes?: string;
  cadastro_completo?: boolean;
  completa?: boolean;
  has_proposal?: boolean;
  closer_unknown?: boolean;
}

export interface AllMeetingDeal {
  deal_id: string;
  deal_name: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  closer_name: string;
  origin_name: string;
  origin_id: string;
  stage_id: string;
  stage_name: string;
  updated_at: string;
  meeting_date: string;
  region: string;
  renda: string;
  closer_notes: string;
  attendee_notes: string;
}

export interface Proposal {
  id: string;
  deal_id: string;
  deal_name: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  proposal_date: string;
  proposal_details: string;
  valor_credito: number;
  prazo_meses: number;
  tipo_produto: string;
  origem_lead?: string | null;
  status: string;
  aguardando_retorno?: boolean;
  aguardando_retorno_until?: string | null;
  /** Nota da R1 (closer_notes/notes de meeting_slot_attendees), somente leitura. */
  closer_notes?: string;
  aceite_date: string | null;
  motivo_recusa: string | null;
  consortium_card_id: string | null;
  /** Cartas da proposta (verdade por carta). Vazio só em proposta sem valor. */
  cartas?: PropostaCarta[];
  /** Quantidade de cartas (1 para propostas legadas). */
  qtd_cartas?: number;

  origin_id: string;
  carta_excluida?: boolean;
  carta_excluida_em?: string | null;
  carta_excluida_por_nome?: string | null;
  carta_excluida_motivo?: string | null;
  created_at: string;
  closer_name: string;
  meeting_date?: string;
  documentos_pendentes?: boolean;
  completa?: boolean;
  cadastro_completo?: boolean;
  owner_id?: string;
}

/**
 * Proposta ainda PENDENTE e sem valor de crédito registrado (nulo ou 0).
 * Cobre tanto o caminho "aguardando retorno" quanto qualquer outro caminho que
 * crie proposta sem valor. Não conta como carta negociada, não entra no card de
 * crédito e não pode ser cadastrada.
 */
export function isPropostaSemValor(p: {
  status?: string | null;
  aguardando_retorno?: boolean | null;
  valor_credito?: number | null;
}) {
  const pendente = !p.status || p.status === 'pendente';
  return pendente && !(Number(p.valor_credito) > 0);
}

/** Texto do selo âmbar: distingue "aguardando retorno" de proposta sem valor. */
export function labelPropostaSemValor(p: { aguardando_retorno?: boolean | null }) {
  return p.aguardando_retorno ? 'Aguardando retorno' : 'Sem valor registrado';
}

export interface SemSucessoDeal {
  deal_id: string;
  deal_name: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  origin_name: string;
  origin_id: string;
  stage_id: string;
  updated_at: string;
  motivo_recusa: string | null;
  proposal_id: string | null;
}

// Fetch deals em R1 Realizada (reuniões realizadas sem proposta ainda)
export function useRealizadas() {
  return useQuery({
    queryKey: ['consorcio-realizadas'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const data = await fetchAllPages<any>((from, to) =>
        supabase
          .from('crm_deals')
          .select(`
          id,
          name,
          origin_id,
          stage_id,
          updated_at,
          owner_id,
          r1_closer_email,
          r2_closer_email,
          custom_fields,
          crm_contacts (name, phone, email),
          crm_stages (stage_name),
          crm_origins (name)
        `)
          .in('stage_id', R1_REALIZADA_IDS)
          .in('origin_id', CONSORCIO_ORIGIN_IDS)
          .order('updated_at', { ascending: false })
          .order('id', { ascending: true })
          .range(from, to)
      );

      // Fetch proposals + pending registration status to flag completed deals (kept in list, marked green)
      const dealIds = (data || []).map(d => d.id);
      const proposalStatusByDeal: Record<string, { completa: boolean; cadastro_completo: boolean; has_proposal: boolean }> = {};
      if (dealIds.length > 0) {
        const proposals: any[] = [];
        for (let i = 0; i < dealIds.length; i += CHUNK_SIZE) {
          const chunk = dealIds.slice(i, i + CHUNK_SIZE);
          try {
            const rows = await fetchAllPages<any>((from, to) =>
              supabase
                .from('consorcio_proposals')
                .select('deal_id, status, consortium_card_id')
                .in('deal_id', chunk)
                .order('id', { ascending: true })
                .range(from, to)
            );
            proposals.push(...rows);
          } catch (e) {
            console.error('[PosReuniao] falha ao buscar propostas do lote:', e);
          }
        }
        (proposals || []).forEach((p: any) => {
          if (!p.deal_id) return;
          const prev = proposalStatusByDeal[p.deal_id];
          // "completa"/"cadastro_completo" são DERIVADOS (não existem como colunas).
          const aceita = p.status === 'aceita';
          const completa = aceita && !!p.consortium_card_id;
          proposalStatusByDeal[p.deal_id] = {
            has_proposal: true,
            completa: !!(prev?.completa || completa),
            cadastro_completo: !!(prev?.cadastro_completo || completa),
          };
        });
      }

      const filteredDeals = data || [];

      // Data real da reunião (em lotes, prioriza R1 não cancelada mais recente)
      const meetingByDeal = await fetchMeetingInfoByDeal(filteredDeals.map(d => d.id));

      // Fetch ALL closers (qualquer BU, ativos e inativos) apenas para resolver o nome.
      // Nenhum negócio é escondido por não bater com um closer cadastrado.
      const { data: allClosers } = await supabase
        .from('closers')
        .select('name, email, is_active, bu');

      const closerNameByEmail: Record<string, string> = {};
      (allClosers || []).forEach(c => {
        const email = c.email?.toLowerCase();
        if (email && !closerNameByEmail[email]) closerNameByEmail[email] = c.name;
      });

      const resolveCloser = (d: any) => {
        const candidates = [d.owner_id, d.r1_closer_email, d.r2_closer_email]
          .map((e: string | null) => (e || '').trim().toLowerCase())
          .filter(Boolean);
        for (const email of candidates) {
          if (closerNameByEmail[email]) {
            return { name: closerNameByEmail[email], unknown: false };
          }
        }
        // Sem match em closers: mostra o e-mail cru (se houver) e sinaliza
        return { name: candidates[0] || '', unknown: true };
      };

      return filteredDeals.map(d => {
        const cf = (d.custom_fields as any) || {};
        const status = proposalStatusByDeal[d.id];
        const closer = resolveCloser(d);
        return {
          deal_id: d.id,
          deal_name: d.name || '',
          contact_name: (d.crm_contacts as any)?.name || '',
          contact_phone: (d.crm_contacts as any)?.phone || '',
          contact_email: (d.crm_contacts as any)?.email || '',
          closer_name: closer.name,
          closer_unknown: closer.unknown,
          origin_name: (d.crm_origins as any)?.name || '',
          origin_id: d.origin_id || '',
          stage_id: d.stage_id || '',
          stage_name: (d.crm_stages as any)?.stage_name || '',
          updated_at: d.updated_at || '',
          meeting_date: meetingByDeal[d.id]?.date || '',
          region: cf.estado || '',
          renda: cf.faixa_de_renda || '',
          has_proposal: !!status?.has_proposal,
          completa: !!status?.completa,
          cadastro_completo: !!status?.cadastro_completo,
        };
      }).sort(byMeetingDateDesc) as CompletedMeeting[];
    },
  });
}

// Fetch proposals pendentes/aceitas
export function useProposals() {
  return useQuery({
    queryKey: ['consorcio-proposals'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const data = await fetchAllPages<any>((from, to) =>
        supabase
          .from('consorcio_proposals')
          .select(`
          id,
          deal_id,
          proposal_date,
          proposal_details,
          valor_credito,
          prazo_meses,
          tipo_produto,
          origem_lead,
          status,
          aguardando_retorno,
          aguardando_retorno_until,
          aceite_date,
          motivo_recusa,
          consortium_card_id,
          carta_excluida,
          carta_excluida_em,
          carta_excluida_por_nome,
          carta_excluida_motivo,
          created_at,
          crm_deals (name, origin_id, owner_id, crm_contacts (name, phone, email))
        `)
          // 'recusada' entra na leitura para a etapa 3 do funil não ENCOLHER com o
          // tempo (proposta recusada continua sendo carta negociada no mês dela).
          // A lista de Cartas Negociadas mostra o desfecho na coluna Status.
          .in('status', ['pendente', 'aceita', 'recusada'])
          .order('created_at', { ascending: false })
          .order('id', { ascending: true })
          .range(from, to)
      );

      // Check for pending documents on linked consortium cards
      const cardIds = (data || [])
        .map(p => p.consortium_card_id)
        .filter(Boolean) as string[];
      const cardsWithDocs = new Set<string>();
      if (cardIds.length > 0) {
        const docs = await fetchAllByIds<any>(cardIds, (lote, from, to) =>
          supabase
            .from('consortium_documents')
            .select('card_id')
            .in('card_id', lote)
            .order('id', { ascending: true })
            .range(from, to),
        );
        (docs || []).forEach(d => {
          if (d.card_id) cardsWithDocs.add(d.card_id);
        });
      }

      // Also check documents attached via pending_registrations (deal-level uploads
      // before/without a linked consortium card)
      const dealIds = (data || [])
        .map(p => p.deal_id)
        .filter(Boolean) as string[];
      const dealsWithDocs = new Set<string>();
      const pendingRegistrationsByDeal: Record<string, any[]> = {};
      // Critério único compartilhado com a aba de Cadastros (usePendingRegistrations).
      let regsWithDocs = new Set<string>();
      if (dealIds.length > 0) {
        const pendingRegs = await fetchAllByIds<any>(dealIds, (lote, from, to) =>
          supabase
            .from('consorcio_pending_registrations')
            .select(`
            id,
            deal_id,
            consortium_card_id,
            status,
            tipo_pessoa,
            nome_completo,
            razao_social,
            cpf,
            cnpj,
            telefone,
            telefone_comercial,
            email,
            email_comercial,
            endereco_completo,
            endereco_comercial,
            renda,
            faturamento_mensal
          `)
            .in('deal_id', lote)
            .order('id', { ascending: true })
            .range(from, to),
        );
        (pendingRegs || []).forEach(pr => {
          if (pr.deal_id) {
            if (!pendingRegistrationsByDeal[pr.deal_id]) pendingRegistrationsByDeal[pr.deal_id] = [];
            pendingRegistrationsByDeal[pr.deal_id].push(pr);
          }
        });
        regsWithDocs = await fetchPendingRegsWithDocs((pendingRegs || []) as any[]);
        (pendingRegs || []).forEach(pr => {
          if (pr.deal_id && regsWithDocs.has(pr.id)) dealsWithDocs.add(pr.deal_id);
        });
      }

      // Helper: pending registration has checklist filled and documents attached
      const hasCompletePendingRegistration = (dealId: string) => {
        const regs = pendingRegistrationsByDeal[dealId] || [];
        return regs.some(pr => {
          const hasDocs = regsWithDocs.has(pr.id);
          if (!hasDocs) return false;
          if (pr.tipo_pessoa === 'pj') {
            return !!(
              pr.razao_social &&
              pr.cnpj &&
              pr.telefone_comercial &&
              pr.email_comercial &&
              pr.endereco_comercial &&
              pr.faturamento_mensal
            );
          }
          return !!(
            pr.nome_completo &&
            pr.cpf &&
            pr.telefone &&
            pr.email &&
            pr.endereco_completo &&
            pr.renda
          );
        });
      };

      // Map owner_id (email) -> closer/profile name.
      // Não filtramos por bu porque o owner pode ser closer de outra BU
      // (ex.: Jessica Bellini/incorporador atendendo consórcio).
      const ownerEmails = Array.from(new Set(
        (data || [])
          .map(p => (p.crm_deals as any)?.owner_id)
          .filter(Boolean)
          .map((e: string) => String(e).toLowerCase())
      ));
      const closerNameByEmail: Record<string, string> = {};
      if (ownerEmails.length > 0) {
        const { data: closersAll } = await supabase
          .from('closers')
          .select('name, email')
          .in('email', ownerEmails);
        (closersAll || []).forEach(c => {
          if (c.email) closerNameByEmail[c.email.toLowerCase()] = c.name;
        });
        // Fallback via profiles para owners que não estão em closers
        const missing = ownerEmails.filter(e => !closerNameByEmail[e]);
        if (missing.length > 0) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('email, full_name')
            .in('email', missing);
          (profs || []).forEach((p: any) => {
            if (p.email && p.full_name) closerNameByEmail[p.email.toLowerCase()] = p.full_name;
          });
        }
      }

      // Data real da reunião por deal (lotes de 200, prioriza R1 não cancelada)
      const meetingByDeal = await fetchMeetingInfoByDeal(
        (data || []).map((p: any) => p.deal_id).filter(Boolean)
      );

      // Cartas da proposta (1 proposta → N cartas). Propostas antigas têm a
      // carta espelho criada no backfill; se faltar, o agregado é o fallback.
      const proposalIds = (data || []).map((p: any) => p.id).filter(Boolean) as string[];
      const cartasByProposal: Record<string, PropostaCarta[]> = {};
      if (proposalIds.length > 0) {
        const cartasRows = await fetchAllByIds<any>(proposalIds, (lote, from, to) =>
          supabase
            .from('consorcio_proposal_cartas')
            .select('id, proposal_id, ordem, valor_credito, prazo_meses, tipo_produto, parcelas_mcf, pending_registration_id, consortium_card_id')
            .in('proposal_id', lote)
            .order('id', { ascending: true })
            .range(from, to)
        );
        (cartasRows || []).forEach((c: any) => {
          (cartasByProposal[c.proposal_id] ||= []).push({
            id: c.id,
            proposal_id: c.proposal_id,
            ordem: c.ordem,
            valor_credito: Number(c.valor_credito) || 0,
            prazo_meses: Number(c.prazo_meses) || 0,
            tipo_produto: c.tipo_produto || '',
            parcelas_mcf: Array.isArray(c.parcelas_mcf) ? c.parcelas_mcf.map(Number) : null,

            pending_registration_id: c.pending_registration_id,
            consortium_card_id: c.consortium_card_id,
          });
        });
        Object.values(cartasByProposal).forEach(list => list.sort((a, b) => a.ordem - b.ordem));
      }


      return (data || []).map(p => ({
        id: p.id,
        deal_id: p.deal_id || '',
        deal_name: (p.crm_deals as any)?.name || '',
        contact_name: (p.crm_deals as any)?.crm_contacts?.name || '',
        contact_phone: (p.crm_deals as any)?.crm_contacts?.phone || '',
        contact_email: (p.crm_deals as any)?.crm_contacts?.email || '',
        proposal_date: p.proposal_date || '',
        proposal_details: p.proposal_details || '',
        valor_credito: p.valor_credito || 0,
        prazo_meses: p.prazo_meses || 0,
        tipo_produto: p.tipo_produto || '',
        origem_lead: (p as any).origem_lead || '',
        status: p.status || 'pendente',
        aguardando_retorno: !!(p as any).aguardando_retorno,
        aguardando_retorno_until: (p as any).aguardando_retorno_until || null,
        closer_notes: (p.deal_id
          ? (meetingByDeal[p.deal_id]?.closer_notes || meetingByDeal[p.deal_id]?.notes || '')
          : ''),
        aceite_date: p.aceite_date,
        motivo_recusa: p.motivo_recusa,
        consortium_card_id: p.consortium_card_id,
        cartas: cartasByProposal[p.id] || [],
        qtd_cartas: (cartasByProposal[p.id] || []).length || 1,

        carta_excluida: (p as any).carta_excluida || false,
        carta_excluida_em: (p as any).carta_excluida_em || null,
        carta_excluida_por_nome: (p as any).carta_excluida_por_nome || null,
        carta_excluida_motivo: (p as any).carta_excluida_motivo || null,
        origin_id: (p.crm_deals as any)?.origin_id || '',
        created_at: p.created_at || '',
        meeting_date: (p.deal_id && meetingByDeal[p.deal_id]?.date) || '',
        closer_name: (() => {
          const ownerId = (p.crm_deals as any)?.owner_id;
          if (!ownerId) return '';
          return closerNameByEmail[String(ownerId).toLowerCase()] || ownerId;
        })(),
        owner_id: (p.crm_deals as any)?.owner_id || '',
        // Critério único: a proposta está com documento pendente se QUALQUER
        // cadastro pendente dela estiver sem documento (próprio registro ou card
        // vinculado). Sem cadastro pendente, cai no documento do card.
        documentos_pendentes: (() => {
          if (p.status !== 'aceita') return false;
          // Cadastros declinados/excluídos não podem manter o selo aceso para sempre.
          const regs = ((p.deal_id && pendingRegistrationsByDeal[p.deal_id]) || []).filter(
            (r: any) => !['declinada', 'excluida'].includes(String(r.status || '').toLowerCase()),
          );
          if (regs.length > 0) return regs.some((r: any) => !regsWithDocs.has(r.id));
          return !(p.consortium_card_id && cardsWithDocs.has(p.consortium_card_id));
        })(),
        completa:
          p.status === 'aceita' &&
          !!p.consortium_card_id &&
          ((p.consortium_card_id && cardsWithDocs.has(p.consortium_card_id)) ||
            (p.deal_id && dealsWithDocs.has(p.deal_id))),
        cadastro_completo:
          p.status === 'aceita' &&
          !!p.deal_id &&
          hasCompletePendingRegistration(p.deal_id),
      })).sort(byMeetingDateDesc) as Proposal[];
    },
  });
}

// Fetch deals sem sucesso
export function useSemSucesso() {
  return useQuery({
    queryKey: ['consorcio-sem-sucesso'],
    queryFn: async () => {
      const data = await fetchAllPages<any>((from, to) =>
        supabase
          .from('crm_deals')
          .select(`
          id,
          name,
          origin_id,
          stage_id,
          updated_at,
          crm_contacts (name, phone, email),
          crm_origins (name)
        `)
          .in('stage_id', SEM_SUCESSO_IDS)
          .in('origin_id', CONSORCIO_ORIGIN_IDS)
          .order('updated_at', { ascending: false })
          .order('id', { ascending: true })
          .range(from, to),
      );

      const dealIds = (data || []).map(d => d.id);
      let proposalsByDeal: Record<string, { id: string; motivo_recusa: string | null }> = {};
      if (dealIds.length > 0) {
        const proposals = await fetchAllByIds<any>(dealIds, (lote, from, to) =>
          supabase
            .from('consorcio_proposals')
            .select('id, deal_id, motivo_recusa')
            .in('deal_id', lote)
            .eq('status', 'recusada')
            .order('id', { ascending: true })
            .range(from, to),
        );
        (proposals || []).forEach(p => {
          if (p.deal_id) proposalsByDeal[p.deal_id] = { id: p.id, motivo_recusa: p.motivo_recusa };
        });
      }

      return (data || []).map(d => ({
        deal_id: d.id,
        deal_name: d.name || '',
        contact_name: (d.crm_contacts as any)?.name || '',
        contact_phone: (d.crm_contacts as any)?.phone || '',
        contact_email: (d.crm_contacts as any)?.email || '',
        origin_name: (d.crm_origins as any)?.name || '',
        origin_id: d.origin_id || '',
        stage_id: d.stage_id || '',
        updated_at: d.updated_at || '',
        motivo_recusa: proposalsByDeal[d.id]?.motivo_recusa || null,
        proposal_id: proposalsByDeal[d.id]?.id || null,
      })) as SemSucessoDeal[];
    },
  });
}

// Mutation: Enviar proposta
export function useEnviarProposta() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      deal_id: string;
      origin_id: string;
      proposal_details: string;
      /** Cartas da proposta (1..N). O total é a soma delas. */
      cartas: PropostaCartaInput[];
      origem_lead?: string;
    }) => {
      const cartas = (params.cartas || []).filter(c => Number(c.valor_credito) > 0);
      if (cartas.length === 0) throw new Error('Informe ao menos uma carta com crédito, prazo e produto.');
      if (cartas.some(c => !(Number(c.prazo_meses) > 0) || !String(c.tipo_produto || '').trim())) {
        throw new Error('Todas as cartas precisam de prazo e tipo de produto.');
      }

      const total = cartas.reduce((a, c) => a + Number(c.valor_credito), 0);
      // Carta de maior crédito define os campos legados/agregados da proposta
      // (a trigger no banco também os mantém sincronizados).
      const principal = [...cartas].sort((a, b) => b.valor_credito - a.valor_credito)[0];

      // 1. Create proposal
      const { data: created, error: propError } = await supabase
        .from('consorcio_proposals')
        .insert({
          deal_id: params.deal_id,
          created_by: user?.id,
          proposal_details: params.proposal_details,
          valor_credito: total,
          prazo_meses: principal.prazo_meses,
          tipo_produto: principal.tipo_produto,
          origem_lead: params.origem_lead || null,
        })
        .select('id')
        .single();
      if (propError) throw propError;

      // 1b. Cartas da proposta (verdade por carta)
      const { data: cartasCriadas, error: cartasError } = await supabase
        .from('consorcio_proposal_cartas')
        .insert(cartas.map((c, i) => ({
          proposal_id: created.id,
          ordem: i + 1,
          valor_credito: c.valor_credito,
          prazo_meses: c.prazo_meses,
          tipo_produto: c.tipo_produto,
          // Intenção de parcelas MCF: só registro, não vira cronograma nem comissão.
          parcelas_mcf: (c.parcelas_mcf && c.parcelas_mcf.length > 0) ? c.parcelas_mcf : null,
          // Dados do plano são propriedade da CARTA (opcionais no lançamento).
          parcela_1a_12a: c.parcela_1a_12a ?? null,
          parcela_demais: c.parcela_demais ?? null,
          condicao_pagamento: c.condicao_pagamento ?? null,
          objetivo: c.objetivo ?? null,
          created_by: user?.id ?? null,
        })) as any)
        .select('id, ordem, valor_credito, prazo_meses, tipo_produto, parcelas_mcf, parcela_1a_12a, parcela_demais, condicao_pagamento, objetivo');
      if (cartasError) throw cartasError;


      // 2. Move deal to PROPOSTA ENVIADA (only VdA has this stage)
      const isVdA = params.origin_id === '4e2b810a-6782-4ce9-9c0d-10d04c018636';
      if (isVdA) {
        const { error: dealError } = await supabase
          .from('crm_deals')
          .update({ stage_id: CONSORCIO_STAGE_IDS.VDA_PROPOSTA_ENVIADA })
          .eq('id', params.deal_id);
        if (dealError) throw dealError;
      }

      // Devolve os ids para o formulário fundido poder criar os cadastros
      // pendentes (bloco 2) já vinculados a cada carta.
      return {
        proposal_id: created.id as string,
        cartas: (cartasCriadas || []) as Array<{
          id: string; ordem: number; valor_credito: number;
          prazo_meses: number; tipo_produto: string; parcelas_mcf: number[] | null;
        }>,
      };
    },

    onSuccess: () => {
      toast.success('Proposta registrada com sucesso');
      queryClient.invalidateQueries({ queryKey: ['consorcio-realizadas'] });
      queryClient.invalidateQueries({ queryKey: ['consorcio-proposals'] });
    },
    onError: (e: any) => toast.error('Erro ao registrar proposta: ' + e.message),
  });
}


// Mutation: Marcar sem sucesso
export function useMarcarSemSucesso() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      deal_id: string;
      origin_id: string;
      motivo: string;
      proposal_id?: string; // if rejecting from proposals tab
    }) => {
      const isVdA = params.origin_id === '4e2b810a-6782-4ce9-9c0d-10d04c018636';
      const semSucessoId = isVdA
        ? CONSORCIO_STAGE_IDS.VDA_SEM_SUCESSO
        : CONSORCIO_STAGE_IDS.EA_SEM_SUCESSO;

      // Move deal
      const { error } = await supabase
        .from('crm_deals')
        .update({ stage_id: semSucessoId })
        .eq('id', params.deal_id);
      if (error) throw error;

      // If there's a proposal, mark as recusada
      if (params.proposal_id) {
        await supabase
          .from('consorcio_proposals')
          .update({
            status: 'recusada',
            motivo_recusa: params.motivo,
            recusada_at: new Date().toISOString(),
            recusada_by: user?.id ?? null,
          } as any)
          .eq('id', params.proposal_id);
      }
    },
    onSuccess: () => {
      toast.success('Deal marcado como Sem Sucesso');
      queryClient.invalidateQueries({ queryKey: ['consorcio-realizadas'] });
      queryClient.invalidateQueries({ queryKey: ['consorcio-proposals'] });
      queryClient.invalidateQueries({ queryKey: ['consorcio-sem-sucesso'] });
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}

// Mutation: Aceite confirmado
export function useConfirmarAceite() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: { proposal_id: string }) => {
      const { error } = await supabase
        .from('consorcio_proposals')
        .update({
          status: 'aceita',
          // aceite_date (date) segue sendo gravado: funil e relatórios dependem dele.
          aceite_date: new Date().toISOString().split('T')[0],
          aceite_at: new Date().toISOString(),
          aceite_by: user?.id ?? null,
        } as any)
        .eq('id', params.proposal_id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Aceite confirmado!');
      queryClient.invalidateQueries({ queryKey: ['consorcio-proposals'] });
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}

// Mutation: Retomar contato (volta para R1 Realizada)
export function useRetomarContato() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { deal_id: string; origin_id: string }) => {
      const isVdA = params.origin_id === '4e2b810a-6782-4ce9-9c0d-10d04c018636';
      const r1RealizadaId = isVdA
        ? CONSORCIO_STAGE_IDS.VDA_R1_REALIZADA
        : CONSORCIO_STAGE_IDS.EA_R1_REALIZADA;

      const { error } = await supabase
        .from('crm_deals')
        .update({ stage_id: r1RealizadaId })
        .eq('id', params.deal_id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Contato retomado - deal voltou para R1 Realizada');
      queryClient.invalidateQueries({ queryKey: ['consorcio-sem-sucesso'] });
      queryClient.invalidateQueries({ queryKey: ['consorcio-realizadas'] });
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}

// Mutation: Vincular carta ao deal após cadastro
export function useVincularCarta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      proposal_id: string;
      deal_id: string;
      origin_id: string;
      consortium_card_id: string;
    }) => {
      // Update proposal with card ID
      await supabase
        .from('consorcio_proposals')
        .update({ consortium_card_id: params.consortium_card_id })
        .eq('id', params.proposal_id);

      // Move deal to CONTRATO PAGO / VENDA REALIZADA
      const isVdA = params.origin_id === '4e2b810a-6782-4ce9-9c0d-10d04c018636';
      const finalStage = isVdA
        ? CONSORCIO_STAGE_IDS.VDA_CONTRATO_PAGO
        : CONSORCIO_STAGE_IDS.EA_R1_REALIZADA; // EA doesn't have contrato pago, keep as is

      await supabase
        .from('crm_deals')
        .update({ stage_id: finalStage })
        .eq('id', params.deal_id);
    },
    onSuccess: () => {
      toast.success('Cota cadastrada e deal atualizado!');
      queryClient.invalidateQueries({ queryKey: ['consorcio-proposals'] });
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}

// Mutation: Aguardar retorno do cliente (estado intermediário 48h)
export function useMarcarAguardarRetorno() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      deal_id: string;
      origin_id: string;
      observacao?: string;
      horas?: number; // default 48
    }) => {
      const horas = params.horas ?? 48;
      const until = new Date(Date.now() + horas * 60 * 60 * 1000).toISOString();

      // Insere proposta marcada como "aguardando_retorno" sem valores definidos
      const { error } = await supabase
        .from('consorcio_proposals')
        .insert({
          deal_id: params.deal_id,
          status: 'pendente',
          aguardando_retorno: true,
          aguardando_retorno_until: until,
          proposal_details: params.observacao || 'Aguardando retorno do cliente',
          proposal_date: new Date().toISOString().split('T')[0],
          created_by: user?.id || null,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Marcado como "Aguardando retorno do cliente" (48h)');
      queryClient.invalidateQueries({ queryKey: ['consorcio-realizadas'] });
      queryClient.invalidateQueries({ queryKey: ['consorcio-proposals'] });
      queryClient.invalidateQueries({ queryKey: ['consorcio-pending-outcomes'] });
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}

export { CONSORCIO_STAGE_IDS, CONSORCIO_ORIGIN_IDS };

// Mutation: Excluir proposta (abate do realizado do BI)
export function useExcluirProposta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { proposal_id: string; reason: string }) => {
      const { proposal_id, reason } = params;
      if (!reason || !reason.trim()) throw new Error('Motivo da exclusão obrigatório.');

      // 1. Buscar a proposta completa (com contato e closer via deal)
      const { data: proposal, error: pErr } = await supabase
        .from('consorcio_proposals')
        .select(`
          id, deal_id, valor_credito, prazo_meses, tipo_produto, status,
          proposal_details, created_at,
          crm_deals(owner_id, crm_contacts(name, phone, email))
        `)
        .eq('id', proposal_id)
        .maybeSingle();
      if (pErr) throw pErr;
      if (!proposal) throw new Error('Carta negociada não encontrada.');

      const contact = (proposal as any).crm_deals?.crm_contacts || {};
      const ownerEmail = (proposal as any).crm_deals?.owner_id || null;

      // 2. Resolver nome do closer via tabela closers (fallback: email do owner)
      let closerName: string | null = null;
      if (ownerEmail) {
        const { data: closer } = await supabase
          .from('closers')
          .select('name')
          .ilike('email', ownerEmail)
          .maybeSingle();
        closerName = closer?.name || ownerEmail;
      }

      // 3. Verificar se existe cadastro pendente vinculado (por proposal_id ou deal_id)
      const { data: pendingRegs } = await supabase
        .from('consorcio_pending_registrations')
        .select('id, status, storage_path:id')
        .or(`proposal_id.eq.${proposal_id},deal_id.eq.${proposal.deal_id}`);
      const activePendings = (pendingRegs || []).filter(
        (p: any) => p.status !== 'excluida',
      );

      // 4. Snapshot dos cadastros pendentes (para o log)
      let snapshot: any = null;
      if (activePendings.length > 0) {
        const ids = activePendings.map((p: any) => p.id);
        const { data: fullRegs } = await supabase
          .from('consorcio_pending_registrations')
          .select('*')
          .in('id', ids);
        snapshot = fullRegs;
      }

      // 5. Resolver usuário atual (para armazenar nome/email no log)
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id ?? null;
      let userName: string | null = null;
      let userEmail: string | null = authData?.user?.email ?? null;
      if (userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, full_name, email')
          .eq('id', userId)
          .maybeSingle();
        userName = (profile as any)?.name || (profile as any)?.full_name || null;
        userEmail = userEmail || (profile as any)?.email || null;
      }

      // 6. Inserir no log de exclusões
      const { error: logErr } = await supabase
        .from('consorcio_proposals_deleted_log' as any)
        .insert({
          original_proposal_id: proposal_id,
          deal_id: proposal.deal_id,
          contact_name: contact.name ?? null,
          contact_phone: contact.phone ?? null,
          contact_email: contact.email ?? null,
          closer_name: closerName,
          closer_email: ownerEmail,
          valor_credito: proposal.valor_credito,
          prazo_meses: proposal.prazo_meses,
          tipo_produto: proposal.tipo_produto,
          status: proposal.status,
          proposal_created_at: proposal.created_at,
          proposal_details: proposal.proposal_details,
          had_pending_registration: activePendings.length > 0,
          pending_registration_snapshot: snapshot,
          deleted_by: userId,
          deleted_by_name: userName,
          deleted_by_email: userEmail,
          deletion_reason: reason.trim(),
        });
      if (logErr) throw logErr;

      // 7. Excluir cadastros pendentes vinculados (docs + registros)
      for (const p of activePendings) {
        const { data: docs } = await supabase
          .from('consortium_documents')
          .select('id, storage_path')
          .eq('pending_registration_id', p.id);
        for (const d of docs || []) {
          if ((d as any).storage_path) {
            await supabase.storage
              .from('consorcio-documents')
              .remove([(d as any).storage_path]);
          }
        }
        await supabase
          .from('consortium_documents')
          .delete()
          .eq('pending_registration_id', p.id);
        await supabase
          .from('consorcio_pending_registrations')
          .delete()
          .eq('id', p.id);
      }

      // 8. Excluir a proposta
      const { error } = await supabase
        .from('consorcio_proposals')
        .delete()
        .eq('id', proposal_id);
      if (error) throw error;

      return { hadPending: activePendings.length > 0 };
    },
    onSuccess: () => {
      toast.success('Proposta excluída — valor abatido do realizado.');
      queryClient.invalidateQueries({ queryKey: ['consorcio-proposals'] });
      queryClient.invalidateQueries({ queryKey: ['consorcio-bi-propostas'] });
      queryClient.invalidateQueries({ queryKey: ['consorcio-realizadas'] });
      queryClient.invalidateQueries({ queryKey: ['consorcio-pending-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['consorcio-cartas-excluidas'] });
    },
    onError: (e: any) => toast.error('Erro ao excluir: ' + e.message),
  });
}

// Verifica se uma Carta Negociada possui cadastro pendente vinculado
export function useProposalHasPendingRegistration(proposal: { id: string; deal_id: string } | null) {
  return useQuery({
    queryKey: ['consorcio-proposal-has-pending', proposal?.id],
    enabled: !!proposal,
    staleTime: 30_000,
    queryFn: async () => {
      if (!proposal) return false;
      const { data } = await supabase
        .from('consorcio_pending_registrations')
        .select('id, status')
        .or(`proposal_id.eq.${proposal.id},deal_id.eq.${proposal.deal_id}`);
      return (data || []).some((r: any) => r.status !== 'excluida');
    },
  });
}

/**
 * Versão em lote: retorna o conjunto de `proposal_id` que já possuem cadastro
 * pendente (não excluído). Usada no grid de Cartas Negociadas para impedir que
 * "Inserir Dados" crie um SEGUNDO cadastro (mensagem duplicada ao cliente).
 */
export function useProposalIdsWithPendingRegistration(proposalIds: string[]) {
  const key = [...proposalIds].sort().join(',');
  return useQuery({
    queryKey: ['consorcio-proposals-with-pending', key],
    enabled: proposalIds.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const set = new Set<string>();
      const chunkSize = 200;
      for (let i = 0; i < proposalIds.length; i += chunkSize) {
        const chunk = proposalIds.slice(i, i + chunkSize);
        const { data, error } = await supabase
          .from('consorcio_pending_registrations')
          .select('proposal_id, status')
          .in('proposal_id', chunk);
        if (error) throw error;
        for (const r of data || []) {
          if ((r as any).status !== 'excluida' && (r as any).proposal_id) {
            set.add((r as any).proposal_id as string);
          }
        }
      }
      return set;
    },
  });
}

// Lista de Cartas Excluídas (log)
export interface DeletedProposalLog {
  id: string;
  original_proposal_id: string;
  deal_id: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  closer_name: string | null;
  closer_email: string | null;
  valor_credito: number | null;
  prazo_meses: number | null;
  tipo_produto: string | null;
  status: string | null;
  proposal_created_at: string | null;
  proposal_details: string | null;
  had_pending_registration: boolean;
  pending_registration_snapshot: any;
  deleted_by: string | null;
  deleted_by_name: string | null;
  deleted_by_email: string | null;
  deletion_reason: string;
  created_at: string;
}

export function useCartasExcluidas() {
  return useQuery({
    queryKey: ['consorcio-cartas-excluidas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consorcio_proposals_deleted_log' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as DeletedProposalLog[];
    },
    staleTime: 30_000,
  });
}

// Mutation: Editar proposta existente (corrige valores lançados errados)
export function useEditarProposta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      proposal_id: string;
      /** Cartas da proposta. Cartas já vinculadas a cadastro/cota não são removidas. */
      cartas: PropostaCartaInput[];
      proposal_details?: string;
      origem_lead?: string;
    }) => {
      const cartas = (params.cartas || []).filter(c => Number(c.valor_credito) > 0);
      if (cartas.length === 0) throw new Error('Informe ao menos uma carta com crédito, prazo e produto.');
      if (cartas.some(c => !(Number(c.prazo_meses) > 0) || !String(c.tipo_produto || '').trim())) {
        throw new Error('Todas as cartas precisam de prazo e tipo de produto.');
      }

      // Detalhes anteriores: usados para saber se a observação do cadastro pendente
      // ainda é a cópia automática (e portanto pode ser ressincronizada).
      // O snapshot também alimenta o log de edição da venda (etapa 3).
      const { data: anterior } = await supabase
        .from('consorcio_proposals')
        .select('proposal_details, valor_credito, prazo_meses, tipo_produto, origem_lead, deal_id')
        .eq('id', params.proposal_id)
        .maybeSingle();
      const antes = (anterior || {}) as any;
      const { count: cartasAntes } = await supabase
        .from('consorcio_proposal_cartas')
        .select('id', { count: 'exact', head: true })
        .eq('proposal_id', params.proposal_id);
      const detalhesAnteriores = String((anterior as any)?.proposal_details || '').trim();
      const detalhesNovos = String(params.proposal_details ?? '').trim();


      // --- Cartas: atualiza as existentes, insere as novas e remove as que
      // saíram (só as que ainda não geraram cadastro/cota). Os agregados legados
      // da proposta (valor_credito/prazo_meses/tipo_produto) são recalculados
      // pela trigger do banco.
      const { data: atuaisRaw, error: atuaisErr } = await supabase
        .from('consorcio_proposal_cartas')
        .select('id, pending_registration_id, consortium_card_id, valor_credito, prazo_meses, tipo_produto')
        .eq('proposal_id', params.proposal_id);
      if (atuaisErr) throw atuaisErr;
      const atuais = (atuaisRaw || []) as any[];
      const mantidos = new Set(cartas.map(c => c.id).filter(Boolean) as string[]);
      const removiveis = atuais.filter(
        a => !mantidos.has(a.id) && !a.pending_registration_id && !a.consortium_card_id,
      );
      const travadasRemovidas = atuais.filter(
        a => !mantidos.has(a.id) && (a.pending_registration_id || a.consortium_card_id),
      );
      if (travadasRemovidas.length > 0) {
        throw new Error(
          'Uma das cartas já gerou cadastro/cota e não pode ser removida na edição. Exclua o cadastro pendente primeiro.',
        );
      }

      // Cartas que já viraram cota na Embracon não podem ter valor/prazo/produto
      // alterados por aqui: a cota real é a fonte da verdade.
      for (const c of cartas) {
        if (!c.id) continue;
        const a = atuais.find(x => x.id === c.id);
        if (!a || !a.consortium_card_id) continue;
        const mudou =
          Number(a.valor_credito) !== Number(c.valor_credito) ||
          Number(a.prazo_meses) !== Number(c.prazo_meses) ||
          String(a.tipo_produto || '') !== String(c.tipo_produto || '');
        if (!mudou) continue;
        const { data: card } = await supabase
          .from('consortium_cards')
          .select('grupo, cota')
          .eq('id', a.consortium_card_id)
          .maybeSingle();
        throw new Error(
          `Esta carta já virou cota na Embracon (grupo ${(card as any)?.grupo ?? '—'} / cota ${(card as any)?.cota ?? '—'}). O valor não pode ser alterado por aqui — corrija pela própria cota.`,
        );
      }

      // Propagação carta -> cadastro pendente (quando a carta ainda não virou cota).
      const propagacoes: Array<{ campo: string; de: unknown; para: unknown }> = [];

      let ordem = 0;
      for (const c of cartas) {
        ordem += 1;
        if (c.id) {
          const { error } = await supabase
            .from('consorcio_proposal_cartas')
            .update({
              ordem,
              valor_credito: c.valor_credito,
              prazo_meses: c.prazo_meses,
              tipo_produto: c.tipo_produto,
              parcelas_mcf: (c.parcelas_mcf && c.parcelas_mcf.length > 0) ? c.parcelas_mcf : null,
            } as any)
            .eq('id', c.id);
          if (error) throw error;

          const a = atuais.find(x => x.id === c.id);
          if (a?.pending_registration_id) {
            const { data: reg, error: regErr } = await supabase
              .from('consorcio_pending_registrations')
              .select('id, valor_credito, prazo_meses, tipo_produto, consortium_card_id')
              .eq('id', a.pending_registration_id)
              .maybeSingle();
            if (regErr) throw regErr;
            if (reg && !(reg as any).consortium_card_id) {
              const r = reg as any;
              const difs: Array<{ campo: string; de: unknown; para: unknown }> = [];
              if (Number(r.valor_credito) !== Number(c.valor_credito)) {
                difs.push({ campo: `cadastro[${ordem}].valor_credito`, de: Number(r.valor_credito) || 0, para: Number(c.valor_credito) });
              }
              if (Number(r.prazo_meses) !== Number(c.prazo_meses)) {
                difs.push({ campo: `cadastro[${ordem}].prazo_meses`, de: Number(r.prazo_meses) || 0, para: Number(c.prazo_meses) });
              }
              if (String(r.tipo_produto || '') !== String(c.tipo_produto || '')) {
                difs.push({ campo: `cadastro[${ordem}].tipo_produto`, de: r.tipo_produto || '', para: c.tipo_produto || '' });
              }
              if (difs.length > 0) {
                const { error: propErr } = await supabase
                  .from('consorcio_pending_registrations')
                  .update({
                    valor_credito: c.valor_credito,
                    prazo_meses: c.prazo_meses,
                    tipo_produto: c.tipo_produto,
                  } as any)
                  .eq('id', r.id);
                // Propagação é obrigatória: se falhar, a edição inteira falha.
                if (propErr) {
                  throw new Error(
                    'Não foi possível atualizar o cadastro pendente desta carta. A edição foi interrompida: ' + propErr.message,
                  );
                }
                propagacoes.push(...difs);
              }
            }
          }
        } else {
          const { error } = await supabase
            .from('consorcio_proposal_cartas')
            .insert({
              proposal_id: params.proposal_id,
              ordem,
              valor_credito: c.valor_credito,
              prazo_meses: c.prazo_meses,
              tipo_produto: c.tipo_produto,
              parcelas_mcf: (c.parcelas_mcf && c.parcelas_mcf.length > 0) ? c.parcelas_mcf : null,
            } as any);
          if (error) throw error;
        }

      }
      if (removiveis.length > 0) {
        const { error } = await supabase
          .from('consorcio_proposal_cartas')
          .delete()
          .in('id', removiveis.map(r => r.id));
        if (error) throw error;
      }


      const { error } = await supabase
        .from('consorcio_proposals')
        .update({
          proposal_details: params.proposal_details ?? '',
          origem_lead: params.origem_lead ?? null,
        })
        .eq('id', params.proposal_id);
      if (error) throw error;


      // Ressincroniza observacoes dos cadastros pendentes que ainda não abriram cota,
      // sem NUNCA sobrescrever observação escrita à mão pela operação.
      if (detalhesNovos !== detalhesAnteriores) {
        const { data: regs } = await supabase
          .from('consorcio_pending_registrations')
          .select('id, observacoes, consortium_card_id')
          .eq('proposal_id', params.proposal_id);
        const alvos = (regs || []).filter((r: any) => {
          if (r.consortium_card_id) return false; // cota já aberta: não mexe
          const atual = String(r.observacoes || '').trim();
          return atual === '' || atual === detalhesAnteriores;
        });
        for (const r of alvos) {
          await supabase
            .from('consorcio_pending_registrations')
            .update({ observacoes: detalhesNovos || null } as any)
            .eq('id', (r as any).id);
        }
      }



      // --- Log da edição da venda (etapa 3). Antes desta tabela só havia log de
      // exclusão, então uma alteração de valor/prazo/produto era invisível.
      try {
        const { data: depoisRaw } = await supabase
          .from('consorcio_proposals')
          .select('valor_credito, prazo_meses, tipo_produto, origem_lead')
          .eq('id', params.proposal_id)
          .maybeSingle();
        const depois = (depoisRaw || {}) as any;
        const { count: cartasDepois } = await supabase
          .from('consorcio_proposal_cartas')
          .select('id', { count: 'exact', head: true })
          .eq('proposal_id', params.proposal_id);

        const cmp: Array<{ campo: string; de: unknown; para: unknown }> = [
          { campo: 'valor_credito', de: Number(antes.valor_credito) || 0, para: Number(depois.valor_credito) || 0 },
          { campo: 'prazo_meses', de: Number(antes.prazo_meses) || 0, para: Number(depois.prazo_meses) || 0 },
          { campo: 'tipo_produto', de: antes.tipo_produto || '', para: depois.tipo_produto || '' },
          { campo: 'quantidade_cartas', de: cartasAntes ?? 0, para: cartasDepois ?? 0 },
          { campo: 'proposal_details', de: detalhesAnteriores, para: detalhesNovos },
          { campo: 'origem_lead', de: antes.origem_lead || '', para: depois.origem_lead || '' },
        ];
        const alteracoes = [...cmp.filter(c => String(c.de) !== String(c.para)), ...propagacoes];

        if (alteracoes.length > 0) {
          const { data: userData } = await supabase.auth.getUser();
          let nome: string | null = userData?.user?.email ?? null;
          if (userData?.user?.id) {
            const { data: prof } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', userData.user.id)
              .maybeSingle();
            nome = (prof as any)?.full_name || nome;
          }
          await supabase.from('consorcio_proposal_edit_log').insert({
            proposal_id: params.proposal_id,
            deal_id: antes.deal_id ?? null,
            edited_by: userData?.user?.id ?? null,
            edited_by_nome: nome,
            alteracoes: alteracoes as any,
          } as any);
        }
      } catch {
        /* log é auxiliar: nunca derruba a edição */
      }
    },
    onSuccess: () => {
      toast.success('Proposta atualizada com sucesso');
      queryClient.invalidateQueries({ queryKey: ['consorcio-proposals'] });
      queryClient.invalidateQueries({ queryKey: ['consorcio-bi-propostas'] });
      queryClient.invalidateQueries({ queryKey: ['consorcio-realizado-by-closer'] });
      queryClient.invalidateQueries({ queryKey: ['consorcio-pending-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['consorcio-proposal-edit-log'] });

    },
    onError: (e: any) => toast.error('Erro ao atualizar: ' + e.message),
  });
}

// Fetch ALL consorcio deals (todas reuniões, qualquer stage)
export function useTodasReunioes() {
  return useQuery({
    queryKey: ['consorcio-todas-reunioes'],
    queryFn: async () => {
      const data = await fetchAllPages<any>((from, to) =>
        supabase
          .from('crm_deals')
          .select(`
          id,
          name,
          origin_id,
          stage_id,
          updated_at,
          owner_id,
          custom_fields,
          crm_contacts (name, phone, email),
          crm_stages (stage_name),
          crm_origins (name)
        `)
          .in('origin_id', CONSORCIO_ORIGIN_IDS)
          .order('updated_at', { ascending: false })
          .order('id', { ascending: true })
          .range(from, to)
      );

      // Fetch consorcio closers
      const { data: consorcioClosers } = await supabase
        .from('closers')
        .select('name, email')
        .eq('bu', 'consorcio')
        .eq('is_active', true);

      const closerEmailSet = new Set(
        (consorcioClosers || []).map(c => c.email?.toLowerCase()).filter(Boolean)
      );
      const closerNameByEmail: Record<string, string> = {};
      (consorcioClosers || []).forEach(c => {
        if (c.email) closerNameByEmail[c.email.toLowerCase()] = c.name;
      });

      // Filter to only consorcio closer deals
      const consorcioDeals = (data || []).filter(d =>
        d.owner_id && closerEmailSet.has(d.owner_id.toLowerCase())
      );

      const dealIds = consorcioDeals.map(d => d.id);

      // Data real da reunião + notas (em lotes, prioriza R1 não cancelada mais recente)
      const meetingByDeal = await fetchMeetingInfoByDeal(dealIds);

      // Also fetch notes from attendee_notes table
      let attendeeNotesByDeal: Record<string, string[]> = {};
      if (dealIds.length > 0) {
        const allAttendees: any[] = [];
        for (let i = 0; i < dealIds.length; i += CHUNK_SIZE) {
          const chunk = dealIds.slice(i, i + CHUNK_SIZE);
          const rows = await fetchAllPages<any>((from, to) =>
            supabase
              .from('meeting_slot_attendees')
              .select('id, deal_id')
              .in('deal_id', chunk)
              .order('id', { ascending: true })
              .range(from, to)
          );
          allAttendees.push(...rows);
        }

        if (allAttendees && allAttendees.length > 0) {
          const attendeeIds = allAttendees.map(a => a.id);
          const notes: any[] = [];
          for (let i = 0; i < attendeeIds.length; i += CHUNK_SIZE) {
            const chunk = attendeeIds.slice(i, i + CHUNK_SIZE);
            const rows = await fetchAllPages<any>((from, to) =>
              supabase
                .from('attendee_notes')
                .select('attendee_id, note')
                .in('attendee_id', chunk)
                .order('created_at', { ascending: false })
                .order('id', { ascending: true })
                .range(from, to)
            );
            notes.push(...rows);
          }

          if (notes) {
            const attendeeIdToDeal: Record<string, string> = {};
            allAttendees.forEach(a => { if (a.deal_id) attendeeIdToDeal[a.id] = a.deal_id; });
            notes.forEach(n => {
              const dId = attendeeIdToDeal[n.attendee_id];
              if (dId) {
                if (!attendeeNotesByDeal[dId]) attendeeNotesByDeal[dId] = [];
                attendeeNotesByDeal[dId].push(n.note);
              }
            });
          }
        }
      }

      return consorcioDeals.map(d => {
        const cf = (d.custom_fields as any) || {};
        const meetingInfo = meetingByDeal[d.id];
        const extraNotes = attendeeNotesByDeal[d.id] || [];
        return {
          deal_id: d.id,
          deal_name: d.name || '',
          contact_name: (d.crm_contacts as any)?.name || '',
          contact_phone: (d.crm_contacts as any)?.phone || '',
          contact_email: (d.crm_contacts as any)?.email || '',
          closer_name: (d.owner_id && closerNameByEmail[d.owner_id.toLowerCase()]) || d.owner_id || '',
          origin_name: (d.crm_origins as any)?.name || '',
          origin_id: d.origin_id || '',
          stage_id: d.stage_id || '',
          stage_name: (d.crm_stages as any)?.stage_name || '',
          updated_at: d.updated_at || '',
          meeting_date: meetingInfo?.date || '',
          region: cf.estado || '',
          renda: cf.faixa_de_renda || '',
          closer_notes: meetingInfo?.closer_notes || '',
          attendee_notes: [meetingInfo?.notes, ...extraNotes].filter(Boolean).join(' | '),
        };
      }).sort(byMeetingDateDesc) as AllMeetingDeal[];
    },
  });
}
