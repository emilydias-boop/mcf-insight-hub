import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay, format, subHours, addHours } from "date-fns";

/**
 * Executes a Supabase .in() query in batches to avoid URL length limits.
 * Splits large arrays into chunks of `batchSize` and runs them in parallel.
 */
async function batchedIn<T>(
  queryFn: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: any }>,
  items: string[],
  // 60 mantém a URL bem abaixo do limite de ~8KB do gateway (evita HTTP 414,
  // que fazia as tabelas de SDRs/Closers voltarem vazias)
  batchSize = 60
): Promise<T[]> {
  if (items.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    chunks.push(items.slice(i, i + batchSize));
  }

  // Se o gateway rejeitar um lote (URL/proxy/timeout), divide apenas aquele
  // trecho e tenta novamente. Assim uma falha transitória não apaga toda a
  // tabela, e nenhum registro é descartado silenciosamente.
  const runChunk = async (chunk: string[]): Promise<T[]> => {
    let result: { data: T[] | null; error: any };
    try {
      result = await queryFn(chunk);
    } catch (error) {
      result = { data: null, error };
    }
    if (!result.error) return result.data || [];
    if (chunk.length === 1) {
      // Consultas auxiliares (perfil, contato, transação e reembolso) não podem
      // derrubar a métrica principal. Antes, um único registro inválido fazia o
      // React Query descartar TODOS os Closers, embora as demais requisições
      // tivessem retornado 200. Mantemos os dados válidos e isolamos só o item.
      console.error('[useR1CloserMetrics] Registro auxiliar ignorado após falha isolada', {
        item: chunk[0],
        error: result.error,
      });
      return [];
    }

    const middle = Math.ceil(chunk.length / 2);
    const [left, right] = await Promise.all([
      runChunk(chunk.slice(0, middle)),
      runChunk(chunk.slice(middle)),
    ]);
    return [...left, ...right];
  };

  const results = await Promise.all(chunks.map(runChunk));
  const allData: T[] = [];
  for (const r of results) {
    allData.push(...r);
  }
  return allData;
}

export interface R1CloserMetric {
  closer_id: string;
  closer_name: string;
  closer_color: string | null;
  r1_agendada: number;
  /** Ato de agendar: participantes cujo booked_at cai no período (eixo diferente
   *  de r1_agendada, que usa meeting_slots.scheduled_at). */
  agendamentos: number;
  r1_realizada: number;
  noshow: number;
  contrato_pago: number;
  outside: number;
  r2_agendada: number;
  reembolsos: number;
  reembolsos_valor: number;
  /** Linha sintética "Não atribuído" (não é um closer real). */
  is_unassigned?: boolean;
  /** Quebra por motivo do descarte (só na linha "Não atribuído"). */
  unassigned_reasons?: Record<UnassignedReason, number>;
}

export const UNASSIGNED_CLOSER_ID = '__nao_atribuido__';

export type UnassignedReason =
  | 'sem_closer'
  | 'outra_bu'
  | 'sem_negocio'
  | 'closer_inativo';

export const UNASSIGNED_REASON_LABELS: Record<UnassignedReason, string> = {
  sem_closer: 'sem closer designado',
  outra_bu: 'closer de outra BU',
  sem_negocio: 'participante sem negócio',
  closer_inativo: 'closer inativo no período',
};

export type IcpSegmentFilter = 'all' | 'A' | 'B';

export function useR1CloserMetrics(
  startDate: Date,
  endDate: Date,
  bu: string = 'incorporador',
  segment: IcpSegmentFilter = 'all',
  /** Quando true, acrescenta ao fim a linha sintética "Não atribuído" com as
   *  reuniões que antes eram descartadas em silêncio. */
  includeUnassigned = false,
) {
  return useQuery({
    queryKey: ['r1-closer-metrics', format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd'), bu, segment, includeUnassigned],
    queryFn: async (): Promise<R1CloserMetric[]> => {
      // Filtro ICP (aditivo): com 'all' nada muda no comportamento existente.
      const segmentActive = segment === 'A' || segment === 'B';
      let segmentAllowedContracts: Set<string> | null = null;
      const allowedDealIds = async (ids: string[]): Promise<Set<string>> => {
        if (!segmentActive || ids.length === 0) return new Set(ids);
        const rows = await batchedIn<{ id: string }>(
          (chunk) => (supabase.from('crm_deals') as any).select('id').eq('icp_segment', segment).in('id', chunk),
          ids
        );
        return new Set((rows || []).map((r) => r.id));
      };

      // Corrigir fuso horário BRT (UTC-3): somar 3h em ambos os extremos
      // Ex: dia 05/03 BRT = 05/03 03:00 UTC → 06/03 02:59 UTC (janela 24h exata)
      const BRT_OFFSET_HOURS = 3;
      const start = addHours(startOfDay(startDate), BRT_OFFSET_HOURS).toISOString();
      const end = addHours(endOfDay(endDate), BRT_OFFSET_HOURS).toISOString();

      // Fetch ALL closers of this BU (including inactive ones).
      // Inactive closers are needed to preserve historical attribution:
      // contracts/meetings from a closer who has since left the team must
      // still appear in the period they happened in.
      const { data: closers, error: closersError } = await supabase
        .from('closers')
        .select('id, name, color, email, meeting_type, bu, is_active')
        .eq('bu', bu);

      if (closersError) throw closersError;

      // Active R1 closers — initialized with zeros so they always appear in the table.
      const r1Closers = closers?.filter(
        c => c.is_active === true && (!c.meeting_type || c.meeting_type === 'r1')
      ) || [];

      // Fetch active SDRs from database instead of hardcoded list
      const { data: sdrs, error: sdrsError } = await supabase
        .from('sdr')
        .select('email, name')
        .eq('active', true)
        .eq('squad', bu);
        // REMOVIDO: .eq('role_type', 'sdr') — closers também podem agendar reuniões diretamente

      if (sdrsError) throw sdrsError;

      // Também incluir closers ativos da BU como agendadores válidos
      // Caso: Thaynar Tavares (closer) agenda reuniões diretamente → contrato deve ser contado
      // E-mail não é obrigatório nos cadastros legados. Um único closer/SDR sem
      // e-mail não pode interromper o cálculo inteiro e zerar a aba de Closers.
      const closerEmails = new Set(
        (closers || [])
          .map(c => c.email?.trim().toLowerCase())
          .filter((email): email is string => Boolean(email))
      );

      const validSdrEmails = new Set([
        ...(sdrs || [])
          .map(s => s.email?.trim().toLowerCase())
          .filter((email): email is string => Boolean(email)),
        ...closerEmails,
      ]);

      // Statuses that count as "Agendada" - explicitly defined to avoid counting canceled/rescheduled
      const allowedAgendadaStatuses = ['scheduled', 'invited', 'completed', 'no_show', 'contract_paid', 'refunded', 'rescheduled'];

      // Régua de "realizada": no Consórcio o termo "contrato pago" não existe no
      // vocabulário do processo (decisão do CEO registrada em
      // docs/qa/2026-08-16-funil-consorcio-6-etapas-fluxo-por-periodo.md):
      // realizada = apenas 'completed'. Nas demais BUs mantém-se a régua
      // histórica (completed | contract_paid | refunded).
      const realizadaStatuses = bu === 'consorcio'
        ? ['completed']
        : ['completed', 'contract_paid', 'refunded'];

      // Fetch R1 meeting slots with attendees in the period
      const { data: meetings, error: meetingsError } = await supabase
        .from('meeting_slots')
        .select(`
          id,
          closer_id,
          meeting_type,
          scheduled_at,
        meeting_slot_attendees (
            id,
            status,
            deal_id,
            booked_by,
            contract_paid_at,
            is_partner
          )
        `)
        .eq('meeting_type', 'r1')
        .gte('scheduled_at', start)
        .lte('scheduled_at', end)
        .neq('status', 'cancelled')
        .neq('status', 'canceled');

      if (meetingsError) throw meetingsError;

      // ========== AGENDAMENTOS (eixo = data do ATO de agendar) ==========
      // r1_agendada conta reuniões PARA o período (meeting_slots.scheduled_at).
      // Aqui contamos agendamentos FEITOS no período (booked_at), mesmo que a
      // reunião esteja fora da janela. Mesmas exclusões: slot não cancelado,
      // is_partner = false, status de attendee permitido, offset BRT.
      const { data: bookedAttendees, error: bookedError } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          id,
          status,
          deal_id,
          booked_at,
          is_partner,
          meeting_slot:meeting_slots!inner(
            id,
            closer_id,
            meeting_type,
            status
          )
        `)
        .eq('meeting_slot.meeting_type', 'r1')
        .eq('is_partner', false)
        .not('booked_at', 'is', null)
        .gte('booked_at', start)
        .lte('booked_at', end);

      if (bookedError) throw bookedError;

      // Fetch profiles to map booked_by UUID to email
      const bookedByIds = new Set<string>();
      meetings?.forEach(meeting => {
        meeting.meeting_slot_attendees?.forEach(att => {
          if (att.booked_by) bookedByIds.add(att.booked_by);
        });
      });

      const profiles = await batchedIn<{ id: string; email: string | null }>(
        (chunk) => supabase.from('profiles').select('id, email').in('id', chunk),
        Array.from(bookedByIds)
      );

      const profileEmailMap = new Map<string, string>();
      profiles?.forEach(p => {
        const email = p.email?.trim().toLowerCase();
        if (email) profileEmailMap.set(p.id, email);
      });

      // Fetch R2 meetings to count R2 agendadas per closer
      // R2 is attributed to the closer who did the R1 for the same deal
      const { data: r2Meetings, error: r2Error } = await supabase
        .from('meeting_slots')
        .select(`
          id,
          scheduled_at,
          meeting_slot_attendees (
            deal_id
          )
        `)
        .eq('meeting_type', 'r2')
        .gte('scheduled_at', start)
        .lte('scheduled_at', end)
        .not('status', 'eq', 'cancelled');

      if (r2Error) throw r2Error;

      // Buscar R1 meetings dos últimos 6 meses para mapear deal → closer R1
      // Isso é necessário porque uma R2 pode estar vinculada a uma R1 de meses anteriores
      const sixMonthsAgo = new Date(startDate);
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const sixMonthsAgoISO = startOfDay(sixMonthsAgo).toISOString();

      const { data: allR1Meetings, error: allR1Error } = await supabase
        .from('meeting_slots')
        .select(`
          closer_id,
          meeting_slot_attendees (
            deal_id,
            booked_by,
            status
          )
        `)
        .eq('meeting_type', 'r1')
        .gte('scheduled_at', sixMonthsAgoISO)
        .neq('status', 'cancelled')
        .neq('status', 'canceled');

      if (allR1Error) throw allR1Error;

      // Fetch profiles for the new query's booked_by IDs
      const allBookedByIds = new Set<string>();
      allR1Meetings?.forEach(meeting => {
        meeting.meeting_slot_attendees?.forEach(att => {
          if (att.booked_by) allBookedByIds.add(att.booked_by);
        });
      });

      const allProfiles = await batchedIn<{ id: string; email: string | null }>(
        (chunk) => supabase.from('profiles').select('id, email').in('id', chunk),
        Array.from(allBookedByIds)
      );

      const allProfileEmailMap = new Map<string, string>();
      allProfiles?.forEach(p => {
        const email = p.email?.trim().toLowerCase();
        if (email) allProfileEmailMap.set(p.id, email);
      });

      // Build a map of deal_id -> R1 closer_id using ALL R1 meetings (not date-filtered)
      const dealToR1Closer = new Map<string, string>();
      allR1Meetings?.forEach(meeting => {
        meeting.meeting_slot_attendees?.forEach(att => {
          if (att.deal_id && meeting.closer_id) {
            // Only include if booked by valid SDR AND has an allowed status
            const bookedByEmail = att.booked_by ? allProfileEmailMap.get(att.booked_by) : null;
            const status = att.status;
            if (bookedByEmail && validSdrEmails.has(bookedByEmail) && allowedAgendadaStatuses.includes(status)) {
              // First match wins - don't overwrite existing mappings
              if (!dealToR1Closer.has(att.deal_id)) {
                dealToR1Closer.set(att.deal_id, meeting.closer_id);
              }
            }
          }
        });
      });

      // Count R2 meetings per R1 closer
      const r2CountByCloser = new Map<string, number>();
      r2Meetings?.forEach(meeting => {
        meeting.meeting_slot_attendees?.forEach(att => {
          if (att.deal_id) {
            const r1CloserId = dealToR1Closer.get(att.deal_id);
            if (r1CloserId) {
              r2CountByCloser.set(r1CloserId, (r2CountByCloser.get(r1CloserId) || 0) + 1);
            }
          }
        });
      });

      // ========== CONTRACT PAID BY PAYMENT DATE ==========
      // Buscar contratos pagos pela DATA DO PAGAMENTO (não da reunião)
      // FONTE DA VERDADE: contract_paid_at IS NOT NULL (independente do status)
      const { data: contractsByPaymentDate, error: contractsError } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          id,
          status,
          contract_paid_at,
          booked_by,
          is_partner,
          deal_id,
          meeting_slot:meeting_slots!inner(
            closer_id,
            meeting_type,
            scheduled_at
          )
        `)
        .eq('meeting_slot.meeting_type', 'r1')
        .eq('is_partner', false)
        .not('contract_paid_at', 'is', null)
        .gte('contract_paid_at', start)
        .lte('contract_paid_at', end);

      if (contractsError) throw contractsError;

      // Também buscar contratos com status contract_paid mas SEM contract_paid_at (fallback para scheduled_at)
      // Esses são contratos antigos que não têm timestamp de pagamento
      const { data: contractsWithoutTimestamp } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          id,
          status,
          contract_paid_at,
          booked_by,
          is_partner,
          deal_id,
          meeting_slot:meeting_slots!inner(
            closer_id,
            meeting_type,
            scheduled_at
          )
        `)
        .eq('status', 'contract_paid')
        .eq('meeting_slot.meeting_type', 'r1')
        .eq('is_partner', false)
        .is('contract_paid_at', null)
        .gte('meeting_slot.scheduled_at', start)
        .lte('meeting_slot.scheduled_at', end);

      // ===== Aplicação do filtro de segmento ICP (só quando != 'all') =====
      if (segmentActive) {
        const ids = new Set<string>();
        meetings?.forEach(m => m.meeting_slot_attendees?.forEach(a => { if (a.deal_id) ids.add(a.deal_id); }));
        r2Meetings?.forEach(m => m.meeting_slot_attendees?.forEach((a: any) => { if (a.deal_id) ids.add(a.deal_id); }));
        (contractsByPaymentDate as any[] | null)?.forEach(a => { if (a.deal_id) ids.add(a.deal_id); });
        (contractsWithoutTimestamp as any[] | null)?.forEach(a => { if (a.deal_id) ids.add(a.deal_id); });

        const allowed = await allowedDealIds(Array.from(ids));
        const keep = (dealId: string | null | undefined) => !!dealId && allowed.has(dealId);

        meetings?.forEach((m: any) => {
          m.meeting_slot_attendees = (m.meeting_slot_attendees || []).filter((a: any) => keep(a.deal_id));
        });
        r2Meetings?.forEach((m: any) => {
          m.meeting_slot_attendees = (m.meeting_slot_attendees || []).filter((a: any) => keep(a.deal_id));
        });
        // Recalcula o mapa deal → closer R1 apenas com deals permitidos
        Array.from(dealToR1Closer.keys()).forEach((dealId) => {
          if (!keep(dealId)) dealToR1Closer.delete(dealId);
        });
        r2CountByCloser.clear();
        r2Meetings?.forEach((meeting: any) => {
          meeting.meeting_slot_attendees?.forEach((att: any) => {
            const r1CloserId = att.deal_id ? dealToR1Closer.get(att.deal_id) : null;
            if (r1CloserId) r2CountByCloser.set(r1CloserId, (r2CountByCloser.get(r1CloserId) || 0) + 1);
          });
        });
        segmentAllowedContracts = allowed;
      }

      // Contagem de "Agendamentos" por closer (eixo booked_at)
      const bookedAllowedDeals = segmentActive
        ? await allowedDealIds(
            Array.from(new Set(((bookedAttendees as any[]) || [])
              .map((a: any) => a.deal_id)
              .filter(Boolean) as string[]))
          )
        : null;
      // Mesma régua de dedup do r1_agendada: por (closer, deal_id) com cap 2 —
      // agendamentos no MESMO dia contam 1x, dias distintos contam até 2x.
      // Aqui os dias são de booked_at (ato de agendar), não de scheduled_at.
      // Attendee sem deal_id conta 1 individualmente.
      const agendamentosByCloser = new Map<string, number>();
      const bookedDealDays = new Map<string, Map<string, Set<string>>>();
      ((bookedAttendees as any[]) || []).forEach((att: any) => {
        const slot = att.meeting_slot;
        if (!slot?.closer_id) return;
        const slotStatus = String(slot.status || '').toLowerCase();
        if (slotStatus === 'cancelled' || slotStatus === 'canceled') return;
        if (!allowedAgendadaStatuses.includes(att.status)) return;
        if (bookedAllowedDeals && !(att.deal_id && bookedAllowedDeals.has(att.deal_id))) return;

        if (!att.deal_id) {
          agendamentosByCloser.set(slot.closer_id, (agendamentosByCloser.get(slot.closer_id) || 0) + 1);
          return;
        }
        if (!bookedDealDays.has(slot.closer_id)) bookedDealDays.set(slot.closer_id, new Map());
        const dealMap = bookedDealDays.get(slot.closer_id)!;
        if (!dealMap.has(att.deal_id)) dealMap.set(att.deal_id, new Set());
        dealMap.get(att.deal_id)!.add(format(new Date(att.booked_at), 'yyyy-MM-dd'));
      });
      bookedDealDays.forEach((dealMap, closerId) => {
        let total = 0;
        dealMap.forEach((days) => { total += days.size >= 2 ? 2 : 1; });
        agendamentosByCloser.set(closerId, (agendamentosByCloser.get(closerId) || 0) + total);
      });

      // ========== RÉGUA DE CAUÇÃO (Contrato Pago) ==========
      // Fonte única: RPC caucoes_efetivas.
      //  - data = data da transação A000/Contrato real (fallback contract_paid_at manual);
      //  - closer = closer da última R1 não cancelada do negócio;
      //  - 1 caução por negócio (já deduplicado no banco).
      const { data: caucoesRows, error: caucoesError } = await (supabase as any).rpc('caucoes_efetivas', {
        p_from: format(startDate, 'yyyy-MM-dd'),
        p_to: format(endDate, 'yyyy-MM-dd'),
        p_bu: bu,
      });
      if (caucoesError) throw caucoesError;

      const contractsByCloser = new Map<string, number>();
      // Painel Comercial = LÍQUIDO: caucoes_efetivas passou a devolver também as
      // vendas reembolsadas (bruto, usado no ranking da TV), então o filtro de
      // reembolso acontece aqui.
      const refundByCloser = new Map<string, number>();
      const refundValueByCloser = new Map<string, number>();
      const refundedDealsSeen = new Set<string>();
      ((caucoesRows as any[]) || []).forEach((row: any) => {
        if (segmentActive && String(row.segment || '').toUpperCase() !== segment) return;
        const closerId = row.closer_id as string | null;
        if (!closerId) return; // sem closer identificável → linha "Não atribuído"
        if (row.refunded_at) {
          const key = String(row.deal_id || row.attendee_id);
          if (refundedDealsSeen.has(key)) return;
          refundedDealsSeen.add(key);
          refundByCloser.set(closerId, (refundByCloser.get(closerId) || 0) + 1);
          refundValueByCloser.set(closerId, (refundValueByCloser.get(closerId) || 0) + Number(row.valor || 0));
          return;
        }
        contractsByCloser.set(closerId, (contractsByCloser.get(closerId) || 0) + 1);
      });

      // ========== OUTSIDE DETECTION (attributed by SALE DATE) ==========
      // Outside detection only applies to 'incorporador' BU
      // For consorcio, the concept doesn't apply — skip entirely
      
      const dealEmailMap = new Map<string, string>();
      const emailContractDate = new Map<string, Date>();
      const outsideByCloser = new Map<string, number>();

      // Outside é detectado por e-mail (sem deal garantido) → não é segmentável hoje.
      if (bu === 'incorporador' && !segmentActive) {
        // Fetch IDs of FIRST purchase per customer (Novo) — used to exclude
        // recurring transactions from the outside count. Recurring sales
        // (e.g. monthly Hubla recurrence) must NOT count as new contracts.
        const { data: firstIdsRows } = await supabase.rpc('get_first_transaction_ids' as any);
        const firstTransactionIds = new Set<string>(
          (firstIdsRows as any[] | null || []).map((r: any) => r.id as string)
        );

        // --- Part A: dealEmailMap + emailContractDate for EXCLUSION logic ---
        const dealIds = new Set<string>();
        meetings?.forEach(meeting => {
          meeting.meeting_slot_attendees?.forEach(att => {
            if (att.deal_id) dealIds.add(att.deal_id);
          });
        });

        const deals = await batchedIn<{ id: string; contact: { id: string; email: string | null } | null }>(
          (chunk) => supabase.from('crm_deals').select('id, contact:crm_contacts(id, email)').in('id', chunk),
          Array.from(dealIds)
        );

        deals?.forEach(deal => {
          const contact = deal.contact as { id: string; email: string | null } | null;
          const email = contact?.email?.trim().toLowerCase();
          if (email) dealEmailMap.set(deal.id, email);
        });

        const attendeeEmails = [...new Set(Array.from(dealEmailMap.values()))];

        // Fetch ALL contracts for these emails (no date filter) — needed for exclusion
        const contracts = await batchedIn<{ customer_email: string | null; sale_date: string }>(
          (chunk) => supabase
            .from('hubla_transactions')
            .select('customer_email, sale_date')
            .in('customer_email', chunk)
            .in('product_category', ['contrato', 'incorporador'])
            .ilike('product_name', '%contrato%')
            .eq('sale_status', 'completed')
            .order('sale_date', { ascending: true }),
          attendeeEmails.length > 0 ? attendeeEmails : []
        );

        contracts?.forEach(c => {
          const email = c.customer_email?.trim().toLowerCase();
          if (email) {
            const date = new Date(c.sale_date);
            if (!emailContractDate.has(email) || date < emailContractDate.get(email)!) {
              emailContractDate.set(email, date);
            }
          }
        });

        // --- Part B: Count outsides by SALE DATE in period ---
        const { data: outsidePeriodContracts } = await supabase
          .from('hubla_transactions')
          .select('id, customer_email, sale_date')
          .in('product_category', ['contrato', 'incorporador'])
          .ilike('product_name', '%contrato%')
          .eq('sale_status', 'completed')
          .gte('sale_date', start)
          .lte('sale_date', end)
          .order('sale_date', { ascending: true });

        const periodContractByEmail = new Map<string, Date>();
        outsidePeriodContracts?.forEach(c => {
          // Skip recurring transactions — only first-purchase (Novo) counts
          if (!firstTransactionIds.has((c as any).id)) return;
          const email = c.customer_email?.trim().toLowerCase();
          if (email) {
            const date = new Date(c.sale_date);
            if (!periodContractByEmail.has(email) || date < periodContractByEmail.get(email)!) {
              periodContractByEmail.set(email, date);
            }
          }
        });

        const contractEmailsList = Array.from(periodContractByEmail.keys());

        const outsideContacts = contractEmailsList.length > 0
          ? await batchedIn<{ id: string; email: string }>(
              (chunk) => supabase.from('crm_contacts').select('id, email').in('email', chunk),
              contractEmailsList
            )
          : [];

        const outsideContactEmailMap = new Map<string, string>();
        outsideContacts.forEach(c => {
          const email = c.email?.trim().toLowerCase();
          if (email) outsideContactEmailMap.set(c.id, email);
        });

        const outsideDeals = outsideContacts.length > 0
          ? await batchedIn<{ id: string; contact_id: string }>(
              (chunk) => supabase.from('crm_deals').select('id, contact_id').in('contact_id', chunk),
              Array.from(outsideContactEmailMap.keys())
            )
          : [];

        const outsideDealToEmail = new Map<string, string>();
        outsideDeals.forEach(d => {
          const email = outsideContactEmailMap.get(d.contact_id);
          if (email) outsideDealToEmail.set(d.id, email);
        });

        const outsideDealIds = Array.from(outsideDealToEmail.keys());
        const outsideAttendees = outsideDealIds.length > 0
          ? await batchedIn<{ deal_id: string; is_partner: boolean; meeting_slot: { closer_id: string; scheduled_at: string } }>(
              (chunk) => supabase
                .from('meeting_slot_attendees')
                .select('deal_id, is_partner, meeting_slot:meeting_slots!inner(closer_id, scheduled_at, meeting_type, status)')
                .in('deal_id', chunk)
                .in('meeting_slot.meeting_type', ['r1', 'r2'])
                .neq('meeting_slot.status', 'cancelled')
                .neq('meeting_slot.status', 'canceled')
                .eq('is_partner', false),
              outsideDealIds
            )
          : [];

        const countedOutsideEmails = new Set<string>();
        // Para cada email, escolhe a reunião MAIS ANTIGA (R1 tem prioridade sobre R2
        // se ambas existirem, pois R1 vem primeiro no funil). Outside = contrato
        // pago ANTES dessa primeira reunião.
        const earliestByEmail = new Map<string, { scheduledAt: Date; closerId: string; meetingType: string }>();
        outsideAttendees.forEach(att => {
          const email = outsideDealToEmail.get(att.deal_id);
          if (!email) return;
          const meetingSlot = att.meeting_slot as any;
          const scheduledAt = new Date(meetingSlot.scheduled_at);
          const closerId = meetingSlot.closer_id;
          const meetingType = meetingSlot.meeting_type;
          if (!closerId) return;

          const current = earliestByEmail.get(email);
          if (!current) {
            earliestByEmail.set(email, { scheduledAt, closerId, meetingType });
            return;
          }
          // R1 sempre vence R2; entre iguais, a mais antiga vence.
          const currentIsR1 = current.meetingType === 'r1';
          const newIsR1 = meetingType === 'r1';
          if (newIsR1 && !currentIsR1) {
            earliestByEmail.set(email, { scheduledAt, closerId, meetingType });
          } else if (newIsR1 === currentIsR1 && scheduledAt < current.scheduledAt) {
            earliestByEmail.set(email, { scheduledAt, closerId, meetingType });
          }
        });

        earliestByEmail.forEach((info, email) => {
          if (countedOutsideEmails.has(email)) return;
          const contractDate = periodContractByEmail.get(email);
          if (!contractDate) return;
          // Only count as Outside when the email has an R1.
          // Leads that only have R2 (no R1) belong to the normal contract flow
          // and are already counted via meeting_slot_attendees.contract_paid_at —
          // treating them as "outside" here causes double counting in the KPI.
          if (info.meetingType !== 'r1') return;
          if (contractDate < info.scheduledAt) {
            outsideByCloser.set(info.closerId, (outsideByCloser.get(info.closerId) || 0) + 1);
            countedOutsideEmails.add(email);
          }
        });
      }

      // ========== MANUAL SALE ATTRIBUTIONS ==========
      const { data: manualSales } = await supabase
        .from('manual_sale_attributions' as any)
        .select('closer_id')
        .eq('business_unit', bu)
        .gte('contract_paid_at', start)
        .lte('contract_paid_at', end);

      const manualByCloser = new Map<string, number>();
      // Atribuições manuais não têm deal vinculado → ignoradas quando há filtro de segmento.
      (segmentActive ? [] : (manualSales as any[] || [])).forEach((sale: any) => {
        manualByCloser.set(sale.closer_id, (manualByCloser.get(sale.closer_id) || 0) + 1);
      });

      // ========== REFUNDS ==========
      // Fonte única: caucoes_efetivas().refunded_at (gravado pelos webhooks
      // MCF Pay e Hubla). Contabilizado acima, junto com os contratos líquidos.

      // Calculate metrics for each R1 closer
      const metricsMap = new Map<string, R1CloserMetric>();

      // Initialize all R1 closers with zeros
      r1Closers.forEach(closer => {
        metricsMap.set(closer.id, {
          closer_id: closer.id,
          closer_name: closer.name,
          closer_color: closer.color,
          r1_agendada: 0,
          agendamentos: agendamentosByCloser.get(closer.id) || 0,
          r1_realizada: 0,
          noshow: 0,
          // caucoes_efetivas já exclui reembolsados (refunded_at) → não subtrair de novo
          contrato_pago: (contractsByCloser.get(closer.id) || 0) + (manualByCloser.get(closer.id) || 0),
          outside: outsideByCloser.get(closer.id) || 0,
          r2_agendada: r2CountByCloser.get(closer.id) || 0,
          reembolsos: refundByCloser.get(closer.id) || 0,
          reembolsos_valor: refundValueByCloser.get(closer.id) || 0,
        });
      });

      // Also initialize INACTIVE closers that had any production in the period
      // (contracts, outside sales, R2s scheduled, or manual attributions).
      // This preserves history when a closer leaves the team.
      const closersWithProduction = new Set<string>([
        ...contractsByCloser.keys(),
        ...outsideByCloser.keys(),
        ...r2CountByCloser.keys(),
        ...manualByCloser.keys(),
        ...refundByCloser.keys(),
        ...agendamentosByCloser.keys(),
      ]);
      closersWithProduction.forEach(closerId => {
        if (metricsMap.has(closerId)) return;
        const closerInfo = closers?.find(c => c.id === closerId);
        if (!closerInfo) return; // closer is from another BU
        metricsMap.set(closerId, {
          closer_id: closerId,
          closer_name: closerInfo.name,
          closer_color: closerInfo.color || null,
          r1_agendada: 0,
          agendamentos: agendamentosByCloser.get(closerId) || 0,
          r1_realizada: 0,
          noshow: 0,
          contrato_pago: (contractsByCloser.get(closerId) || 0) + (manualByCloser.get(closerId) || 0),
          outside: outsideByCloser.get(closerId) || 0,
          r2_agendada: r2CountByCloser.get(closerId) || 0,
          reembolsos: refundByCloser.get(closerId) || 0,
          reembolsos_valor: refundValueByCloser.get(closerId) || 0,
        });
      });

      // ========== DEDUPLICATION: max 2x per deal_id ==========
      // Same-day reschedule = 1x, different days = max 2x
      // Realizada: 1x per deal if at least one attendee has final status
      const closerDealMap = new Map<string, Map<string, { days: Set<string>; realized: boolean; noshow: boolean }>>();

      meetings?.forEach(meeting => {
        const closerId = meeting.closer_id;
        if (!closerId) return;

        // Ensure metric exists
        let metric = metricsMap.get(closerId);
        if (!metric) {
          const closerInfo = closers?.find(c => c.id === closerId);
          if (!closerInfo) return;
          metric = {
            closer_id: closerId,
            closer_name: closerInfo.name,
            closer_color: closerInfo.color || null,
            r1_agendada: 0,
            agendamentos: agendamentosByCloser.get(closerId) || 0,
            r1_realizada: 0,
            noshow: 0,
            contrato_pago: (contractsByCloser.get(closerId) || 0) + (manualByCloser.get(closerId) || 0),
            outside: outsideByCloser.get(closerId) || 0,
            r2_agendada: r2CountByCloser.get(closerId) || 0,
            reembolsos: refundByCloser.get(closerId) || 0,
            reembolsos_valor: refundValueByCloser.get(closerId) || 0,
          };
          metricsMap.set(closerId, metric);
        }

        meeting.meeting_slot_attendees?.forEach(att => {
          if ((att as any).is_partner) return;
          if (!att.deal_id) return;
          const status = att.status;
          if (!allowedAgendadaStatuses.includes(status)) return;

          const day = format(new Date(meeting.scheduled_at), 'yyyy-MM-dd');

          if (!closerDealMap.has(closerId)) closerDealMap.set(closerId, new Map());
          const dealMap = closerDealMap.get(closerId)!;
          if (!dealMap.has(att.deal_id)) dealMap.set(att.deal_id, { days: new Set(), realized: false, noshow: false });
          const entry = dealMap.get(att.deal_id)!;
          entry.days.add(day);
          if (realizadaStatuses.includes(status)) entry.realized = true;
          if (status === 'no_show') entry.noshow = true;
        });
      });

      // Apply deduplicated metrics
      closerDealMap.forEach((dealMap, closerId) => {
        const metric = metricsMap.get(closerId);
        if (!metric) return;
        dealMap.forEach(({ days, realized, noshow }) => {
          metric.r1_agendada += days.size >= 2 ? 2 : 1;
          if (realized) metric.r1_realizada++;
          else if (noshow) metric.noshow++;
        });
      });

      // Convert to array and sort by r1_agendada desc
      // Períodos "ao vivo" (que incluem hoje) não devem exibir closers inativos,
      // mesmo que tenham tido produção recente antes de sair.
      const isLivePeriod = endOfDay(endDate).getTime() >= startOfDay(new Date()).getTime();
      const inactiveCloserIds = new Set(
        (closers || []).filter(c => c.is_active !== true).map(c => c.id)
      );

      return Array.from(metricsMap.values())
        .filter(m => !(isLivePeriod && inactiveCloserIds.has(m.closer_id)))
        .sort((a, b) => b.r1_agendada - a.r1_agendada);
    },
    staleTime: 30000,
  });
}
