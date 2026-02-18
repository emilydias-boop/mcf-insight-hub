import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAllHublaTransactions, TransactionFilters, HublaTransaction } from './useAllHublaTransactions';
import { useGestorClosers } from './useGestorClosers';
import { getDeduplicatedGross } from '@/lib/incorporadorPricing';
import { DateRange } from 'react-day-picker';

// ---- helpers ----
const normalizePhone = (phone: string | null | undefined): string =>
  (phone || '').replace(/\D/g, '');

const detectChannel = (productName: string | null): string => {
  const n = (productName || '').toLowerCase();
  if (n.includes('a010')) return 'A010';
  if (n.includes('bio') || n.includes('instagram')) return 'BIO';
  return 'LIVE';
};

const classifyOrigin = (tx: HublaTransaction): string => {
  if (tx.sale_origin === 'launch' || (tx.product_name || '').toLowerCase().includes('contrato mcf'))
    return 'Lançamento';
  const cat = (tx.product_category || '').toLowerCase();
  if (cat === 'a010') return 'A010';
  if (cat === 'renovacao') return 'Renovação';
  if (cat === 'ob_vitalicio') return 'Vitalício';
  if (cat === 'contrato') return 'Contrato';
  // try product name fallback
  const pn = (tx.product_name || '').toLowerCase();
  if (pn.includes('a010')) return 'A010';
  if (pn.includes('bio') || pn.includes('instagram')) return 'Bio Instagram';
  if (pn.includes('live')) return 'Live';
  return 'Outros';
};

// ---- attendee type ----
interface AttendeeWithSDR {
  id: string;
  attendee_phone: string | null;
  deal_id: string | null;
  meeting_slots: { closer_id: string | null; scheduled_at: string | null } | null;
  crm_deals: {
    owner: string | null;
    crm_contacts: { email: string | null; phone: string | null } | null;
  } | null;
}

// ---- aggregation row ----
export interface DimensionRow {
  label: string;
  transactions: number;
  grossRevenue: number;
  netRevenue: number;
  avgTicket: number;
  pctTotal: number;
  outsideCount?: number;
  outsideRevenue?: number;
}

// ---- SDR name cache ----
interface ProfileName { id: string; full_name: string | null; }

export function useAcquisitionReport(dateRange: DateRange | undefined) {
  // 1. Transactions
  const txFilters: TransactionFilters = useMemo(() => ({
    startDate: dateRange?.from,
    endDate: dateRange?.to,
  }), [dateRange]);
  const { data: transactions = [], isLoading: loadingTx } = useAllHublaTransactions(txFilters);

  // 2. Closers
  const { data: closers = [], isLoading: loadingClosers } = useGestorClosers('r1');

  // 3. First transaction IDs (dedup)
  const { data: globalFirstIds = new Set<string>() } = useQuery({
    queryKey: ['global-first-transaction-ids'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_first_transaction_ids');
      if (error) throw error;
      return new Set((data || []).map((r: { id: string }) => r.id));
    },
    staleTime: 1000 * 60 * 5,
  });

  // 4. Attendees with SDR (owner)
  const { data: attendees = [], isLoading: loadingAtt } = useQuery<AttendeeWithSDR[]>({
    queryKey: ['attendees-acquisition-sdr', dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async (): Promise<AttendeeWithSDR[]> => {
      if (!dateRange?.from) return [];
      const lookback = new Date(dateRange.from);
      lookback.setDate(lookback.getDate() - 30);
      const startDate = lookback.toISOString();
      const endDate = dateRange.to
        ? new Date(new Date(dateRange.to).setHours(23, 59, 59, 999)).toISOString()
        : new Date(new Date(dateRange.from).setHours(23, 59, 59, 999)).toISOString();

      const all: AttendeeWithSDR[] = [];
      let offset = 0;
      const pageSize = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from('meeting_slot_attendees')
          .select(`
            id, attendee_phone, deal_id,
            meeting_slots!inner(closer_id, scheduled_at),
            crm_deals!deal_id(owner, crm_contacts!contact_id(email, phone))
          `)
          .eq('meeting_slots.meeting_type', 'r1')
          .gte('meeting_slots.scheduled_at', startDate)
          .lte('meeting_slots.scheduled_at', endDate)
          .range(offset, offset + pageSize - 1);
        if (error) throw error;
        const batch = (data || []) as unknown as AttendeeWithSDR[];
        all.push(...batch);
        hasMore = batch.length >= pageSize;
        offset += pageSize;
      }
      return all;
    },
    enabled: !!dateRange?.from,
  });

  // 5. SDR names (profile full_name by user_id)
  const sdrIds = useMemo(() => {
    const ids = new Set<string>();
    attendees.forEach(a => {
      if (a.crm_deals?.owner) ids.add(a.crm_deals.owner);
    });
    return Array.from(ids);
  }, [attendees]);

  const { data: sdrProfiles = [] } = useQuery<ProfileName[]>({
    queryKey: ['sdr-profile-names', sdrIds],
    queryFn: async () => {
      if (sdrIds.length === 0) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', sdrIds);
      if (error) throw error;
      return (data || []) as ProfileName[];
    },
    enabled: sdrIds.length > 0,
    staleTime: 1000 * 60 * 10,
  });

  const sdrNameMap = useMemo(() => {
    const m = new Map<string, string>();
    sdrProfiles.forEach(p => m.set(p.id, p.full_name || 'Sem nome'));
    return m;
  }, [sdrProfiles]);

  // 6. Build attendee lookup maps
  const { emailToAttendees, phoneToAttendees } = useMemo(() => {
    const emailMap = new Map<string, AttendeeWithSDR[]>();
    const phoneMap = new Map<string, AttendeeWithSDR[]>();
    attendees.forEach(a => {
      const email = (a.crm_deals?.crm_contacts?.email || '').toLowerCase().trim();
      if (email) {
        if (!emailMap.has(email)) emailMap.set(email, []);
        emailMap.get(email)!.push(a);
      }
      const phone = normalizePhone(a.crm_deals?.crm_contacts?.phone);
      if (phone.length >= 8) {
        if (!phoneMap.has(phone)) phoneMap.set(phone, []);
        phoneMap.get(phone)!.push(a);
      }
      // Also attendee_phone
      const aPhone = normalizePhone(a.attendee_phone);
      if (aPhone.length >= 8 && aPhone !== phone) {
        if (!phoneMap.has(aPhone)) phoneMap.set(aPhone, []);
        phoneMap.get(aPhone)!.push(a);
      }
    });
    return { emailToAttendees: emailMap, phoneToAttendees: phoneMap };
  }, [attendees]);

  // 7. Closer name map
  const closerNameMap = useMemo(() => {
    const m = new Map<string, string>();
    closers.forEach(c => m.set(c.id, c.name));
    return m;
  }, [closers]);

  // 8. Classify transactions
  const classified = useMemo(() => {
    return transactions.map(tx => {
      const txEmail = (tx.customer_email || '').toLowerCase().trim();
      const txPhone = normalizePhone(tx.customer_phone);

      // find matching attendee
      let matchedAttendee: AttendeeWithSDR | null = null;
      const emailMatches = emailToAttendees.get(txEmail);
      if (emailMatches?.length) matchedAttendee = emailMatches[0];
      if (!matchedAttendee && txPhone.length >= 8) {
        const phoneMatches = phoneToAttendees.get(txPhone);
        if (phoneMatches?.length) matchedAttendee = phoneMatches[0];
      }

      const closerId = matchedAttendee?.meeting_slots?.closer_id || null;
      const closerName = closerId ? (closerNameMap.get(closerId) || 'Closer Desconhecido') : 'Sem Closer';
      const scheduledAt = matchedAttendee?.meeting_slots?.scheduled_at || null;
      const isOutside = !!(scheduledAt && tx.sale_date && new Date(tx.sale_date) < new Date(scheduledAt));
      const sdrId = matchedAttendee?.crm_deals?.owner || null;
      const sdrName = sdrId ? (sdrNameMap.get(sdrId) || 'SDR Desconhecido') : 'Sem SDR';
      const channel = detectChannel(tx.product_name);
      const origin = classifyOrigin(tx);
      const isFirst = globalFirstIds.has(tx.id);
      const gross = getDeduplicatedGross(tx, isFirst);
      const net = tx.net_value || 0;

      return { tx, closerName, sdrName, channel, origin, isOutside, gross, net };
    });
  }, [transactions, emailToAttendees, phoneToAttendees, closerNameMap, sdrNameMap, globalFirstIds]);

  // 9. Aggregate helper
  const aggregate = (
    grouped: Map<string, { txs: number; gross: number; net: number; outsideCount: number; outsideRev: number }>,
    totalNet: number,
    includeOutside = false,
  ): DimensionRow[] => {
    return Array.from(grouped.entries())
      .map(([label, v]) => ({
        label,
        transactions: v.txs,
        grossRevenue: v.gross,
        netRevenue: v.net,
        avgTicket: v.txs > 0 ? v.net / v.txs : 0,
        pctTotal: totalNet > 0 ? (v.net / totalNet) * 100 : 0,
        ...(includeOutside ? { outsideCount: v.outsideCount, outsideRevenue: v.outsideRev } : {}),
      }))
      .sort((a, b) => b.netRevenue - a.netRevenue);
  };

  const addTo = (
    map: Map<string, { txs: number; gross: number; net: number; outsideCount: number; outsideRev: number }>,
    key: string,
    gross: number,
    net: number,
    isOutside: boolean,
  ) => {
    const cur = map.get(key) || { txs: 0, gross: 0, net: 0, outsideCount: 0, outsideRev: 0 };
    cur.txs += 1;
    cur.gross += gross;
    cur.net += net;
    if (isOutside) { cur.outsideCount += 1; cur.outsideRev += net; }
    map.set(key, cur);
  };

  // 10. Build dimension data
  const { kpis, byCloser, bySDR, byChannel, byOutside, byOrigin } = useMemo(() => {
    const closerMap = new Map<string, { txs: number; gross: number; net: number; outsideCount: number; outsideRev: number }>();
    const sdrMap = new Map<string, { txs: number; gross: number; net: number; outsideCount: number; outsideRev: number }>();
    const channelMap = new Map<string, { txs: number; gross: number; net: number; outsideCount: number; outsideRev: number }>();
    const originMap = new Map<string, { txs: number; gross: number; net: number; outsideCount: number; outsideRev: number }>();
    const outsideMap = new Map<string, { txs: number; gross: number; net: number; outsideCount: number; outsideRev: number }>();

    let totalGross = 0;
    let totalNet = 0;

    classified.forEach(({ closerName, sdrName, channel, origin, isOutside, gross, net }) => {
      totalGross += gross;
      totalNet += net;
      addTo(closerMap, closerName, gross, net, isOutside);
      addTo(sdrMap, sdrName, gross, net, isOutside);
      addTo(channelMap, channel, gross, net, isOutside);
      addTo(originMap, origin, gross, net, isOutside);
      if (isOutside) addTo(outsideMap, closerName, gross, net, true);
    });

    const count = classified.length;

    return {
      kpis: {
        totalTransactions: count,
        totalGross,
        totalNet,
        avgTicket: count > 0 ? totalNet / count : 0,
      },
      byCloser: aggregate(closerMap, totalNet, true),
      bySDR: aggregate(sdrMap, totalNet),
      byChannel: aggregate(channelMap, totalNet),
      byOutside: aggregate(outsideMap, totalNet).map(r => ({
        label: r.label,
        outsideCount: r.transactions,
        outsideRevenue: r.netRevenue,
      })),
      byOrigin: aggregate(originMap, totalNet),
    };
  }, [classified]);

  return {
    kpis,
    byCloser,
    bySDR,
    byChannel,
    byOutside,
    byOrigin,
    transactions,
    classified,
    closers,
    globalFirstIds,
    isLoading: loadingTx || loadingClosers || loadingAtt,
  };
}
