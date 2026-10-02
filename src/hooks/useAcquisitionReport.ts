import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAllHublaTransactions, TransactionFilters, HublaTransaction } from './useAllHublaTransactions';
import { useTransactionsByBU } from './useTransactionsByBU';
import { getDeduplicatedGross } from '@/lib/incorporadorPricing';
import { DateRange } from 'react-day-picker';
import { BusinessUnit } from '@/hooks/useMyBU';
import { useAtribuicaoCloser } from './useAtribuicaoCloser';

// ---- helpers ----
const VALID_CHANNELS = new Set(['A010', 'LIVE', 'ANAMNESE', 'ANAMNESE-INSTA', 'OUTSIDE', 'LANÇAMENTO']);

function detectChannel(opts: {
  productName: string | null;
  saleOrigin: string | null;
  tags: string[];
  isOutside: boolean;
  productCategory: string | null;
}): string {
  const { productName, saleOrigin, tags, isOutside, productCategory } = opts;
  const pn = (productName || '').toLowerCase();
  const cat = (productCategory || '').toLowerCase();

  // 1. LANÇAMENTO
  if (saleOrigin === 'launch' || pn.includes('contrato mcf')) return 'LANÇAMENTO';

  // 2. A010
  if (cat === 'a010' || pn.includes('a010')) return 'A010';

  // 3. Tags-based (ANAMNESE-INSTA / ANAMNESE)
  const upperTags = tags.map(t => {
    if (typeof t === 'string') {
      if (t.startsWith('{')) {
        try { const p = JSON.parse(t); return (p?.name || t).toUpperCase(); } catch { return t.toUpperCase(); }
      }
      return t.toUpperCase();
    }
    return (t as any)?.name?.toUpperCase() || '';
  });
  if (upperTags.some(t => t.includes('ANAMNESE-INSTA') || t.includes('ANAMNESE INSTA'))) return 'ANAMNESE-INSTA';
  if (upperTags.some(t => t.includes('ANAMNESE'))) return 'ANAMNESE';

  // 4. OUTSIDE
  if (isOutside) return 'OUTSIDE';

  // 5. Fallback
  return 'LIVE';
}

const classifyOrigin = (tx: HublaTransaction): string => {
  if (tx.sale_origin === 'launch' || (tx.product_name || '').toLowerCase().includes('contrato mcf'))
    return 'Lançamento';
  const cat = (tx.product_category || '').toLowerCase();
  if (cat === 'a010') return 'A010';
  if (cat === 'renovacao') return 'Renovação';
  if (cat === 'ob_vitalicio') return 'Vitalício';
  if (cat === 'contrato') return 'Contrato';
  const pn = (tx.product_name || '').toLowerCase();
  if (pn.includes('a010')) return 'A010';
  if (pn.includes('bio') || pn.includes('instagram')) return 'Bio Instagram';
  if (pn.includes('live')) return 'Live';
  return 'Outros';
};

// Origins that are automatic (no R1 meeting expected)
const AUTOMATIC_ORIGINS = new Set(['Lançamento', 'A010', 'Renovação', 'Vitalício', 'Lucrômetro - Funil']);

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

interface CloserRecord {
  id: string;
  name: string;
  email: string;
  color: string | null;
  bu: string | null;
}

export function useAcquisitionReport(dateRange: DateRange | undefined, bu?: BusinessUnit) {
  const shouldUseBUFilter = bu && bu !== 'incorporador';

  // 1. Transactions
  const txFilters: TransactionFilters = useMemo(() => ({
    startDate: dateRange?.from,
    endDate: dateRange?.to,
  }), [dateRange]);
  const { data: allTransactions = [], isLoading: loadingAllTx } = useAllHublaTransactions(
    shouldUseBUFilter ? { search: '__SKIP__' } : txFilters
  );
  
  const buTxFilters: TransactionFilters = useMemo(() => ({
    startDate: dateRange?.from,
    endDate: dateRange?.to,
  }), [dateRange]);
  const { data: buTransactions = [], isLoading: loadingBUTx } = useTransactionsByBU(
    bu || '', buTxFilters
  );
  
  const transactions = shouldUseBUFilter ? buTransactions : allTransactions;
  const loadingTx = shouldUseBUFilter ? loadingBUTx : loadingAllTx;

  // 2. Closers — fetch directly filtered by BU
  const { data: closers = [], isLoading: loadingClosers } = useQuery<CloserRecord[]>({
    queryKey: ['acquisition-closers', bu],
    queryFn: async () => {
      let query = supabase
        .from('closers')
        .select('id, name, email, color, bu')
        .eq('is_active', true)
        .or('meeting_type.is.null,meeting_type.eq.r1');

      if (bu) {
        query = query.eq('bu', bu);
      }

      const { data, error } = await query.order('name');
      if (error) throw error;
      return (data || []) as CloserRecord[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // 2b. Valid SDRs for this BU
  const { data: buSdrs = [] } = useQuery<{ email: string; name: string }[]>({
    queryKey: ['acquisition-bu-sdrs', bu],
    queryFn: async () => {
      if (!bu) return [];
      const { data, error } = await supabase
        .from('sdr')
        .select('email, name')
        .eq('active', true)
        .eq('squad', bu)
        .eq('role_type', 'sdr');
      if (error) throw error;
      return (data || []).map((s: { email: string | null; name: string | null }) => ({
        email: (s.email || '').toLowerCase().trim(),
        name: s.name || 'Sem nome',
      }));
    },
    enabled: !!bu,
    staleTime: 5 * 60 * 1000,
  });

  // 2c. Map SDR emails to profile IDs and names
  const sdrEmails = useMemo(() => buSdrs.map(s => s.email), [buSdrs]);
  const sdrNameByEmail = useMemo(() => {
    const m = new Map<string, string>();
    buSdrs.forEach(s => m.set(s.email, s.name));
    return m;
  }, [buSdrs]);

  const { data: sdrProfileMap = new Map<string, string>() } = useQuery({
    queryKey: ['acquisition-sdr-profile-ids', sdrEmails],
    queryFn: async () => {
      if (sdrEmails.length === 0) return new Map<string, string>();
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email')
        .in('email', sdrEmails);
      if (error) throw error;
      const m = new Map<string, string>();
      (data || []).forEach((p: { id: string; email: string | null }) => {
        const email = (p.email || '').toLowerCase().trim();
        const name = sdrNameByEmail.get(email) || 'Sem nome';
        m.set(p.id, name);
      });
      return m;
    },
    enabled: sdrEmails.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const sdrProfileIds = useMemo(() => new Set(sdrProfileMap.keys()), [sdrProfileMap]);

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

  // 4. Atribuição de closer por venda (RPC atribuicao_closer_vendas)
  const txIds = useMemo(() => transactions.map(t => t.id), [transactions]);
  const { map: atribuicaoMap, isLoading: loadingAtribuicao } = useAtribuicaoCloser(txIds, bu);

  // 5. SDR names (profile full_name by user_id)
  const sdrIds = useMemo(() => {
    const ids = new Set<string>();
    atribuicaoMap.forEach(a => {
      if (a.sdr_profile_id) ids.add(a.sdr_profile_id);
    });
    return Array.from(ids);
  }, [atribuicaoMap]);

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

  // 8. Classify transactions
  const classified = useMemo(() => {
    return transactions.map(tx => {
      let origin = classifyOrigin(tx);
      const atr = atribuicaoMap.get(tx.id);

      // Launch override: if customer has R1 meeting (Inside Sales), don't treat as automatic
      if (origin === 'Lançamento' && atribuicaoMap.has(tx.id)) {
        origin = 'Outros'; // Reclassify so it flows through closer attribution
      }

      let isAutomatic = AUTOMATIC_ORIGINS.has(origin);
      const a = isAutomatic ? undefined : atr;

      // Lucrômetro sem closer → origem automática própria
      if (!a && !isAutomatic) {
        const pn = (tx.product_name || '').toLowerCase();
        if (pn.includes('lucrômetro') || pn.includes('lucrometro')) {
          origin = 'Lucrômetro - Funil';
          isAutomatic = true;
        }
      }

      const closerName = a?.closer_nome
        ? a.closer_nome
        : (isAutomatic ? origin : 'Sem Closer');
      const isOutside = a?.is_outside ?? false;
      const rawSdrId = a?.sdr_profile_id || null;
      const sdrId = rawSdrId && (!bu || sdrProfileIds.has(rawSdrId)) ? rawSdrId : null;
      const sdrName = sdrId
        ? (sdrProfileMap.get(sdrId) || sdrNameMap.get(sdrId) || 'SDR Desconhecido')
        : (isAutomatic ? origin : 'Sem SDR');
      const dealTags: string[] = a?.deal_tags ?? [];
      const channel = detectChannel({
        productName: tx.product_name,
        saleOrigin: tx.sale_origin,
        tags: dealTags,
        isOutside,
        productCategory: tx.product_category,
      });
      const isFirst = globalFirstIds.has(tx.id);
      const gross = shouldUseBUFilter ? (tx.product_price || tx.net_value || 0) : getDeduplicatedGross(tx, isFirst);
      const net = tx.net_value || 0;

      return { tx, closerName, sdrName, channel, origin, isOutside, gross, net };
    });
  }, [transactions, atribuicaoMap, sdrNameMap, sdrProfileMap, globalFirstIds, bu, sdrProfileIds, shouldUseBUFilter]);

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

    // Pre-populate sdrMap with all valid SDRs from the BU
    sdrProfileMap.forEach((name) => {
      if (!sdrMap.has(name)) {
        sdrMap.set(name, { txs: 0, gross: 0, net: 0, outsideCount: 0, outsideRev: 0 });
      }
    });

    let totalGross = 0;
    let totalNet = 0;

    classified.forEach(({ closerName, sdrName, channel, origin, isOutside, gross, net }) => {
      totalGross += gross;
      totalNet += net;
      // Only add non-automatic transactions to Closer and SDR tables
      if (!AUTOMATIC_ORIGINS.has(origin)) {
        addTo(closerMap, closerName, gross, net, isOutside);
        addTo(sdrMap, sdrName, gross, net, isOutside);
      }
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
  }, [classified, sdrProfileMap]);

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
    isLoading: loadingTx || loadingClosers || loadingAtribuicao,
  };
}
