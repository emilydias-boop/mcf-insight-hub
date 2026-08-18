import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useContactDealIds } from './useContactDealIds';
import { fetchAllByIds } from '@/lib/supabasePaginacao';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Agendamentos anteriores a esta data não gravavam `booked_at`. */
export const BOOKED_AT_TRACKING_SINCE = '2026-08-16';

/** Estado de cada fonte de dados: ok (leu) ou erro (não deu para saber). */
export interface SourceStatus {
  ok: boolean;
  error: string | null;
}
export type LeadReportSourceKey =
  | 'deal'
  | 'deals'
  | 'meetings'
  | 'movements'
  | 'proposals'
  | 'registrations'
  | 'registrationsByProposal'
  | 'cards'
  | 'installments'
  | 'documents'
  | 'termos'
  | 'audit'
  | 'cardActivity'
  | 'profiles';

const st = (res: any): SourceStatus => ({
  ok: !res?.error,
  error: res?.error?.message ?? null,
});

export interface LeadReportMeeting {
  id: string;
  deal_id: string | null;
  scheduled_at: string | null;
  status: string | null;
  closer_name: string | null;
  booked_by_name: string | null;
  /** Data real do agendamento. NUNCA é substituída por created_at. */
  booked_at: string | null;
  /** Criação da linha — usada só para explicar a ausência de booked_at. */
  created_at: string | null;
  is_reschedule: boolean | null;
  outcome_reason: string | null;
  outcome_reason_note: string | null;
  contract_paid_at: string | null;
  refunded_at: string | null;
  notes: string | null;
  closer_notes: string | null;
  updated_at: string | null;
  meeting_type: string | null;
  google_meet_link: string | null;
  movements: {
    id: string;
    created_at: string;
    movement_type: string | null;
    from_scheduled_at: string | null;
    to_scheduled_at: string | null;
    from_closer_name: string | null;
    to_closer_name: string | null;
    previous_status: string | null;
    reason: string | null;
    moved_by_name: string | null;
  }[];
}

export interface LeadReportProposal {
  id: string;
  deal_id: string | null;
  proposal_date: string | null;
  proposal_details: string | null;
  valor_credito: number | null;
  prazo_meses: number | null;
  tipo_produto: string | null;
  status: string | null;
  aceite_value: string | null;
  aceite_source: 'aceite_at' | 'aceite_date' | null;
  aceite_by_name: string | null;
  recusada_at: string | null;
  recusada_by_name: string | null;
  motivo_recusa: string | null;
  created_at: string;
  created_by_name: string | null;
  carta_excluida: boolean | null;
  excluida_value: string | null;
  excluida_source: 'carta_excluida_em' | 'deleted_at' | null;
  carta_excluida_por_nome: string | null;
  excluida_por_source: 'carta_excluida_por_nome' | 'perfil_do_usuario' | null;
  excluida_motivo: string | null;
  excluida_motivo_source: 'carta_excluida_motivo' | 'deletion_reason' | null;
  consortium_card_id: string | null;
  valueChanges: LeadReportAudit[];
}

export interface LeadReportAudit {
  id: string;
  created_at: string;
  action: string;
  table_name: string;
  record_id: string | null;
  actor_name: string | null;
  changes: { field: string; from: any; to: any }[];
}

export interface LeadReportDoc {
  id: string;
  tipo: string | null;
  nome_arquivo: string | null;
  uploaded_at: string | null;
}

export interface LeadReportRegistration {
  id: string;
  proposal_id: string | null;
  deal_id: string | null;
  status: string | null;
  tipo_pessoa: string | null;
  nome: string | null;
  categoria: string | null;
  grupo: string | null;
  cota: string | null;
  valor_credito: number | null;
  prazo_meses: number | null;
  condicao_pagamento: string | null;
  parcela_1a_12a: number | null;
  parcela_demais: number | null;
  parcelas_pagas_empresa: number | null;
  dia_vencimento: number | null;
  data_contratacao: string | null;
  created_at: string;
  cadastrada_at: string | null;
  cadastrada_por: string | null;
  cota_aberta_at: string | null;
  cota_aberta_por: string | null;
  vinculada_at: string | null;
  vinculada_por: string | null;
  declinada_at: string | null;
  motivo_declinio: string | null;
  consortium_card_id: string | null;
  documentos: LeadReportDoc[];
}

export interface LeadReportTermo {
  id: string;
  tipo: string;
  status: string;
  created_at: string;
  expires_at: string | null;
  assinado_em: string | null;
  assinante_nome: string | null;
  assinante_cpf: string | null;
  assinante_ip: string | null;
  visualizado_em: string | null;
  visualizado_ip: string | null;
  conteudo_hash: string | null;
  cancelado_em: string | null;
  cancelado_motivo: string | null;
  modelo_versao: number | null;
}

export interface LeadReportInstallment {
  id: string;
  numero_parcela: number;
  tipo: string | null;
  valor_parcela: number | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  status: string | null;
}

export interface LeadReportCardActivity {
  id: string;
  created_at: string;
  event_category: string | null;
  event_type: string | null;
  description: string | null;
  before_value: any;
  after_value: any;
  actor_name: string | null;
}

export interface LeadReportSideTotals {
  count: number;
  total: number;
  paidCount: number;
  paid: number;
  openCount: number;
  open: number;
}

export interface LeadReportCard {
  id: string;
  grupo: string | null;
  cota: string | null;
  contrato_embracon: string | null;
  status: string | null;
  categoria: string | null;
  valor_credito: number | null;
  prazo_meses: number | null;
  parcela_1a_12a: number | null;
  parcela_demais: number | null;
  parcelas_pagas_empresa: number | null;
  dia_vencimento: number | null;
  data_contratacao: string | null;
  vendedor_name: string | null;
  created_at: string;
  isExternal: boolean;
  installments: LeadReportInstallment[];
  documentos: LeadReportDoc[];
  activity: LeadReportCardActivity[];
  totals: { empresa: LeadReportSideTotals; cliente: LeadReportSideTotals };
}

export interface LeadReportData {
  deal: {
    id: string;
    name: string | null;
    created_at: string;
    value: number | null;
    stage_name: string | null;
    pipeline_name: string | null;
    owner_name: string | null;
    original_sdr_email: string | null;
    r1_closer_email: string | null;
    r2_closer_email: string | null;
    owner_profile_id: string | null;
    lead_temperature: string | null;
    icp_segment: string | null;
    tags: string[] | null;
    product_name: string | null;
  };
  contact: { id: string | null; name: string | null; email: string | null; phone: string | null };
  allDealIds: string[];
  pipelines: { deal_id: string; pipeline_name: string | null; stage_name: string | null; created_at: string }[];
  meetings: LeadReportMeeting[];
  proposals: LeadReportProposal[];
  registrations: LeadReportRegistration[];
  /** Documentos sem vínculo conhecido (nem cota, nem cadastro deste lead). */
  documentosSoltos: LeadReportDoc[];
  termos: LeadReportTermo[];
  cards: LeadReportCard[];
  gaps: string[];
  /** Fontes que falharam — não é possível afirmar ausência sobre elas. */
  unknowns: { label: string; error: string | null }[];
  sources: Record<LeadReportSourceKey, SourceStatus>;
}

/** Campos de valor auditáveis — nunca exibimos dado pessoal (CPF, renda, etc). */
const AUDITABLE_FIELDS = [
  'valor_credito',
  'prazo_meses',
  'tipo_produto',
  'status',
  'condicao_pagamento',
  'parcela_1a_12a',
  'parcela_demais',
  'parcelas_pagas_empresa',
  'valor_comissao',
  'grupo',
  'cota',
  'dia_vencimento',
  'data_contratacao',
  'contrato_embracon',
];

const CARD_COLUMNS =
  'id, grupo, cota, contrato_embracon, status, categoria, valor_credito, prazo_meses, parcela_1a_12a, parcela_demais, parcelas_pagas_empresa, dia_vencimento, data_contratacao, vendedor_name, created_at';

/** Colunas explícitas — evita trazer dado pessoal e faz coluna inexistente virar erro 400. */
const PROPOSAL_COLUMNS = [
  'id',
  'deal_id',
  'proposal_date',
  'proposal_details',
  'valor_credito',
  'prazo_meses',
  'tipo_produto',
  'status',
  'created_at',
  'created_by',
  'consortium_card_id',
  'aceite_at',
  'aceite_date',
  'aceite_by',
  'recusada_at',
  'recusada_by',
  'motivo_recusa',
  'carta_excluida',
  'carta_excluida_em',
  'carta_excluida_por',
  'carta_excluida_por_nome',
  'carta_excluida_motivo',
  'deleted_at',
  'deletion_reason',
].join(', ');

const REGISTRATION_COLUMNS = [
  'id',
  'proposal_id',
  'deal_id',
  'status',
  'tipo_pessoa',
  'nome_completo',
  'razao_social',
  'categoria',
  'grupo',
  'cota',
  'valor_credito',
  'prazo_meses',
  'condicao_pagamento',
  'parcela_1a_12a',
  'parcela_demais',
  'parcelas_pagas_empresa',
  'dia_vencimento',
  'data_contratacao',
  'created_at',
  'cadastrada_at',
  'cadastrada_by',
  'cota_aberta_at',
  'cota_aberta_by',
  'vinculada_at',
  'vinculada_by',
  'declinada_at',
  'motivo_declinio',
  'consortium_card_id',
].join(', ');

function diffAuditable(oldData: any, newData: any) {
  const out: { field: string; from: any; to: any }[] = [];
  for (const f of AUDITABLE_FIELDS) {
    const before = oldData?.[f];
    const after = newData?.[f];
    if (before === undefined && after === undefined) continue;
    if (JSON.stringify(before ?? null) !== JSON.stringify(after ?? null)) {
      out.push({ field: f, from: before ?? null, to: after ?? null });
    }
  }
  return out;
}

/** Busca todas as parcelas das cotas paginando — o teto do PostgREST truncaria em silêncio. */
async function fetchAllInstallments(cardIds: string[]) {
  const PAGE = 1000;
  const rows: any[] = [];
  let from = 0;
  for (;;) {
    const res = await supabase
      .from('consortium_installments')
      .select('id, card_id, numero_parcela, tipo, valor_parcela, data_vencimento, data_pagamento, status')
      .in('card_id', cardIds)
      .order('numero_parcela', { ascending: true })
      .range(from, from + PAGE - 1);
    if (res.error) return { data: rows, error: res.error };
    const batch = (res.data as any[]) || [];
    rows.push(...batch);
    if (batch.length < PAGE) break;
    from += PAGE;
    if (from > 20_000) break;
  }
  return { data: rows, error: null };
}

function emptyTotals(): LeadReportSideTotals {
  return { count: 0, total: 0, paidCount: 0, paid: 0, openCount: 0, open: 0 };
}

function sumInstallments(list: LeadReportInstallment[]) {
  const empresa = emptyTotals();
  const cliente = emptyTotals();
  for (const i of list) {
    if ((i.status || '').toLowerCase() === 'cancelado') continue;
    const side = i.tipo === 'empresa' ? empresa : cliente;
    const v = Number(i.valor_parcela || 0);
    side.count += 1;
    side.total += v;
    const isPaid = !!i.data_pagamento || (i.status || '').toLowerCase() === 'pago';
    if (isPaid) {
      side.paidCount += 1;
      side.paid += v;
    } else {
      side.openCount += 1;
      side.open += v;
    }
  }
  return { empresa, cliente };
}

/**
 * Relatório do Lead (Fase 3B) — apenas leitura.
 * Distingue três estados por fonte: tem dado · não tem dado · não deu para saber.
 */
export function useLeadReport(dealId: string | undefined, enabled = true) {
  const { data: allDealIds = [] } = useContactDealIds(enabled ? dealId : undefined);
  const uuidIds = [...new Set([...(allDealIds || []), dealId].filter((id): id is string => !!id && UUID_RE.test(id)))];

  return useQuery({
    queryKey: ['lead-report', dealId, uuidIds],
    enabled: !!enabled && !!dealId && uuidIds.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<LeadReportData> => {
      const sources = {} as Record<LeadReportSourceKey, SourceStatus>;

      const [dealRes, dealsRes, attendeesRes, proposalsRes, regsRes] = await Promise.all([
        supabase
          .from('crm_deals')
          .select(
            'id, name, created_at, value, tags, product_name, lead_temperature, icp_segment, owner_id, owner_profile_id, original_sdr_email, r1_closer_email, r2_closer_email, contact_id, crm_stages(stage_name), crm_origins(name, display_name), crm_contacts(id, name, email, phone)',
          )
          .eq('id', dealId as string)
          .maybeSingle(),
        supabase
          .from('crm_deals')
          .select('id, created_at, crm_stages(stage_name), crm_origins(name, display_name)')
          .in('id', uuidIds),
        supabase
          .from('meeting_slot_attendees')
          .select(
            'id, deal_id, status, booked_by, booked_at, is_reschedule, notes, closer_notes, outcome_reason, outcome_reason_note, contract_paid_at, refunded_at, created_at, updated_at, meeting_slots(scheduled_at, meeting_type, google_meet_link, closers(name))',
          )
          .in('deal_id', uuidIds)
          .limit(200),
        supabase.from('consorcio_proposals').select(PROPOSAL_COLUMNS).in('deal_id', uuidIds).limit(100),
        supabase
          .from('consorcio_pending_registrations')
          .select(REGISTRATION_COLUMNS)
          .in('deal_id', uuidIds)
          .limit(100),
      ]);

      sources.deal = st(dealRes);
      sources.deals = st(dealsRes);
      sources.meetings = st(attendeesRes);
      sources.proposals = st(proposalsRes);
      sources.registrations = st(regsRes);

      if (dealRes.error) throw dealRes.error;
      if (!dealRes.data) throw new Error('Negócio não encontrado');
      const dealRow: any = dealRes.data;

      const proposals: any[] = (proposalsRes.data as any[]) || [];
      const proposalIds = proposals.map((p) => p.id);

      // cadastros pendentes: por deal_id OU por proposta
      const registrations: any[] = [...((regsRes.data as any[]) || [])];
      if (proposalIds.length) {
        const byProposalRes = await supabase
          .from('consorcio_pending_registrations')
          .select(REGISTRATION_COLUMNS)
          .in('proposal_id', proposalIds);
        sources.registrationsByProposal = st(byProposalRes);
        const seen = new Set(registrations.map((r) => r.id));
        for (const r of ((byProposalRes.data as any[]) || [])) if (!seen.has(r.id)) registrations.push(r);
      } else {
        sources.registrationsByProposal = { ok: true, error: null };
      }

      const cardIds = [
        ...new Set(
          [
            ...registrations.map((r) => r.consortium_card_id),
            ...proposals.map((p) => p.consortium_card_id),
          ].filter((id): id is string => !!id),
        ),
      ];
      const regIds = registrations.map((r) => r.id);
      const attendeeIds = ((attendeesRes.data as any[]) || []).map((a: any) => a.id);
      const OK = { data: [] as any[], error: null };

      const [cardsRes, instRes, docsRes, termosRes, movesRes, auditRes, cardActRes] = await Promise.all([
        cardIds.length
          ? supabase.from('consortium_cards').select(CARD_COLUMNS).in('id', cardIds)
          : Promise.resolve(OK),
        cardIds.length ? fetchAllInstallments(cardIds) : Promise.resolve(OK),
        cardIds.length || regIds.length
          ? supabase
              .from('consortium_documents')
              .select('id, card_id, pending_registration_id, tipo, nome_arquivo, uploaded_at')
              .or(
                [
                  cardIds.length ? `card_id.in.(${cardIds.join(',')})` : '',
                  regIds.length ? `pending_registration_id.in.(${regIds.join(',')})` : '',
                ]
                  .filter(Boolean)
                  .join(','),
              )
          : Promise.resolve(OK),
        supabase
          .from('consorcio_termos')
          .select(
            'id, tipo, status, created_at, expires_at, assinado_em, assinante_nome, assinante_cpf, assinante_ip, visualizado_em, visualizado_ip, conteudo_hash, cancelado_em, cancelado_motivo, modelo_versao, deal_id, card_id, pending_registration_id',
          )
          .or(
            [
              `deal_id.in.(${uuidIds.join(',')})`,
              regIds.length ? `pending_registration_id.in.(${regIds.join(',')})` : '',
              cardIds.length ? `card_id.in.(${cardIds.join(',')})` : '',
            ]
              .filter(Boolean)
              .join(','),
          )
          .order('created_at', { ascending: false }),
        attendeeIds.length
          ? supabase
              .from('attendee_movement_logs')
              .select('*')
              .in('attendee_id', attendeeIds)
              .order('created_at', { ascending: true })
          : Promise.resolve(OK),
        proposalIds.length || regIds.length
          ? supabase
              .from('audit_logs')
              .select('id, created_at, action, table_name, record_id, old_data, new_data, user_id')
              .in('record_id', [...proposalIds, ...regIds])
              .order('created_at', { ascending: true })
              .limit(300)
          : Promise.resolve(OK),
        cardIds.length
          ? supabase
              .from('consortium_card_activity_log')
              .select(
                'id, card_id, created_at, event_category, event_type, description, before_value, after_value, actor_name',
              )
              .in('card_id', cardIds)
              .order('created_at', { ascending: false })
              .limit(500)
          : Promise.resolve(OK),
      ]);

      sources.cards = st(cardsRes);
      sources.installments = st(instRes);
      sources.documents = st(docsRes);
      sources.termos = st(termosRes);
      sources.movements = st(movesRes);
      sources.audit = st(auditRes);
      sources.cardActivity = st(cardActRes);

      // Resolver nomes de usuários
      const userIds = new Set<string>();
      const addUser = (v: any) => {
        if (v && typeof v === 'string' && UUID_RE.test(v)) userIds.add(v);
      };
      addUser(dealRow.owner_profile_id);
      addUser(dealRow.owner_id);
      for (const a of ((attendeesRes.data as any[]) || [])) addUser((a as any).booked_by);
      for (const p of proposals) {
        addUser(p.created_by);
        addUser(p.aceite_by);
        addUser(p.recusada_by);
        addUser(p.carta_excluida_por);
      }
      for (const l of ((auditRes as any).data || [])) addUser(l.user_id);
      for (const r of registrations) {
        addUser(r.cadastrada_by);
        addUser(r.cota_aberta_by);
        addUser(r.vinculada_by);
      }

      const profileMap: Record<string, string> = {};
      if (userIds.size) {
        const profsRes = await supabase.from('profiles').select('id, full_name, email').in('id', [...userIds]);
        sources.profiles = st(profsRes);
        for (const p of ((profsRes.data as any[]) || [])) profileMap[p.id] = p.full_name || p.email || 'Usuário';
      } else {
        sources.profiles = { ok: true, error: null };
      }
      const nameOf = (id: any, fallback: string | null = null) =>
        (id && profileMap[id]) || fallback || (id ? 'Usuário' : null);

      // Auditoria de valor por registro
      const auditByRecord: Record<string, LeadReportAudit[]> = {};
      for (const l of (((auditRes as any).data || []) as any[])) {
        const changes = l.action === 'UPDATE' ? diffAuditable(l.old_data, l.new_data) : [];
        if (l.action === 'UPDATE' && changes.length === 0) continue;
        (auditByRecord[l.record_id] ||= []).push({
          id: l.id,
          created_at: l.created_at,
          action: l.action,
          table_name: l.table_name,
          record_id: l.record_id,
          actor_name: nameOf(l.user_id),
          changes,
        });
      }

      // Reuniões (leitura única — também consumida pela linha do tempo)
      const movesByAttendee: Record<string, any[]> = {};
      for (const m of (((movesRes as any).data || []) as any[])) {
        (movesByAttendee[m.attendee_id] ||= []).push(m);
      }
      const meetings: LeadReportMeeting[] = (((attendeesRes.data as any[]) || []) as any[])
        .map((a) => ({
          id: a.id,
          deal_id: a.deal_id,
          scheduled_at: a.meeting_slots?.scheduled_at || null,
          status: a.status,
          closer_name: a.meeting_slots?.closers?.name || null,
          booked_by_name: nameOf(a.booked_by),
          booked_at: a.booked_at || null,
          created_at: a.created_at || null,
          is_reschedule: a.is_reschedule,
          outcome_reason: a.outcome_reason,
          outcome_reason_note: a.outcome_reason_note,
          contract_paid_at: a.contract_paid_at,
          refunded_at: a.refunded_at,
          notes: a.notes,
          closer_notes: a.closer_notes,
          updated_at: a.updated_at || null,
          meeting_type: a.meeting_slots?.meeting_type || null,
          google_meet_link: a.meeting_slots?.google_meet_link || null,
          movements: (movesByAttendee[a.id] || []).map((m) => ({
            id: m.id,
            created_at: m.created_at,
            movement_type: m.movement_type,
            from_scheduled_at: m.from_scheduled_at,
            to_scheduled_at: m.to_scheduled_at,
            from_closer_name: m.from_closer_name,
            to_closer_name: m.to_closer_name,
            previous_status: m.previous_status,
            reason: m.reason,
            moved_by_name: m.moved_by_name,
          })),
        }))
        .sort((x, y) => new Date(x.scheduled_at || 0).getTime() - new Date(y.scheduled_at || 0).getTime());

      // Propostas
      const proposalsOut: LeadReportProposal[] = proposals
        .map((p) => ({
          id: p.id,
          deal_id: p.deal_id,
          proposal_date: p.proposal_date,
          proposal_details: p.proposal_details,
          valor_credito: p.valor_credito,
          prazo_meses: p.prazo_meses,
          tipo_produto: p.tipo_produto,
          status: p.status,
          aceite_value: p.aceite_at || p.aceite_date || null,
          aceite_source: (p.aceite_at ? 'aceite_at' : p.aceite_date ? 'aceite_date' : null) as any,
          aceite_by_name: nameOf(p.aceite_by),
          recusada_at: p.recusada_at,
          recusada_by_name: nameOf(p.recusada_by),
          motivo_recusa: p.motivo_recusa,
          created_at: p.created_at,
          created_by_name: nameOf(p.created_by),
          carta_excluida: p.carta_excluida,
          excluida_value: p.carta_excluida_em || p.deleted_at || null,
          excluida_source: (p.carta_excluida_em ? 'carta_excluida_em' : p.deleted_at ? 'deleted_at' : null) as any,
          carta_excluida_por_nome: p.carta_excluida_por_nome || nameOf(p.carta_excluida_por),
          excluida_por_source: (p.carta_excluida_por_nome
            ? 'carta_excluida_por_nome'
            : p.carta_excluida_por
              ? 'perfil_do_usuario'
              : null) as any,
          excluida_motivo: p.carta_excluida_motivo || p.deletion_reason || null,
          excluida_motivo_source: (p.carta_excluida_motivo
            ? 'carta_excluida_motivo'
            : p.deletion_reason
              ? 'deletion_reason'
              : null) as any,
          consortium_card_id: p.consortium_card_id,
          valueChanges: auditByRecord[p.id] || [],
        }))
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      // Documentos
      const docsByCard: Record<string, LeadReportDoc[]> = {};
      const docsByReg: Record<string, LeadReportDoc[]> = {};
      const documentosSoltos: LeadReportDoc[] = [];
      for (const d of (((docsRes as any).data || []) as any[])) {
        const doc: LeadReportDoc = {
          id: d.id,
          tipo: d.tipo,
          nome_arquivo: d.nome_arquivo,
          uploaded_at: d.uploaded_at,
        };
        if (d.card_id) (docsByCard[d.card_id] ||= []).push(doc);
        else if (d.pending_registration_id && regIds.includes(d.pending_registration_id)) {
          // Documento de cadastro pendente conhecido: sai só dentro do cadastro.
          (docsByReg[d.pending_registration_id] ||= []).push(doc);
        } else documentosSoltos.push(doc);
      }

      // Cadastros
      const registrationsOut: LeadReportRegistration[] = registrations
        .map((r) => ({
          id: r.id,
          proposal_id: r.proposal_id,
          deal_id: r.deal_id,
          status: r.status,
          tipo_pessoa: r.tipo_pessoa,
          nome: r.nome_completo || r.razao_social || null,
          categoria: r.categoria,
          grupo: r.grupo,
          cota: r.cota,
          valor_credito: r.valor_credito,
          prazo_meses: r.prazo_meses,
          condicao_pagamento: r.condicao_pagamento,
          parcela_1a_12a: r.parcela_1a_12a,
          parcela_demais: r.parcela_demais,
          parcelas_pagas_empresa: r.parcelas_pagas_empresa,
          dia_vencimento: r.dia_vencimento,
          data_contratacao: r.data_contratacao,
          created_at: r.created_at,
          cadastrada_at: r.cadastrada_at,
          cadastrada_por: r.cadastrada_by ? nameOf(r.cadastrada_by) : null,
          cota_aberta_at: r.cota_aberta_at,
          cota_aberta_por: r.cota_aberta_by ? nameOf(r.cota_aberta_by) : null,
          vinculada_at: r.vinculada_at,
          vinculada_por: r.vinculada_by ? nameOf(r.vinculada_by) : null,
          declinada_at: r.declinada_at,
          motivo_declinio: r.motivo_declinio,
          consortium_card_id: r.consortium_card_id,
          documentos: docsByReg[r.id] || [],
        }))
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      // Cotas
      const instByCard: Record<string, LeadReportInstallment[]> = {};
      for (const i of (((instRes as any).data || []) as any[])) {
        (instByCard[i.card_id] ||= []).push({
          id: i.id,
          numero_parcela: i.numero_parcela,
          tipo: i.tipo,
          valor_parcela: i.valor_parcela,
          data_vencimento: i.data_vencimento,
          data_pagamento: i.data_pagamento,
          status: i.status,
        });
      }
      const actByCard: Record<string, LeadReportCardActivity[]> = {};
      for (const a of (((cardActRes as any).data || []) as any[])) {
        (actByCard[a.card_id] ||= []).push({
          id: a.id,
          created_at: a.created_at,
          event_category: a.event_category,
          event_type: a.event_type,
          description: a.description,
          before_value: a.before_value,
          after_value: a.after_value,
          actor_name: a.actor_name,
        });
      }
      const linkedCardIds = new Set(
        registrations.map((r) => r.consortium_card_id).filter(Boolean) as string[],
      );
      const cards: LeadReportCard[] = (((cardsRes as any).data || []) as any[]).map((c) => {
        const installments = instByCard[c.id] || [];
        return {
          id: c.id,
          grupo: c.grupo,
          cota: c.cota,
          contrato_embracon: c.contrato_embracon,
          status: c.status,
          categoria: c.categoria,
          valor_credito: c.valor_credito,
          prazo_meses: c.prazo_meses,
          parcela_1a_12a: c.parcela_1a_12a,
          parcela_demais: c.parcela_demais,
          parcelas_pagas_empresa: c.parcelas_pagas_empresa,
          dia_vencimento: c.dia_vencimento,
          data_contratacao: c.data_contratacao,
          vendedor_name: c.vendedor_name,
          created_at: c.created_at,
          isExternal: !linkedCardIds.has(c.id),
          installments,
          documentos: docsByCard[c.id] || [],
          activity: actByCard[c.id] || [],
          totals: sumInstallments(installments),
        };
      });

      const termos: LeadReportTermo[] = (((termosRes as any).data || []) as any[]).map((t) => ({
        id: t.id,
        tipo: t.tipo,
        status: t.status,
        created_at: t.created_at,
        expires_at: t.expires_at,
        assinado_em: t.assinado_em,
        assinante_nome: t.assinante_nome,
        assinante_cpf: t.assinante_cpf ?? null,
        assinante_ip: t.assinante_ip ?? null,
        visualizado_em: t.visualizado_em,
        visualizado_ip: t.visualizado_ip ?? null,
        conteudo_hash: t.conteudo_hash ?? null,
        cancelado_em: t.cancelado_em,
        cancelado_motivo: t.cancelado_motivo,
        modelo_versao: t.modelo_versao,
      }));

      // ===== Lacunas — só afirmam ausência sobre fontes que leram com sucesso =====
      const gaps: string[] = [];
      const unknowns: { label: string; error: string | null }[] = [];
      const SOURCE_LABEL: Record<string, string> = {
        deals: 'negócios do contato',
        meetings: 'reuniões (agenda)',
        movements: 'movimentações de reunião',
        proposals: 'cartas/propostas',
        registrations: 'cadastros pendentes',
        registrationsByProposal: 'cadastros por proposta',
        cards: 'cotas',
        installments: 'parcelas',
        documents: 'documentos',
        termos: 'termos e comprovantes',
        audit: 'auditoria de valores',
        cardActivity: 'histórico da cota',
        profiles: 'nomes de usuários',
      };
      for (const [k, v] of Object.entries(sources)) {
        if (k === 'deal') continue;
        if (!v.ok) unknowns.push({ label: SOURCE_LABEL[k] || k, error: v.error ?? null });
      }

      const okMeetings = sources.meetings.ok;
      const okProposals = sources.proposals.ok;
      const okRegs = sources.registrations.ok && sources.registrationsByProposal.ok;
      const okCards = sources.cards.ok;
      const okInst = sources.installments.ok;
      const okTermos = sources.termos.ok;
      const okDocs = sources.documents.ok;

      const hoje = new Date().toISOString().slice(0, 10);
      if (okMeetings && meetings.length === 0)
        gaps.push('Nenhuma reunião (R1/R2) registrada na agenda para este lead.');
      const r1Realizada = meetings.some((m) => (m.status || '').toLowerCase().includes('realizada'));
      const propostasVivas = proposalsOut.filter((p) => !p.excluida_value && !p.carta_excluida);
      if (okMeetings && okProposals && r1Realizada && propostasVivas.length === 0)
        gaps.push('R1 realizada, mas nenhuma carta/proposta registrada.');
      const aceitas = propostasVivas.filter((p) => (p.status || '').toLowerCase().startsWith('aceit'));
      if (okProposals && okRegs && aceitas.length && registrationsOut.length === 0)
        gaps.push('Proposta aceita sem cadastro de dados da cota.');
      if (okRegs) {
        for (const r of registrationsOut) {
          if (!r.declinada_at && !r.consortium_card_id)
            gaps.push(`Cadastro de ${r.nome || 'cliente'} sem cota vinculada.`);
        }
      }
      if (okCards) {
        for (const c of cards) {
          if (!c.contrato_embracon) gaps.push(`Cota ${c.grupo || '?'}/${c.cota || '?'} sem contrato Embracon.`);
          if (okRegs && c.isExternal)
            gaps.push(`Cota ${c.grupo || '?'}/${c.cota || '?'} externa — sem vínculo com cadastro do funil.`);
          if (okInst) {
            const atrasadas = c.installments.filter(
              (i) => !i.data_pagamento && i.data_vencimento && i.data_vencimento < hoje && i.status !== 'cancelado',
            );
            if (atrasadas.length)
              gaps.push(`Cota ${c.grupo || '?'}/${c.cota || '?'} com ${atrasadas.length} parcela(s) em atraso.`);
          }
        }
      }
      const adesao = termos.filter((t) => t.tipo === 'adesao' && t.status !== 'cancelado');
      if (okTermos && okRegs && registrationsOut.length && adesao.length === 0)
        gaps.push('Termo de adesão nunca emitido.');
      if (okTermos && adesao.length && !adesao.some((t) => t.status === 'assinado'))
        gaps.push('Termo de adesão emitido, mas ainda não assinado.');
      const comprovantes = termos.filter((t) => t.tipo === 'comprovante_cadastro' && t.status !== 'cancelado');
      if (okTermos && okCards && cards.length && comprovantes.length === 0)
        gaps.push('Comprovante de cadastro na Embracon não emitido.');
      if (
        okDocs &&
        okRegs &&
        registrationsOut.length > 0 &&
        documentosSoltos.length === 0 &&
        registrationsOut.every((r) => r.documentos.length === 0) &&
        cards.every((c) => c.documentos.length === 0)
      )
        gaps.push('Nenhum documento anexado ao cadastro.');

      const origin: any = dealRow.crm_origins;
      return {
        deal: {
          id: dealRow.id,
          name: dealRow.name,
          created_at: dealRow.created_at,
          value: dealRow.value,
          stage_name: dealRow.crm_stages?.stage_name || null,
          pipeline_name: origin?.display_name || origin?.name || null,
          owner_name: nameOf(dealRow.owner_profile_id) || nameOf(dealRow.owner_id),
          original_sdr_email: dealRow.original_sdr_email,
          r1_closer_email: dealRow.r1_closer_email,
          r2_closer_email: dealRow.r2_closer_email,
          owner_profile_id: dealRow.owner_profile_id,
          lead_temperature: dealRow.lead_temperature,
          icp_segment: dealRow.icp_segment,
          tags: (dealRow.tags as string[] | null) || null,
          product_name: dealRow.product_name,
        },
        contact: {
          id: dealRow.crm_contacts?.id || dealRow.contact_id || null,
          name: dealRow.crm_contacts?.name || null,
          email: dealRow.crm_contacts?.email || null,
          phone: dealRow.crm_contacts?.phone || null,
        },
        allDealIds: uuidIds,
        pipelines: (((dealsRes as any).data || []) as any[]).map((d) => ({
          deal_id: d.id,
          pipeline_name: d.crm_origins?.display_name || d.crm_origins?.name || null,
          stage_name: d.crm_stages?.stage_name || null,
          created_at: d.created_at,
        })),
        meetings,
        proposals: proposalsOut,
        registrations: registrationsOut,
        documentosSoltos,
        termos,
        cards,
        gaps: [...new Set(gaps)],
        unknowns,
        sources,
      };
    },
  });
}

/**
 * Mapa cota → negócio do funil. Filtre pelos cards visíveis na página
 * para não varrer a tabela inteira (e truncar em silêncio no teto do PostgREST).
 */
export function useConsorcioCardDealLinks(cardIds?: string[]) {
  const ids = [...new Set((cardIds || []).filter(Boolean))].sort();
  return useQuery({
    queryKey: ['consorcio-card-deal-links', ids],
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Map<string, string>> => {
      const map = new Map<string, string>();
      const rows = await fetchAllByIds<any>(ids, (lote, from, to) =>
        supabase
          .from('consorcio_pending_registrations')
          .select('consortium_card_id, deal_id')
          .in('consortium_card_id', lote)
          .not('deal_id', 'is', null)
          .order('id', { ascending: true })
          .range(from, to),
      );
      for (const r of rows) {
        if (r.consortium_card_id && r.deal_id && !map.has(r.consortium_card_id)) {
          map.set(r.consortium_card_id, r.deal_id);
        }
      }
      return map;
    },
  });
}
