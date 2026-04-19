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
  // Cohort cutoff metadata (from RPC)
  dentroCorte: boolean;
  effectiveContractDate: string | null;
  contractSource: 'r1' | 'r2' | 'hubla' | 'none' | null;
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
  if (r2AttendeeStatus === 'no_show') {
    return { situacao: 'no_show', label: '❌ No-show' };
  }
  if (r2StatusName && r2StatusName.toLowerCase().includes('desistente')) {
    return { situacao: 'desistente', label: '🚫 Desistente' };
  }
  if (r2AttendeeStatus === 'completed' || r2AttendeeStatus === 'contract_paid') {
    return { situacao: 'realizada', label: '✅ Realizada' };
  }
  if (r2AttendeeStatus === 'invited' || r2AttendeeStatus === 'scheduled') {
    if (r2Date) {
      const r2DateTime = new Date(r2Date);
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
    queryKey: ['contract-lifecycle-report', filters.startDate.toISOString(), filters.endDate.toISOString(), filters.closerR1Id, filters.situacao, filters.weekStart?.toISOString()],
    staleTime: 30000,
    queryFn: async () => {
      // ============================================================
      // STEP A: Fetch unified R2 data via RPC (canonical source)
      // ============================================================
      const weekStart = filters.weekStart || filters.startDate;
      const weekEnd = addDays(weekStart, 6);
      const boundaries = getCarrinhoMetricBoundaries(weekStart, weekEnd);
      const weekStartStr = format(weekStart, 'yyyy-MM-dd');

      const rpcPromise = supabase.rpc('get_carrinho_r2_attendees', {
        p_week_start: weekStartStr,
        p_window_start: boundaries.r2Meetings.start.toISOString(),
        p_window_end: boundaries.r2Meetings.end.toISOString(),
        p_apply_contract_cutoff: false,
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

      const [{ data: rpcData, error: rpcError }, { data: hublaTx, error: hublaError }] = await Promise.all([
        rpcPromise,
        hublaPromise,
      ]);

      if (rpcError) throw rpcError;
      if (hublaError) throw hublaError;

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
        const contractPaidAt = r2.r1_contract_paid_at || hublaInfo?.saleDate || r2.contract_paid_at || null;

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
          hasR2: !!r2.scheduled_at,
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
          pendingReason: null,
          futureR2Date: null,
          futureR2CloserName: null,
          dentroCorte: !!r2.dentro_corte,
          effectiveContractDate: r2.effective_contract_date || null,
          contractSource: (r2.contract_source as any) || null,
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

      for (const info of allHublaInfos) {
        const phoneKey = normalizePhoneSuffix9(info.phone);
        const emailKey = info.email;

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
          dentroCorte: false,
          effectiveContractDate: info.saleDate,
          contractSource: 'hubla',
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
          const dealToR2 = new Map<string, { date: string; closerName: string | null; isFuture: boolean }>();
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
              });
            }
          });

          // Map contact_id -> deals
          const { data: dealsWithContacts } = await supabase
            .from('crm_deals')
            .select('id, contact_id')
            .in('id', contactDealIds);

          const contactToBestR2 = new Map<string, { date: string; closerName: string | null; isFuture: boolean }>();
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

      const allRows = [...rpcRows, ...orphanRows];

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
