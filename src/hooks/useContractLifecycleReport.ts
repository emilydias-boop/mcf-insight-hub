import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, differenceInDays, addDays, format } from 'date-fns';
import { getCustomWeekEnd } from '@/lib/dateHelpers';
import { getCarrinhoMetricBoundaries } from '@/lib/carrinhoWeekBoundaries';

function normalizePhoneSuffix9(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  return digits.slice(-9);
}

function normalizeEmail(email: string | null | undefined): string {
  return (email || '').toLowerCase().trim();
}

export interface ContractLifecycleFilters {
  startDate: Date;
  endDate: Date;
  weekStart?: Date;
  mode?: 'safra' | 'custom';
  closerR1Id?: string;
  situacao?: string;
}

export type ContractSituacao = 'reembolso' | 'no_show' | 'desistente' | 'realizada' | 'proxima_semana' | 'agendado' | 'pre_agendado' | 'pendente';

// Motivo detalhado para órfãos pendentes
export type PendingReason =
  | 'r2_proxima_semana'      // R2 está marcado para semana futura
  | 'aguardando_r2'          // R1 ok + contrato pago, sem R2 ainda
  | 'r2_outro_deal'          // R2 existe mas em deal diferente do contrato
  | 'reembolso_recente'      // contrato antigo, reembolso na semana
  | 'outside_legitimo'       // sem R1 nem R2, compra direta
  | 'sem_sucesso'            // marcado manualmente como sem sucesso de contato
  | 'r2_sem_status'          // R2 marcado mas sem status atualizado pelo closer
  | null;

export interface ContractLifecycleRow {
  id: string;
  leadName: string | null;
  phone: string | null;
  contractPaidAt: string | null;
  dealId: string | null;
  r1Date: string | null;
  r1CloserName: string | null;
  r1Status: string | null;
  sdrName: string | null;
  hasR2: boolean;
  r2Date: string | null;
  r2CloserName: string | null;
  r2StatusName: string | null;
  r2StatusColor: string | null;
  r2AttendeeStatus: string | null;
  carrinhoStatus: string | null;
  carrinhoWeekStart: string | null;
  diasParado: number | null;
  situacao: ContractSituacao;
  situacaoLabel: string;
  isPaidContract: boolean;
  // Motivo detalhado (para Pendentes)
  pendingReason: PendingReason;
  // Data do R2 futuro (quando pendingReason = 'r2_proxima_semana')
  futureR2Date: string | null;
  futureR2CloserName: string | null;
  // attendee_id do R2 futuro (necessário para "Encaixar nesta semana")
  futureR2AttendeeId: string | null;
  // Cohort cutoff metadata (from RPC)
  dentroCorte: boolean;
  effectiveContractDate: string | null;
  contractSource: 'r1' | 'r2' | 'hubla' | 'none' | null;
  // Sem Sucesso metadata (quando pendingReason = 'sem_sucesso')
  semSucessoObservacao: string | null;
  semSucessoTentativas: number | null;
  // Pendência acumulada aberta, independente do filtro de data do relatório
  isBacklogPending?: boolean;
}

function getFridayCutoff(weekStart?: Date, horarioCorte?: string): Date {
  const [cutH, cutM] = (horarioCorte || '12:00').split(':').map(Number);
  if (weekStart) {
    const friday = addDays(new Date(weekStart), 8);
    friday.setHours(cutH, cutM || 0, 0, 0);
    return friday;
  }
  const now = new Date();
  const friday = getCustomWeekEnd(now);
  friday.setHours(cutH, cutM || 0, 0, 0);
  return friday;
}

function classifySituacao(
  r1Status: string | null,
  r2AttendeeStatus: string | null,
  r2StatusName: string | null,
  r2Date: string | null,
  fridayCutoff: Date,
  isHublaRefunded: boolean = false,
): { situacao: ContractSituacao; label: string } {
  if (r1Status === 'refunded' || isHublaRefunded) {
    return { situacao: 'reembolso', label: '💰 Reembolso' };
  }
  if (r2AttendeeStatus === 'refunded' || (r2StatusName || '').toLowerCase().includes('reembolso')) {
    return { situacao: 'reembolso', label: '💰 Reembolso' };
  }
  if (r2AttendeeStatus === 'no_show') {
    return { situacao: 'no_show', label: '❌ No-show' };
  }
  if (r2StatusName && r2StatusName.toLowerCase().includes('desistente')) {
    return { situacao: 'desistente', label: '🚫 Desistente' };
  }
  // Closer classificou como Aprovado via r2_status_options → reunião realizada
  if (r2StatusName && r2StatusName.toLowerCase().includes('aprovado')) {
    return { situacao: 'realizada', label: '✅ Realizada' };
  }
  if (r2AttendeeStatus === 'completed' || r2AttendeeStatus === 'contract_paid') {
    return { situacao: 'realizada', label: '✅ Realizada' };
  }
  if (r2AttendeeStatus === 'invited' || r2AttendeeStatus === 'scheduled') {
    if (r2Date) {
      const r2DateTime = new Date(r2Date);
      if (r2DateTime < new Date()) {
        return { situacao: 'pendente', label: '⏳ Pendente' };
      }
      if (r2DateTime >= fridayCutoff) {
        return { situacao: 'proxima_semana', label: '📅 Próxima Semana' };
      }
    }
    return { situacao: 'agendado', label: '✅ Agendado' };
  }
  if (r2AttendeeStatus === 'pre_scheduled') {
    return { situacao: 'pre_agendado', label: '🔜 Pré-agendado' };
  }
  return { situacao: 'pendente', label: '⏳ Pendente' };
}

export function useContractLifecycleReport(filters: ContractLifecycleFilters) {
  return useQuery({
    queryKey: ['contract-lifecycle-report', filters.startDate.toISOString(), filters.endDate.toISOString(), filters.mode || 'safra', filters.closerR1Id, filters.situacao, filters.weekStart?.toISOString()],
    staleTime: 30000,
    queryFn: async () => {
      // ============================================================
      // STEP A: Fetch unified R2 data via RPC (canonical source)
      // ============================================================
      const isCustomRange = filters.mode === 'custom';
      const weekStart = filters.weekStart || filters.startDate;
      const weekEnd = addDays(weekStart, 6);
      const boundaries = getCarrinhoMetricBoundaries(weekStart, weekEnd);
      const weekStartStr = isCustomRange ? '1900-01-01' : format(weekStart, 'yyyy-MM-dd');
      const r2WindowStart = isCustomRange ? startOfDay(filters.startDate) : boundaries.r2Meetings.start;
      const r2WindowEnd = isCustomRange ? endOfDay(filters.endDate) : boundaries.r2Meetings.end;

      const rpcPromise = supabase.rpc('get_carrinho_r2_attendees', {
        p_week_start: weekStartStr,
        p_window_start: r2WindowStart.toISOString(),
        p_window_end: r2WindowEnd.toISOString(),
        p_apply_contract_cutoff: !isCustomRange,
        p_previous_cutoff: isCustomRange ? r2WindowStart.toISOString() : boundaries.previousCutoff.toISOString(),
      });

      // ============================================================
      // STEP B: Fetch Hubla A000 contracts in parallel
      // ============================================================
      const contractBoundaryStart = startOfDay(filters.startDate).toISOString();
      const contractBoundaryEnd = endOfDay(filters.endDate).toISOString();

      const hublaPromise = supabase
        .from('hubla_transactions')
        .select('customer_email, customer_phone, customer_name, sale_date, hubla_id, source, product_name, installment_number, sale_status')
        .eq('product_name', 'A000 - Contrato')
        .in('sale_status', ['completed', 'refunded'])
        .in('source', ['hubla', 'manual', 'make', 'mcfpay', 'kiwify'])
        .gte('sale_date', contractBoundaryStart)
        .lte('sale_date', contractBoundaryEnd);

      // Fetch all sem_sucesso attendees (R1 meeting type) — global, used as fallback Motivo for orphans
      const semSucessoPromise = supabase
        .from('meeting_slot_attendees')
        .select(`
          id,
          attendee_name,
          attendee_phone,
          deal_id,
          contract_paid_at,
          r2_observations,
          created_at,
          meeting_slot:meeting_slots!inner(scheduled_at, meeting_type)
        `)
        .eq('status', 'sem_sucesso')
        .eq('meeting_slot.meeting_type', 'r1');

      // Fetch ALL paid R1 attendees globally — used to surface accumulated pendentes
      // (contract_paid sem R2 agendado/concluído), independente da semana filtrada
      const accumulatedPaidPromise = supabase
        .from('meeting_slot_attendees')
        .select(`
          id,
          attendee_name,
          attendee_phone,
          deal_id,
          contract_paid_at,
          status,
          meeting_slot:meeting_slots!inner(
            scheduled_at,
            meeting_type,
            closer:closers!meeting_slots_closer_id_fkey(name)
          )
        `)
        .eq('status', 'contract_paid')
        .eq('meeting_slot.meeting_type', 'r1')
        .not('contract_paid_at', 'is', null);

      const [
        { data: rpcData, error: rpcError },
        { data: hublaTx, error: hublaError },
        { data: semSucessoData, error: semSucessoError },
        { data: accumulatedPaidData, error: accumulatedPaidError },
      ] = await Promise.all([
        rpcPromise,
        hublaPromise,
        semSucessoPromise,
        accumulatedPaidPromise,
      ]);

      if (rpcError) throw rpcError;
      if (hublaError) throw hublaError;
      if (semSucessoError) throw semSucessoError;
      if (accumulatedPaidError) throw accumulatedPaidError;

      // Build sem_sucesso lookup by phone suffix (9 digits) and deal_id
      type SemSucessoInfo = {
        attendeeId: string;
        dealId: string | null;
        observacao: string;
        tentativas: number;
        contractPaidAt: string | null;
        attendeeName: string | null;
        attendeePhone: string | null;
      };
      const semSucessoByPhone = new Map<string, SemSucessoInfo>();
      const semSucessoByDeal = new Map<string, SemSucessoInfo>();
      const allSemSucesso: SemSucessoInfo[] = [];
      for (const att of (semSucessoData || []) as any[]) {
        let observacao = '';
        let tentativas = 0;
        try {
          const meta = JSON.parse(att.r2_observations || '{}');
          if (meta.sem_sucesso) {
            observacao = meta.observacao || '';
            tentativas = meta.tentativas || 0;
          }
        } catch { /* ignore */ }
        const slot = Array.isArray(att.meeting_slot) ? att.meeting_slot[0] : att.meeting_slot;
        const info: SemSucessoInfo = {
          attendeeId: att.id,
          dealId: att.deal_id || null,
          observacao,
          tentativas,
          contractPaidAt: att.contract_paid_at || slot?.scheduled_at || att.created_at || null,
          attendeeName: att.attendee_name || null,
          attendeePhone: att.attendee_phone || null,
        };
        allSemSucesso.push(info);
        const phoneKey = normalizePhoneSuffix9(att.attendee_phone);
        if (phoneKey.length >= 8 && !semSucessoByPhone.has(phoneKey)) {
          semSucessoByPhone.set(phoneKey, info);
        }
        if (info.dealId && !semSucessoByDeal.has(info.dealId)) {
          semSucessoByDeal.set(info.dealId, info);
        }
      }

      // ============================================================
      // STEP C: Build Hubla lookup maps (by phone & email)
      // ============================================================
      type HublaInfo = { saleDate: string; isRefunded: boolean; email: string; phone: string | null; name: string | null };
      const hublaByPhone = new Map<string, HublaInfo>();
      const hublaByEmail = new Map<string, HublaInfo>();
      const allHublaInfos: HublaInfo[] = [];

      for (const tx of (hublaTx || []) as any[]) {
        if (tx.hubla_id && String(tx.hubla_id).startsWith('newsale-')) continue;
        if (tx.source === 'make' && tx.product_name?.toLowerCase() === 'contrato') continue;
        if (tx.installment_number && tx.installment_number > 1) continue;

        const email = normalizeEmail(tx.customer_email);
        const phoneKey = normalizePhoneSuffix9(tx.customer_phone);
        const isRefunded = tx.sale_status === 'refunded';
        const info: HublaInfo = {
          saleDate: tx.sale_date,
          isRefunded,
          email,
          phone: tx.customer_phone || null,
          name: tx.customer_name || null,
        };
        allHublaInfos.push(info);

        if (email) {
          const existing = hublaByEmail.get(email);
          if (!existing) hublaByEmail.set(email, info);
          else if (isRefunded) existing.isRefunded = true;
        }
        if (phoneKey.length >= 8) {
          const existing = hublaByPhone.get(phoneKey);
          if (!existing) hublaByPhone.set(phoneKey, info);
          else if (isRefunded) existing.isRefunded = true;
        }
      }

      // Track which Hubla records were matched to RPC rows
      const matchedHublaEmails = new Set<string>();
      const matchedHublaPhones = new Set<string>();

      const now = new Date();
      const fridayCutoff = getFridayCutoff(filters.weekStart);

      // ============================================================
      // STEP D: Build rows from RPC (primary source) + merge Hubla by phone/email
      // ============================================================
      const rpcRows: ContractLifecycleRow[] = [];
      const phoneSeen = new Map<string, ContractLifecycleRow>();

      for (const r2 of (rpcData || []) as any[]) {
        const phoneKey = normalizePhoneSuffix9(r2.attendee_phone || r2.contact_phone);
        const emailKey = normalizeEmail(r2.contact_email);

        // Match Hubla contract by phone first, then email
        let hublaInfo: HublaInfo | undefined;
        if (phoneKey.length >= 8 && hublaByPhone.has(phoneKey)) {
          hublaInfo = hublaByPhone.get(phoneKey);
          matchedHublaPhones.add(phoneKey);
          if (hublaInfo?.email) matchedHublaEmails.add(hublaInfo.email);
        } else if (emailKey && hublaByEmail.has(emailKey)) {
          hublaInfo = hublaByEmail.get(emailKey);
          matchedHublaEmails.add(emailKey);
          const hp = normalizePhoneSuffix9(hublaInfo?.phone);
          if (hp.length >= 8) matchedHublaPhones.add(hp);
        }

        const isHublaRefunded = !!hublaInfo?.isRefunded;
        const contractPaidAt = r2.effective_contract_date || r2.r1_contract_paid_at || hublaInfo?.saleDate || r2.contract_paid_at || null;
        const contractInSelectedPeriod = !!contractPaidAt && new Date(contractPaidAt) >= new Date(contractBoundaryStart) && new Date(contractPaidAt) <= new Date(contractBoundaryEnd);
        const r2InSelectedPeriod = !!r2.scheduled_at && new Date(r2.scheduled_at) >= new Date(contractBoundaryStart) && new Date(r2.scheduled_at) <= new Date(contractBoundaryEnd);
        const includeCurrentRow = !isCustomRange || contractInSelectedPeriod || r2InSelectedPeriod || isHublaRefunded;
        if (!includeCurrentRow) continue;

        const r1Status: string | null = isHublaRefunded ? 'refunded' : null;
        const r2AttendeeStatus = r2.attendee_status as string | null;

        const { situacao, label: situacaoLabel } = classifySituacao(
          r1Status,
          r2AttendeeStatus,
          r2.r2_status_name || null,
          r2.scheduled_at || null,
          fridayCutoff,
          isHublaRefunded,
        );

        let diasParado: number | null = null;
        if (situacao === 'pendente' && contractPaidAt) {
          diasParado = differenceInDays(now, new Date(contractPaidAt));
        }

        const hasR2Date = !!r2.scheduled_at;
        const isR2Past = hasR2Date ? new Date(r2.scheduled_at) < fridayCutoff : false;
        const rpcPendingReason: PendingReason = situacao === 'pendente' && hasR2Date && isR2Past
          ? 'r2_sem_status'
          : null;

        const row: ContractLifecycleRow = {
          id: r2.attendee_id,
          leadName: r2.attendee_name || r2.contact_name || hublaInfo?.name || null,
          phone: r2.attendee_phone || r2.contact_phone || hublaInfo?.phone || null,
          contractPaidAt,
          dealId: r2.deal_id || null,
          r1Date: r2.r1_scheduled_at || null,
          r1CloserName: r2.r1_closer_name || null,
          r1Status,
          sdrName: null,
          hasR2: hasR2Date,
          r2Date: r2.scheduled_at || null,
          r2CloserName: r2.r2_closer_name || null,
          r2StatusName: r2.r2_status_name || null,
          r2StatusColor: r2.r2_status_color || null,
          r2AttendeeStatus,
          carrinhoStatus: r2.carrinho_status || null,
          carrinhoWeekStart: r2.carrinho_week_start || null,
          diasParado,
          situacao,
          situacaoLabel,
          isPaidContract: !!hublaInfo,
          pendingReason: rpcPendingReason,
          futureR2Date: null,
          futureR2CloserName: null,
          futureR2AttendeeId: null,
          dentroCorte: !!r2.dentro_corte,
          effectiveContractDate: r2.effective_contract_date || null,
          contractSource: (r2.contract_source as any) || null,
          semSucessoObservacao: null,
          semSucessoTentativas: null,
        };

        // Safety net dedup by phone (should be no-op since RPC dedupes)
        if (phoneKey.length >= 8) {
          if (phoneSeen.has(phoneKey)) continue;
          phoneSeen.set(phoneKey, row);
        }
        rpcRows.push(row);
      }

      // ============================================================
      // STEP E: Add orphan Hubla contracts (paid but no R2 in this week)
      // Preserves "Total Pagos" KPI
      // ============================================================
      const orphanRows: ContractLifecycleRow[] = [];
      const seenOrphanKeys = new Set<string>();
      const orphansByPhone = new Map<string, ContractLifecycleRow>();
      const orphansByEmail = new Map<string, ContractLifecycleRow>();
      const accumulatedPaidPhones = new Set(
        ((accumulatedPaidData || []) as any[])
          .map(att => normalizePhoneSuffix9(att.attendee_phone))
          .filter(pk => pk.length >= 8)
      );

      for (const info of allHublaInfos) {
        const phoneKey = normalizePhoneSuffix9(info.phone);
        const emailKey = info.email;
        if (phoneKey.length >= 8 && accumulatedPaidPhones.has(phoneKey)) continue;

        const matchedByPhone = phoneKey.length >= 8 && matchedHublaPhones.has(phoneKey);
        const matchedByEmail = emailKey && matchedHublaEmails.has(emailKey);
        if (matchedByPhone || matchedByEmail) continue;

        // Dedup orphans among themselves
        const dedupKey = phoneKey.length >= 8 ? `p:${phoneKey}` : `e:${emailKey}`;
        if (!dedupKey || seenOrphanKeys.has(dedupKey)) continue;
        seenOrphanKeys.add(dedupKey);

        const { situacao, label: situacaoLabel } = classifySituacao(
          info.isRefunded ? 'refunded' : null,
          null,
          null,
          null,
          fridayCutoff,
          info.isRefunded,
        );

        const orphan: ContractLifecycleRow = {
          id: `hubla-orphan-${emailKey || phoneKey}`,
          leadName: info.name,
          phone: info.phone,
          contractPaidAt: info.saleDate,
          dealId: null,
          r1Date: null,
          r1CloserName: null,
          r1Status: info.isRefunded ? 'refunded' : 'outside',
          sdrName: null,
          hasR2: false,
          r2Date: null,
          r2CloserName: null,
          r2StatusName: null,
          r2StatusColor: null,
          r2AttendeeStatus: null,
          carrinhoStatus: null,
          carrinhoWeekStart: null,
          diasParado: situacao === 'pendente' ? differenceInDays(now, new Date(info.saleDate)) : null,
          situacao,
          situacaoLabel,
          isPaidContract: true,
          pendingReason: null,
          futureR2Date: null,
          futureR2CloserName: null,
          futureR2AttendeeId: null,
          dentroCorte: false,
          effectiveContractDate: info.saleDate,
          contractSource: 'hubla',
          semSucessoObservacao: null,
          semSucessoTentativas: null,
          isBacklogPending: false,
        };
        orphanRows.push(orphan);
        if (phoneKey.length >= 8) orphansByPhone.set(phoneKey, orphan);
        if (emailKey) orphansByEmail.set(emailKey, orphan);
      }

      // ============================================================
      // STEP F: Enrich orphans with future R2s and R1 fallback
      // (Resolve Grupos A e B do diagnóstico)
      // ============================================================
      const orphansToEnrich = orphanRows.filter(o => o.situacao === 'pendente');

      if (orphansToEnrich.length > 0) {
        const orphanPhones = Array.from(new Set(
          orphansToEnrich
            .map(o => normalizePhoneSuffix9(o.phone))
            .filter(p => p.length >= 8)
        ));
        const orphanEmails = Array.from(new Set(
          orphansToEnrich
            .map(o => normalizeEmail(o.phone ? '' : '') || normalizeEmail((o as any).email))
            .filter(Boolean)
        ));

        // Step F.1: Buscar contatos pelos telefones para descobrir deal_ids
        let contactDealIds: string[] = [];
        const phoneToContactId = new Map<string, string>();
        if (orphanPhones.length > 0) {
          // Buscar contatos: phone pode ter formatos variados, então buscamos os com sufixo de 9 dígitos
          const phonePatterns = orphanPhones.map(p => `%${p}`);
          const { data: contacts } = await supabase
            .from('crm_contacts')
            .select('id, phone')
            .or(phonePatterns.map(p => `phone.ilike.${p}`).join(','));
          
          (contacts || []).forEach(c => {
            const ckey = normalizePhoneSuffix9(c.phone);
            if (ckey.length >= 8) phoneToContactId.set(ckey, c.id);
          });

          if (phoneToContactId.size > 0) {
            const { data: deals } = await supabase
              .from('crm_deals')
              .select('id, contact_id')
              .in('contact_id', Array.from(phoneToContactId.values()));
            contactDealIds = (deals || []).map(d => d.id);
          }
        }

        // Step F.2: Buscar TODOS os R2 (qualquer semana, futuro ou passado) desses deals
        // para identificar leads com R2 marcado para próxima semana
        if (contactDealIds.length > 0) {
          const { data: allR2s } = await supabase
            .from('meeting_slot_attendees')
            .select(`
              id,
              deal_id,
              status,
              attendee_phone,
              meeting_slot:meeting_slots!inner(
                id,
                scheduled_at,
                meeting_type,
                status,
                closer:closers!meeting_slots_closer_id_fkey(name)
              )
            `)
            .in('deal_id', contactDealIds)
            .eq('meeting_slot.meeting_type', 'r2')
            .neq('status', 'cancelled');

          // Map deal_id -> melhor R2 (futuro mais próximo, status válido)
          const dealToR2 = new Map<string, { date: string; closerName: string | null; isFuture: boolean; attendeeId: string }>();
          (allR2s || []).forEach((att: any) => {
            const slot = att.meeting_slot;
            if (!slot || slot.status === 'cancelled' || slot.status === 'rescheduled') return;
            if (att.status === 'cancelled' || att.status === 'refunded') return;
            const r2Date = slot.scheduled_at;
            if (!r2Date) return;
            const isFuture = new Date(r2Date) >= fridayCutoff;
            const existing = dealToR2.get(att.deal_id);
            // Priorizar R2 futuro mais próximo
            if (!existing || (isFuture && !existing.isFuture) ||
                (isFuture === existing.isFuture && new Date(r2Date) < new Date(existing.date))) {
              dealToR2.set(att.deal_id, {
                date: r2Date,
                closerName: slot.closer?.name || null,
                isFuture,
                attendeeId: att.id,
              });
            }
          });

          // Map contact_id -> deals
          const { data: dealsWithContacts } = await supabase
            .from('crm_deals')
            .select('id, contact_id')
            .in('id', contactDealIds);

          const contactToBestR2 = new Map<string, { date: string; closerName: string | null; isFuture: boolean; attendeeId: string }>();
          (dealsWithContacts || []).forEach(d => {
            if (!d.contact_id) return;
            const r2 = dealToR2.get(d.id);
            if (!r2) return;
            const existing = contactToBestR2.get(d.contact_id);
            if (!existing || (r2.isFuture && !existing.isFuture) ||
                (r2.isFuture === existing.isFuture && new Date(r2.date) < new Date(existing.date))) {
              contactToBestR2.set(d.contact_id, r2);
            }
          });

          // Aplicar R2 futuro nos órfãos
          orphansToEnrich.forEach(orphan => {
            const phoneKey = normalizePhoneSuffix9(orphan.phone);
            if (phoneKey.length < 8) return;
            const contactId = phoneToContactId.get(phoneKey);
            if (!contactId) return;
            const bestR2 = contactToBestR2.get(contactId);
            if (!bestR2) return;
            if (bestR2.isFuture) {
              orphan.pendingReason = 'r2_proxima_semana';
              orphan.futureR2Date = bestR2.date;
              orphan.futureR2CloserName = bestR2.closerName;
              orphan.futureR2AttendeeId = bestR2.attendeeId;
            }
          });
        }

        // Step F.3: Buscar R1 para órfãos sem R2 futuro encontrado
        if (contactDealIds.length > 0) {
          const { data: r1Attendees } = await supabase
            .from('meeting_slot_attendees')
            .select(`
              deal_id,
              status,
              meeting_slot:meeting_slots!inner(
                scheduled_at,
                meeting_type,
                closer:closers!meeting_slots_closer_id_fkey(name)
              )
            `)
            .in('deal_id', contactDealIds)
            .eq('meeting_slot.meeting_type', 'r1')
            .neq('status', 'cancelled')
            .order('created_at', { ascending: false });

          // Map deal_id -> R1 mais recente
          const dealToR1 = new Map<string, { date: string; closerName: string | null }>();
          (r1Attendees || []).forEach((att: any) => {
            if (dealToR1.has(att.deal_id)) return;
            const slot = att.meeting_slot;
            if (!slot?.scheduled_at) return;
            dealToR1.set(att.deal_id, {
              date: slot.scheduled_at,
              closerName: slot.closer?.name || null,
            });
          });

          // Map contact_id -> R1 (via deals)
          const { data: dealsForR1 } = await supabase
            .from('crm_deals')
            .select('id, contact_id')
            .in('id', contactDealIds);

          const contactToR1 = new Map<string, { date: string; closerName: string | null }>();
          (dealsForR1 || []).forEach(d => {
            if (!d.contact_id) return;
            const r1 = dealToR1.get(d.id);
            if (!r1) return;
            const existing = contactToR1.get(d.contact_id);
            if (!existing || new Date(r1.date) > new Date(existing.date)) {
              contactToR1.set(d.contact_id, r1);
            }
          });

          // Aplicar R1 nos órfãos
          orphansToEnrich.forEach(orphan => {
            const phoneKey = normalizePhoneSuffix9(orphan.phone);
            if (phoneKey.length < 8) return;
            const contactId = phoneToContactId.get(phoneKey);
            if (!contactId) return;
            const r1 = contactToR1.get(contactId);
            if (r1) {
              orphan.r1Date = r1.date;
              orphan.r1CloserName = r1.closerName;
              if (orphan.r1Status === 'outside') orphan.r1Status = 'realizada';
              // Se ainda não tem reason e tem R1 mas sem R2 futuro, é "aguardando R2"
              if (!orphan.pendingReason) {
                orphan.pendingReason = 'aguardando_r2';
              }
            } else if (!orphan.pendingReason) {
              orphan.pendingReason = 'outside_legitimo';
            }
          });
        }

        // Step F.4: Marcar reembolso recente para órfãos que estão como reembolso
        orphanRows.forEach(orphan => {
          if (orphan.situacao === 'reembolso' && orphan.contractPaidAt) {
            const paidDate = new Date(orphan.contractPaidAt);
            // Se o pagamento foi há mais de 14 dias mas o reembolso é desta semana
            if (differenceInDays(now, paidDate) > 14) {
              orphan.pendingReason = 'reembolso_recente';
            }
          }
        });
      }

      // ============================================================
      // STEP F.5: Aplicar metadata de Sem Sucesso em rows pendentes
      // (match por deal_id ou phone). Tem prioridade sobre 'aguardando_r2'
      // mas NÃO sobre 'r2_proxima_semana' (já tem ação concreta marcada).
      // ============================================================
      const matchedSemSucessoIds = new Set<string>();
      const applySemSucesso = (row: ContractLifecycleRow) => {
        if (row.situacao !== 'pendente') return;
        let info: SemSucessoInfo | undefined;
        if (row.dealId) info = semSucessoByDeal.get(row.dealId);
        if (!info) {
          const pk = normalizePhoneSuffix9(row.phone);
          if (pk.length >= 8) info = semSucessoByPhone.get(pk);
        }
        if (!info) return;
        if (row.pendingReason !== 'r2_proxima_semana') {
          row.pendingReason = 'sem_sucesso';
        }
        row.semSucessoObservacao = info.observacao || null;
        row.semSucessoTentativas = info.tentativas || null;
        matchedSemSucessoIds.add(info.attendeeId);
      };
      rpcRows.forEach(applySemSucesso);
      orphanRows.forEach(applySemSucesso);

      // STEP F.6: Injetar TODOS os "Sem Sucesso" não casados como rows pendentes
      // (sempre visíveis, independente da semana selecionada — são pendência aberta)
      const semSucessoRows: ContractLifecycleRow[] = [];
      // Buscar R1 (data + closer) por deal_id para enriquecer os Sem Sucesso
      const semSucessoDealIds = Array.from(new Set(
        allSemSucesso
          .filter(i => !matchedSemSucessoIds.has(i.attendeeId) && i.dealId)
          .map(i => i.dealId as string)
      ));
      const semSucessoR1ByDeal = new Map<string, { date: string | null; closerName: string | null }>();
      if (semSucessoDealIds.length > 0) {
        const chunks: string[][] = [];
        for (let i = 0; i < semSucessoDealIds.length; i += 200) chunks.push(semSucessoDealIds.slice(i, i + 200));
        for (const ch of chunks) {
          const { data: r1List } = await supabase
            .from('meeting_slot_attendees')
            .select(`
              deal_id,
              meeting_slot:meeting_slots!inner(
                scheduled_at,
                meeting_type,
                closer:closers!meeting_slots_closer_id_fkey(name)
              )
            `)
            .in('deal_id', ch)
            .eq('meeting_slot.meeting_type', 'r1')
            .neq('status', 'cancelled')
            .order('created_at', { ascending: false });
          (r1List || []).forEach((att: any) => {
            if (!att.deal_id || semSucessoR1ByDeal.has(att.deal_id)) return;
            const slot = Array.isArray(att.meeting_slot) ? att.meeting_slot[0] : att.meeting_slot;
            if (!slot?.scheduled_at) return;
            semSucessoR1ByDeal.set(att.deal_id, {
              date: slot.scheduled_at,
              closerName: slot.closer?.name || null,
            });
          });
        }
      }
      for (const info of allSemSucesso) {
        if (matchedSemSucessoIds.has(info.attendeeId)) continue;
        const diasParado = info.contractPaidAt
          ? differenceInDays(now, new Date(info.contractPaidAt))
          : null;
        const r1 = info.dealId ? semSucessoR1ByDeal.get(info.dealId) : undefined;
        semSucessoRows.push({
          id: `sem-sucesso-${info.attendeeId}`,
          leadName: info.attendeeName,
          phone: info.attendeePhone,
          contractPaidAt: info.contractPaidAt,
          dealId: info.dealId,
          r1Date: r1?.date || info.contractPaidAt || null,
          r1CloserName: r1?.closerName || null,
          r1Status: null,
          sdrName: null,
          hasR2: false,
          r2Date: null,
          r2CloserName: null,
          r2StatusName: null,
          r2StatusColor: null,
          r2AttendeeStatus: 'sem_sucesso',
          carrinhoStatus: null,
          carrinhoWeekStart: null,
          diasParado,
          situacao: 'pendente',
          situacaoLabel: '⏳ Pendente',
          isPaidContract: true,
          pendingReason: 'sem_sucesso',
          futureR2Date: null,
          futureR2CloserName: null,
          futureR2AttendeeId: null,
          dentroCorte: false,
          effectiveContractDate: info.contractPaidAt,
          contractSource: 'r1',
          semSucessoObservacao: info.observacao || null,
          semSucessoTentativas: info.tentativas || null,
          isBacklogPending: true,
        });
      }

      const allRows = [...rpcRows, ...orphanRows, ...semSucessoRows];

      // ============================================================
      // STEP F.7: Injetar contratos pagos acumulados como pendentes.
      // Para cada paid R1 não casado, verificar se existe R2 vinculado ao deal:
      //   - SEM R2 algum            → 'aguardando_r2'
      //   - COM R2 sem status final → 'r2_sem_status' (R2 marcado mas closer não atualizou)
      //   - COM R2 com status final → ignorar (já é realizada/no-show/reembolso/etc)
      // ============================================================
      const seenDealIds = new Set<string>();
      const seenPhoneKeys = new Set<string>();
      const seenAttendeeIds = new Set<string>();
      for (const r of allRows) {
        if (r.dealId) seenDealIds.add(r.dealId);
        const pk = normalizePhoneSuffix9(r.phone);
        if (pk.length >= 8) seenPhoneKeys.add(pk);
        if (r.id && !r.id.startsWith('hubla-orphan-') && !r.id.startsWith('sem-sucesso-')) {
          seenAttendeeIds.add(r.id);
        }
      }

      // Pré-filtra candidatos não-duplicados
      const candidates: any[] = [];
      const candidateDealIds: string[] = [];
      const candidatePhoneSuffixes: string[] = [];
      for (const att of (accumulatedPaidData || []) as any[]) {
        if (seenAttendeeIds.has(att.id)) continue;
        if (att.deal_id && seenDealIds.has(att.deal_id)) continue;
        const pk = normalizePhoneSuffix9(att.attendee_phone);
        if (pk.length >= 8 && seenPhoneKeys.has(pk)) continue;
        candidates.push(att);
        if (att.deal_id) candidateDealIds.push(att.deal_id);
        if (pk.length >= 8) candidatePhoneSuffixes.push(pk);
      }

      // Buscar R2s existentes desses deals para classificar corretamente
      type R2Info = { date: string | null; closerName: string | null; status: string | null; r2StatusId: string | null; r2StatusName: string | null; r2StatusColor: string | null; isFuture: boolean; attendeeId: string };
      const r2StatusIds = new Set<string>();
      const statusOptionById = new Map<string, { name: string | null; color: string | null }>();
      const dealToR2Info = new Map<string, R2Info>();
      const phoneToR2Info = new Map<string, R2Info>();
      if (candidateDealIds.length > 0) {
        // chunk para evitar URL muito longa
        const chunks: string[][] = [];
        for (let i = 0; i < candidateDealIds.length; i += 200) chunks.push(candidateDealIds.slice(i, i + 200));
        for (const ch of chunks) {
          const { data: r2List } = await supabase
            .from('meeting_slot_attendees')
            .select(`
              id, deal_id, status, r2_status_id,
              meeting_slot:meeting_slots!inner(
                scheduled_at, meeting_type, status,
                closer:closers!meeting_slots_closer_id_fkey(name)
              )
            `)
            .in('deal_id', ch)
            .eq('meeting_slot.meeting_type', 'r2');
          (r2List || []).forEach((att: any) => {
            const slot = att.meeting_slot;
            if (!slot) return;
            if (att.r2_status_id) r2StatusIds.add(att.r2_status_id);
            const date = slot.scheduled_at || null;
            const isFuture = date ? new Date(date) >= fridayCutoff : false;
            const info: R2Info = {
              date,
              closerName: slot.closer?.name || null,
              status: att.status || null,
              r2StatusId: att.r2_status_id || null,
              r2StatusName: null,
              r2StatusColor: null,
              isFuture,
              attendeeId: att.id,
            };
            const existing = dealToR2Info.get(att.deal_id);
            // Priorizar: status final > futuro mais próximo > mais recente
            if (!existing) {
              dealToR2Info.set(att.deal_id, info);
            } else if (date && existing.date && new Date(date) > new Date(existing.date)) {
              dealToR2Info.set(att.deal_id, info);
            }
          });
        }
        if (r2StatusIds.size > 0) {
          const { data: statusOptions } = await supabase
            .from('r2_status_options')
            .select('id, name, color')
            .in('id', Array.from(r2StatusIds));
          (statusOptions || []).forEach((s: any) => {
            statusOptionById.set(s.id, { name: s.name || null, color: s.color || null });
          });
          for (const [dealId, info] of dealToR2Info.entries()) {
            const status = info.r2StatusId ? statusOptionById.get(info.r2StatusId) : null;
            dealToR2Info.set(dealId, {
              ...info,
              r2StatusName: status?.name || null,
              r2StatusColor: status?.color || null,
            });
          }
        }
      }

      // ================================================================
      // Fallback: buscar R2s por TELEFONE (suffix-9), pois muitos R2s
      // foram criados em deal_id diferente do R1 pago. Sem isso, leads
      // com R2 "Aprovado/completed" caem como pendentes incorretamente.
      // ================================================================
      if (candidatePhoneSuffixes.length > 0) {
        const uniqSfx = Array.from(new Set(candidatePhoneSuffixes));
        // Buscamos atendentes R2 com telefone preenchido; matching por suffix-9 em JS
        // para evitar dependência de RPC. Limitamos a janela temporal recente.
        const sinceIso = new Date(Date.now() - 1000 * 60 * 60 * 24 * 365).toISOString();
        const { data: r2ByPhoneList } = await supabase
          .from('meeting_slot_attendees')
          .select(`
            id, deal_id, status, r2_status_id, attendee_phone,
            meeting_slot:meeting_slots!inner(
              scheduled_at, meeting_type, status,
              closer:closers!meeting_slots_closer_id_fkey(name)
            )
          `)
          .eq('meeting_slot.meeting_type', 'r2')
          .gte('meeting_slot.scheduled_at', sinceIso)
          .not('attendee_phone', 'is', null);

        const sfxSet = new Set(uniqSfx);
        const newStatusIds = new Set<string>();
        (r2ByPhoneList || []).forEach((att: any) => {
          const slot = att.meeting_slot;
          if (!slot) return;
          const sfx = normalizePhoneSuffix9(att.attendee_phone);
          if (sfx.length < 8 || !sfxSet.has(sfx)) return;
          const date = slot.scheduled_at || null;
          const isFuture = date ? new Date(date) >= fridayCutoff : false;
          const info: R2Info = {
            date,
            closerName: slot.closer?.name || null,
            status: att.status || null,
            r2StatusId: att.r2_status_id || null,
            r2StatusName: null,
            r2StatusColor: null,
            isFuture,
            attendeeId: att.id,
          };
          if (att.r2_status_id && !statusOptionById.has(att.r2_status_id)) {
            newStatusIds.add(att.r2_status_id);
          }
          // Priorizar status final > mais recente
          const existing = phoneToR2Info.get(sfx);
          const isFinalNow = info.status && ['completed','contract_paid','no_show','refunded','cancelled'].includes(info.status);
          const isFinalExisting = existing?.status && ['completed','contract_paid','no_show','refunded','cancelled'].includes(existing.status);
          if (!existing) {
            phoneToR2Info.set(sfx, info);
          } else if (isFinalNow && !isFinalExisting) {
            phoneToR2Info.set(sfx, info);
          } else if (date && existing.date && new Date(date) > new Date(existing.date) && (isFinalNow || !isFinalExisting)) {
            phoneToR2Info.set(sfx, info);
          }
        });
        if (newStatusIds.size > 0) {
          const { data: extraStatusOptions } = await supabase
            .from('r2_status_options')
            .select('id, name, color')
            .in('id', Array.from(newStatusIds));
          (extraStatusOptions || []).forEach((s: any) => {
            statusOptionById.set(s.id, { name: s.name || null, color: s.color || null });
          });
        }
        for (const [sfx, info] of phoneToR2Info.entries()) {
          const status = info.r2StatusId ? statusOptionById.get(info.r2StatusId) : null;
          phoneToR2Info.set(sfx, {
            ...info,
            r2StatusName: status?.name || null,
            r2StatusColor: status?.color || null,
          });
        }
      }

      const FINAL_STATUSES = new Set(['completed', 'contract_paid', 'no_show', 'refunded', 'cancelled']);
      // Nomes de r2_status_options que indicam classificação final do closer
      // (não devem aparecer como "R2 sem status" — closer JÁ classificou)
      const FINAL_R2_STATUS_NAME_KEYWORDS = ['aprovado', 'reembolso', 'desistente', 'realizada', 'no-show', 'no show', 'noshow', 'cancelado', 'reagendado'];
      const isFinalR2StatusName = (name: string | null | undefined) => {
        if (!name) return false;
        const n = name.toLowerCase();
        return FINAL_R2_STATUS_NAME_KEYWORDS.some(k => n.includes(k));
      };

      const accumulatedRows: ContractLifecycleRow[] = [];
      for (const att of candidates) {
        const slot = Array.isArray(att.meeting_slot) ? att.meeting_slot[0] : att.meeting_slot;
        const contractPaidAt = att.contract_paid_at || slot?.scheduled_at || null;
        const diasParado = contractPaidAt ? differenceInDays(now, new Date(contractPaidAt)) : null;
        const sfx = normalizePhoneSuffix9(att.attendee_phone);
        const r2Info = (att.deal_id ? dealToR2Info.get(att.deal_id) : undefined)
          || (sfx.length >= 8 ? phoneToR2Info.get(sfx) : undefined);

        let pendingReason: PendingReason = 'aguardando_r2';
        let r2Date: string | null = null;
        let r2CloserName: string | null = null;
        let r2StatusName: string | null = null;
        let r2StatusColor: string | null = null;
        let r2AttendeeStatus: string | null = null;
        let hasR2 = false;
        let futureR2Date: string | null = null;
        let futureR2CloserName: string | null = null;
        let futureR2AttendeeId: string | null = null;

        if (r2Info) {
          // Status final → não é pendente, ignorar
          if (r2Info.status && FINAL_STATUSES.has(r2Info.status)) continue;
          // Closer já classificou via r2_status_options (Aprovado, Reembolso, etc.) → ignorar
          if (isFinalR2StatusName(r2Info.r2StatusName)) continue;
          hasR2 = true;
          r2Date = r2Info.date;
          r2CloserName = r2Info.closerName;
          r2StatusName = r2Info.r2StatusName;
          r2StatusColor = r2Info.r2StatusColor;
          r2AttendeeStatus = r2Info.status;
          // R2 ainda não aconteceu (futuro em relação a AGORA) → não é pendente,
          // está apenas agendado/próxima safra. Não deve aparecer em Pendentes.
          const r2DateTime = r2Info.date ? new Date(r2Info.date) : null;
          const isStillUpcoming = r2DateTime ? r2DateTime > now : false;
          if (isStillUpcoming) continue;
          if (r2Info.isFuture) {
            pendingReason = 'r2_proxima_semana';
            futureR2Date = r2Info.date;
            futureR2CloserName = r2Info.closerName;
            futureR2AttendeeId = r2Info.attendeeId;
          } else {
            // R2 já passou mas sem status final → closer não atualizou
            pendingReason = 'r2_sem_status';
          }
        }

        accumulatedRows.push({
          id: `acc-pendente-${att.id}`,
          leadName: att.attendee_name || null,
          phone: att.attendee_phone || null,
          contractPaidAt,
          dealId: att.deal_id || null,
          r1Date: slot?.scheduled_at || null,
          r1CloserName: slot?.closer?.name || null,
          r1Status: 'contract_paid',
          sdrName: null,
          hasR2,
          r2Date,
          r2CloserName,
          r2StatusName,
          r2StatusColor,
          r2AttendeeStatus,
          carrinhoStatus: null,
          carrinhoWeekStart: null,
          diasParado,
          situacao: 'pendente',
          situacaoLabel: '⏳ Pendente',
          isPaidContract: true,
          pendingReason,
          futureR2Date,
          futureR2CloserName,
          futureR2AttendeeId,
          dentroCorte: false,
          effectiveContractDate: contractPaidAt,
          contractSource: 'r1',
          semSucessoObservacao: null,
          semSucessoTentativas: null,
          isBacklogPending: true,
        });
        if (att.deal_id) seenDealIds.add(att.deal_id);
        const pk2 = normalizePhoneSuffix9(att.attendee_phone);
        if (pk2.length >= 8) seenPhoneKeys.add(pk2);
        seenAttendeeIds.add(att.id);
      }

      allRows.push(...accumulatedRows);

      // ============================================================
      // STEP G: Apply filters & sort
      // ============================================================
      let filtered = allRows;
      if (filters.situacao && filters.situacao !== 'all') {
        filtered = allRows.filter(r => r.situacao === filters.situacao);
      }

      filtered.sort((a, b) => {
        const da = a.contractPaidAt ? new Date(a.contractPaidAt).getTime() : 0;
        const db = b.contractPaidAt ? new Date(b.contractPaidAt).getTime() : 0;
        return db - da;
      });

      return filtered;
    },
  });
}

export function useR1ClosersForReport() {
  return useQuery({
    queryKey: ['r1-closers-for-lifecycle-report'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('closers')
        .select('id, name')
        .eq('is_active', true)
        .eq('meeting_type', 'r1')
        .order('name');

      if (error) throw error;
      return data || [];
    },
  });
}
