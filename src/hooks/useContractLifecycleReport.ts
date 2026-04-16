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
          sdrName: null, // Not provided by RPC; could be added later
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

        orphanRows.push({
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
        });
      }

      const allRows = [...rpcRows, ...orphanRows];

      // ============================================================
      // STEP F: Apply filters & sort
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
