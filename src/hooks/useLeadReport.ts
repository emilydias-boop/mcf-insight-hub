import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useContactDealIds } from './useContactDealIds';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface LeadReportMeeting {
  id: string;
  deal_id: string | null;
  scheduled_at: string | null;
  status: string | null;
  closer_name: string | null;
  booked_by_name: string | null;
  booked_at: string | null;
  is_reschedule: boolean | null;
  outcome_reason: string | null;
  outcome_reason_note: string | null;
  contract_paid_at: string | null;
  refunded_at: string | null;
  notes: string | null;
  closer_notes: string | null;
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
  aceite_date: string | null;
  aceite_at: string | null;
  aceite_by_name: string | null;
  recusada_at: string | null;
  recusada_by_name: string | null;
  motivo_recusa: string | null;
  created_at: string;
  created_by_name: string | null;
  carta_excluida: boolean | null;
  carta_excluida_em: string | null;
  carta_excluida_por_nome: string | null;
  carta_excluida_motivo: string | null;
  deleted_at: string | null;
  deletion_reason: string | null;
  consortium_card_id: string | null;
  /** Alterações de valor/prazo registradas em audit_logs (sem dado pessoal). */
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
  cota_aberta_at: string | null;
  vinculada_at: string | null;
  declinada_at: string | null;
  motivo_declinio: string | null;
  consortium_card_id: string | null;
}

export interface LeadReportTermo {
  id: string;
  tipo: string;
  status: string;
  created_at: string;
  expires_at: string | null;
  assinado_em: string | null;
  assinante_nome: string | null;
  visualizado_em: string | null;
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
  /** Cota sem vínculo com nenhum cadastro/negócio do funil. */
  isExternal: boolean;
  installments: LeadReportInstallment[];
  documentos: { id: string; tipo: string | null; nome_arquivo: string | null; uploaded_at: string | null }[];
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
  termos: LeadReportTermo[];
  cards: LeadReportCard[];
  gaps: string[];
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

/**
 * Relatório do Lead (Fase 3B) — apenas leitura.
 * Compõe negócio, reuniões, propostas, cadastros, documentos e cotas/parcelas
 * a partir de todos os negócios do mesmo contato.
 */
export function useLeadReport(dealId: string | undefined) {
  const { data: allDealIds = [] } = useContactDealIds(dealId);
  const uuidIds = [...new Set([...(allDealIds || []), dealId].filter((id): id is string => !!id && UUID_RE.test(id)))];

  return useQuery({
    queryKey: ['lead-report', dealId, uuidIds],
    enabled: !!dealId && uuidIds.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<LeadReportData> => {
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
            'id, deal_id, status, booked_by, booked_at, is_reschedule, notes, closer_notes, outcome_reason, outcome_reason_note, contract_paid_at, refunded_at, created_at, meeting_slots(scheduled_at, closers(name))',
          )
          .in('deal_id', uuidIds)
          .limit(100),
        supabase.from('consorcio_proposals').select('*').in('deal_id', uuidIds).limit(100),
        supabase.from('consorcio_pending_registrations').select('*').in('deal_id', uuidIds).limit(100),
      ]);

      if (dealRes.error) throw dealRes.error;
      if (!dealRes.data) throw new Error('Negócio não encontrado');
      const dealRow: any = dealRes.data;

      const proposals: any[] = proposalsRes.data || [];
      const proposalIds = proposals.map((p) => p.id);

      // cadastros pendentes: por deal_id OU por proposta
      let registrations: any[] = regsRes.data || [];
      if (proposalIds.length) {
        const { data: byProposal } = await supabase
          .from('consorcio_pending_registrations')
          .select('*')
          .in('proposal_id', proposalIds);
        const seen = new Set(registrations.map((r) => r.id));
        for (const r of byProposal || []) if (!seen.has(r.id)) registrations.push(r);
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
      const attendeeIds = (attendeesRes.data || []).map((a: any) => a.id);

      const [cardsRes, instRes, docsRes, termosRes, movesRes, auditRes] = await Promise.all([
        cardIds.length
          ? supabase.from('consortium_cards').select('*').in('id', cardIds)
          : Promise.resolve({ data: [] as any[] }),
        cardIds.length
          ? supabase
              .from('consortium_installments')
              .select('id, card_id, numero_parcela, tipo, valor_parcela, data_vencimento, data_pagamento, status')
              .in('card_id', cardIds)
              .order('numero_parcela', { ascending: true })
          : Promise.resolve({ data: [] as any[] }),
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
          : Promise.resolve({ data: [] as any[] }),
        supabase
          .from('consorcio_termos')
          .select(
            'id, tipo, status, created_at, expires_at, assinado_em, assinante_nome, visualizado_em, cancelado_em, cancelado_motivo, modelo_versao, deal_id, card_id, pending_registration_id',
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
          : Promise.resolve({ data: [] as any[] }),
        proposalIds.length || regIds.length
          ? supabase
              .from('audit_logs')
              .select('id, created_at, action, table_name, record_id, old_data, new_data, user_id')
              .in('record_id', [...proposalIds, ...regIds])
              .order('created_at', { ascending: true })
              .limit(300)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      // Resolver nomes de usuários
      const userIds = new Set<string>();
      const addUser = (v: any) => {
        if (v && typeof v === 'string' && UUID_RE.test(v)) userIds.add(v);
      };
      addUser(dealRow.owner_profile_id);
      addUser(dealRow.owner_id);
      for (const a of attendeesRes.data || []) addUser((a as any).booked_by);
      for (const p of proposals) {
        addUser(p.created_by);
        addUser(p.aceite_by);
        addUser(p.recusada_by);
        addUser(p.carta_excluida_por);
      }
      for (const l of (auditRes as any).data || []) addUser(l.user_id);

      const profileMap: Record<string, string> = {};
      if (userIds.size) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', [...userIds]);
        for (const p of profs || []) profileMap[p.id] = p.full_name || p.email || 'Usuário';
      }
      const nameOf = (id: any, fallback: string | null = null) =>
        (id && profileMap[id]) || fallback || (id ? 'Usuário' : null);

      // Auditoria de valor por registro
      const auditByRecord: Record<string, LeadReportAudit[]> = {};
      for (const l of ((auditRes as any).data || []) as any[]) {
        const changes = l.action === 'UPDATE' ? diffAuditable(l.old_data, l.new_data) : [];
        if (l.action === 'UPDATE' && changes.length === 0) continue;
        const entry: LeadReportAudit = {
          id: l.id,
          created_at: l.created_at,
          action: l.action,
          table_name: l.table_name,
          record_id: l.record_id,
          actor_name: nameOf(l.user_id),
          changes,
        };
        (auditByRecord[l.record_id] ||= []).push(entry);
      }

      // Reuniões
      const movesByAttendee: Record<string, any[]> = {};
      for (const m of ((movesRes as any).data || []) as any[]) {
        (movesByAttendee[m.attendee_id] ||= []).push(m);
      }
      const meetings: LeadReportMeeting[] = ((attendeesRes.data || []) as any[])
        .map((a) => ({
          id: a.id,
          deal_id: a.deal_id,
          scheduled_at: a.meeting_slots?.scheduled_at || null,
          status: a.status,
          closer_name: a.meeting_slots?.closers?.name || null,
          booked_by_name: nameOf(a.booked_by),
          booked_at: a.booked_at || a.created_at,
          is_reschedule: a.is_reschedule,
          outcome_reason: a.outcome_reason,
          outcome_reason_note: a.outcome_reason_note,
          contract_paid_at: a.contract_paid_at,
          refunded_at: a.refunded_at,
          notes: a.notes,
          closer_notes: a.closer_notes,
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
          aceite_date: p.aceite_date,
          aceite_at: p.aceite_at,
          aceite_by_name: nameOf(p.aceite_by),
          recusada_at: p.recusada_at,
          recusada_by_name: nameOf(p.recusada_by),
          motivo_recusa: p.motivo_recusa,
          created_at: p.created_at,
          created_by_name: nameOf(p.created_by),
          carta_excluida: p.carta_excluida,
          carta_excluida_em: p.carta_excluida_em,
          carta_excluida_por_nome: p.carta_excluida_por_nome || nameOf(p.carta_excluida_por),
          carta_excluida_motivo: p.carta_excluida_motivo,
          deleted_at: p.deleted_at,
          deletion_reason: p.deletion_reason,
          consortium_card_id: p.consortium_card_id,
          valueChanges: auditByRecord[p.id] || [],
        }))
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

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
          cota_aberta_at: r.cota_aberta_at,
          vinculada_at: r.vinculada_at,
          declinada_at: r.declinada_at,
          motivo_declinio: r.motivo_declinio,
          consortium_card_id: r.consortium_card_id,
        }))
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      // Cotas
      const instByCard: Record<string, LeadReportInstallment[]> = {};
      for (const i of ((instRes as any).data || []) as any[]) {
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
      const docsByCard: Record<string, any[]> = {};
      const docsLoose: any[] = [];
      for (const d of ((docsRes as any).data || []) as any[]) {
        if (d.card_id) (docsByCard[d.card_id] ||= []).push(d);
        else docsLoose.push(d);
      }
      const linkedCardIds = new Set(
        registrations.map((r) => r.consortium_card_id).filter(Boolean) as string[],
      );
      const cards: LeadReportCard[] = (((cardsRes as any).data || []) as any[]).map((c) => ({
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
        installments: instByCard[c.id] || [],
        documentos: (docsByCard[c.id] || []).map((d) => ({
          id: d.id,
          tipo: d.tipo,
          nome_arquivo: d.nome_arquivo,
          uploaded_at: d.uploaded_at,
        })),
      }));

      const termos: LeadReportTermo[] = (((termosRes as any).data || []) as any[]).map((t) => ({
        id: t.id,
        tipo: t.tipo,
        status: t.status,
        created_at: t.created_at,
        expires_at: t.expires_at,
        assinado_em: t.assinado_em,
        assinante_nome: t.assinante_nome,
        visualizado_em: t.visualizado_em,
        cancelado_em: t.cancelado_em,
        cancelado_motivo: t.cancelado_motivo,
        modelo_versao: t.modelo_versao,
      }));

      // Lacunas
      const gaps: string[] = [];
      const hoje = new Date().toISOString().slice(0, 10);
      if (meetings.length === 0) gaps.push('Nenhuma reunião (R1/R2) registrada na agenda para este lead.');
      const r1Realizada = meetings.some((m) => (m.status || '').toLowerCase().includes('realizada'));
      const propostasVivas = proposalsOut.filter((p) => !p.deleted_at && !p.carta_excluida);
      if (r1Realizada && propostasVivas.length === 0) gaps.push('R1 realizada, mas nenhuma carta/proposta registrada.');
      const aceitas = propostasVivas.filter((p) => (p.status || '').toLowerCase().startsWith('aceit'));
      if (aceitas.length && registrationsOut.length === 0)
        gaps.push('Proposta aceita sem cadastro de dados da cota.');
      for (const r of registrationsOut) {
        if (!r.declinada_at && !r.consortium_card_id)
          gaps.push(`Cadastro de ${r.nome || 'cliente'} sem cota vinculada.`);
      }
      for (const c of cards) {
        if (!c.contrato_embracon) gaps.push(`Cota ${c.grupo || '?'}/${c.cota || '?'} sem contrato Embracon.`);
        if (c.isExternal) gaps.push(`Cota ${c.grupo || '?'}/${c.cota || '?'} externa — sem vínculo com cadastro do funil.`);
        const atrasadas = c.installments.filter(
          (i) => !i.data_pagamento && i.data_vencimento && i.data_vencimento < hoje && i.status !== 'cancelado',
        );
        if (atrasadas.length)
          gaps.push(`Cota ${c.grupo || '?'}/${c.cota || '?'} com ${atrasadas.length} parcela(s) em atraso.`);
      }
      const adesao = termos.filter((t) => t.tipo === 'adesao' && t.status !== 'cancelado');
      if (registrationsOut.length && adesao.length === 0) gaps.push('Termo de adesão nunca emitido.');
      if (adesao.length && !adesao.some((t) => t.status === 'assinado'))
        gaps.push('Termo de adesão emitido, mas ainda não assinado.');
      const comprovantes = termos.filter((t) => t.tipo === 'comprovante_cadastro' && t.status !== 'cancelado');
      if (cards.length && comprovantes.length === 0) gaps.push('Comprovante de cadastro na Embracon não emitido.');
      if (docsLoose.length === 0 && cards.length === 0 && registrationsOut.length > 0)
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
        termos,
        cards,
        gaps: [...new Set(gaps)],
      };
    },
  });
}

/** Mapa cota → negócio do funil (para abrir o Relatório do Lead a partir da lista de Cotas). */
export function useConsorcioCardDealLinks() {
  return useQuery({
    queryKey: ['consorcio-card-deal-links'],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Map<string, string>> => {
      const { data, error } = await supabase
        .from('consorcio_pending_registrations')
        .select('consortium_card_id, deal_id')
        .not('consortium_card_id', 'is', null)
        .not('deal_id', 'is', null);
      if (error) throw error;
      const map = new Map<string, string>();
      for (const r of (data || []) as any[]) {
        if (r.consortium_card_id && r.deal_id && !map.has(r.consortium_card_id)) {
          map.set(r.consortium_card_id, r.deal_id);
        }
      }
      return map;
    },
  });
}