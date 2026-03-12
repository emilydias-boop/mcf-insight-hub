import { useState, useMemo } from 'react';
import { CloserRevenueSummaryTable } from './CloserRevenueSummaryTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DatePickerCustom } from '@/components/ui/DatePickerCustom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileSpreadsheet, DollarSign, ShoppingCart, TrendingUp, Loader2, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X, Users, List } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { useAllHublaTransactions, TransactionFilters } from '@/hooks/useAllHublaTransactions';
import { useTransactionsByBU } from '@/hooks/useTransactionsByBU';
import { formatCurrency } from '@/lib/formatters';
import * as XLSX from 'xlsx';
import { BusinessUnit } from '@/hooks/useMyBU';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getDeduplicatedGross } from '@/lib/incorporadorPricing';
import { useAcquisitionReport } from '@/hooks/useAcquisitionReport';

interface SalesReportPanelProps {
  bu: BusinessUnit;
}

// Normaliza telefone para comparação
const normalizePhone = (phone: string | null | undefined): string => {
  return (phone || '').replace(/\D/g, '');
};

type DatePreset = 'today' | 'week' | 'month' | 'custom';
type ViewMode = 'transactions' | 'by_client';

interface ByClientRow {
  nome: string;
  email: string;
  telefone: string;
  totalTx: number;
  brutoA010: number;
  brutoContrato: number;
  brutoParceria: number;
  brutoOutros: number;
  brutoTotal: number;
  liquidoTotal: number;
  primeiraCompra: string | null;
  ultimaCompra: string | null;
  closerR1: string;
  closerR2: string;
  sdr: string;
  stageAtual: string | null;
}

export function SalesReportPanel({ bu }: SalesReportPanelProps) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [datePreset, setDatePreset] = useState<DatePreset>('month');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedChannel, setSelectedChannel] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [selectedCloserId, setSelectedCloserId] = useState<string>('all');
  const [selectedCloserR2Id, setSelectedCloserR2Id] = useState<string>('all');
  const [selectedSdr, setSelectedSdr] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<string>('all');
  const [selectedOriginId, setSelectedOriginId] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [viewMode, setViewMode] = useState<ViewMode>('transactions');
  
  const PAGE_SIZE_OPTIONS = [25, 50, 100];
  
  const filters: TransactionFilters = useMemo(() => ({
    startDate: dateRange?.from,
    endDate: dateRange?.to,
    search: undefined,
    selectedProducts: undefined,
  }), [dateRange]);
  
  const shouldUseBUFilter = bu && bu !== 'incorporador';
  
  const { data: allTransactions = [], isLoading: loadingAll } = useAllHublaTransactions(
    shouldUseBUFilter ? { search: '__SKIP__' } : filters
  );
  
  const buFilters: TransactionFilters = useMemo(() => ({
    search: filters.search,
    startDate: filters.startDate,
    endDate: filters.endDate,
  }), [filters]);
  
  const { data: buTransactions = [], isLoading: loadingBU } = useTransactionsByBU(
    bu || '', buFilters
  );
  
  const transactions = shouldUseBUFilter ? buTransactions : allTransactions;
  const isLoading = shouldUseBUFilter ? loadingBU : loadingAll;
  
  // Use useAcquisitionReport to get classified data (closerName, sdrName, origin, channel)
  const { classified: acquisitionClassified, closers, globalFirstIds } = useAcquisitionReport(dateRange, bu);

  // Build lookup: txId → classified info
  const classifiedByTxId = useMemo(() => {
    const m = new Map<string, { closerName: string; sdrName: string; origin: string; channel: string }>();
    acquisitionClassified.forEach(c => {
      m.set(c.tx.id, { closerName: c.closerName, sdrName: c.sdrName, origin: c.origin, channel: c.channel });
    });
    return m;
  }, [acquisitionClassified]);

  // R2 Closers query
  interface R2AttendeeMatch {
    deal_id: string | null;
    meeting_slots: { closer_id: string | null } | null;
    crm_deals: { crm_contacts: { email: string | null; phone: string | null } | null } | null;
  }

  const { data: r2Closers = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['r2-closers', bu],
    queryFn: async () => {
      let query = supabase
        .from('closers')
        .select('id, name')
        .eq('is_active', true)
        .eq('meeting_type', 'r2');
      if (bu) query = query.eq('bu', bu);
      const { data, error } = await query.order('name');
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const r2CloserNameMap = useMemo(() => {
    const m = new Map<string, string>();
    r2Closers.forEach(c => m.set(c.id, c.name));
    return m;
  }, [r2Closers]);

  const { data: r2Attendees = [] } = useQuery<R2AttendeeMatch[]>({
    queryKey: ['r2-attendees', dateRange?.from?.toISOString(), dateRange?.to?.toISOString(), bu],
    queryFn: async (): Promise<R2AttendeeMatch[]> => {
      if (!dateRange?.from) return [];
      const lookback = new Date(dateRange.from);
      lookback.setDate(lookback.getDate() - 30);
      const startDate = lookback.toISOString();
      const endDate = dateRange.to
        ? new Date(new Date(dateRange.to).setHours(23, 59, 59, 999)).toISOString()
        : new Date(new Date(dateRange.from).setHours(23, 59, 59, 999)).toISOString();
      
      const all: R2AttendeeMatch[] = [];
      let offset = 0;
      const pageSize = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from('meeting_slot_attendees')
          .select(`
            deal_id,
            meeting_slots!inner(closer_id),
            crm_deals!deal_id(crm_contacts!contact_id(email, phone))
          `)
          .eq('meeting_slots.meeting_type', 'r2')
          .gte('meeting_slots.scheduled_at', startDate)
          .lte('meeting_slots.scheduled_at', endDate)
          .range(offset, offset + pageSize - 1);
        if (error) throw error;
        const batch = (data || []) as unknown as R2AttendeeMatch[];
        all.push(...batch);
        hasMore = batch.length >= pageSize;
        offset += pageSize;
      }
      return all;
    },
    enabled: !!dateRange?.from,
  });

  // R2 closer lookup by email
  const r2CloserByEmail = useMemo(() => {
    const m = new Map<string, string>();
    r2Attendees.forEach(a => {
      const closerId = a.meeting_slots?.closer_id;
      const email = (a.crm_deals?.crm_contacts?.email || '').toLowerCase().trim();
      if (closerId && email) {
        const name = r2CloserNameMap.get(closerId);
        if (name) m.set(email, name);
      }
    });
    return m;
  }, [r2Attendees, r2CloserNameMap]);

  // Contract & Partnership dates query
  const { data: contractDates = new Map<string, string>() } = useQuery({
    queryKey: ['contract-dates', dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hubla_transactions')
        .select('customer_email, sale_date')
        .eq('product_category', 'contrato')
        .not('customer_email', 'is', null)
        .order('sale_date', { ascending: true });
      if (error) throw error;
      const m = new Map<string, string>();
      (data || []).forEach((r: { customer_email: string | null; sale_date: string }) => {
        const email = (r.customer_email || '').toLowerCase().trim();
        if (email && !m.has(email)) m.set(email, r.sale_date);
      });
      return m;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: partnershipDates = new Map<string, string>() } = useQuery({
    queryKey: ['partnership-dates', dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hubla_transactions')
        .select('customer_email, sale_date')
        .eq('product_category', 'parceria')
        .not('customer_email', 'is', null)
        .order('sale_date', { ascending: true });
      if (error) throw error;
      const m = new Map<string, string>();
      (data || []).forEach((r: { customer_email: string | null; sale_date: string }) => {
        const email = (r.customer_email || '').toLowerCase().trim();
        if (email && !m.has(email)) m.set(email, r.sale_date);
      });
      return m;
    },
    staleTime: 5 * 60 * 1000,
  });

  // A010 dates query — first purchase with product_category = 'a010'
  const { data: a010Dates = new Map<string, string>() } = useQuery({
    queryKey: ['a010-dates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hubla_transactions')
        .select('customer_email, sale_date')
        .eq('product_category', 'a010')
        .not('customer_email', 'is', null)
        .order('sale_date', { ascending: true });
      if (error) throw error;
      const m = new Map<string, string>();
      (data || []).forEach((r: { customer_email: string | null; sale_date: string }) => {
        const email = (r.customer_email || '').toLowerCase().trim();
        if (email && !m.has(email)) m.set(email, r.sale_date);
      });
      return m;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Stage atual por email — deal mais recente do CRM
  const { data: stageByEmail = new Map<string, { stageName: string; color: string }>() } = useQuery({
    queryKey: ['deal-stage-by-email'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_deals')
        .select('stage, updated_at, crm_contacts!contact_id(email)')
        .not('contact_id', 'is', null)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      const m = new Map<string, { stageName: string; color: string }>();
      (data || []).forEach((d: any) => {
        const email = (d.crm_contacts?.email || '').toLowerCase().trim();
        const stage = d.stage || '';
        if (email && stage && !m.has(email)) {
          m.set(email, { stageName: stage, color: '' });
        }
      });
      return m;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Set de IDs válidos de closers da BU para filtrar attendees
  const closerIdSet = useMemo(() => new Set(closers.map(c => c.id)), [closers]);

  // Interface para origins
  interface OriginOption {
    id: string;
    name: string;
    display_name: string | null;
  }

  // Pipelines (origins)
  const { data: origins = [] } = useQuery<OriginOption[]>({
    queryKey: ['crm-origins-simple'],
    queryFn: async (): Promise<OriginOption[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (supabase as any)
        .from('crm_origins')
        .select('id, name, display_name')
        .eq('is_active', true);
      if (result.error) throw result.error;
      const typedData = result.data as OriginOption[];
      return (typedData || []).sort((a, b) => 
        (a.display_name || a.name).localeCompare(b.display_name || b.name)
      );
    },
  });

  // Interface para attendees (kept for closer filter)
  interface AttendeeMatch {
    id: string;
    attendee_phone: string | null;
    deal_id: string | null;
    meeting_slots: { closer_id: string | null; scheduled_at: string | null } | null;
    crm_deals: { crm_contacts: { email: string | null; phone: string | null } | null } | null;
  }

  // Attendees for closer filter — same queryKey as useAcquisitionReport
  const { data: rawAttendees = [] } = useQuery<AttendeeMatch[]>({
    queryKey: ['attendees-acquisition-sdr', dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async (): Promise<AttendeeMatch[]> => {
      if (!dateRange?.from) return [];
      
      const lookbackDate = new Date(dateRange.from);
      lookbackDate.setDate(lookbackDate.getDate() - 30);
      const startDate = lookbackDate.toISOString();
      
      const endDate = dateRange.to 
        ? new Date(new Date(dateRange.to).setHours(23, 59, 59, 999)).toISOString()
        : new Date(new Date(dateRange.from).setHours(23, 59, 59, 999)).toISOString();
      
      const allAttendees: AttendeeMatch[] = [];
      let offset = 0;
      const pageSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const { data, error } = await supabase
          .from('meeting_slot_attendees')
          .select(`
            id, attendee_phone, deal_id,
            meeting_slots!inner(closer_id, scheduled_at),
            crm_deals!deal_id(crm_contacts!contact_id(email, phone))
          `)
          .eq('meeting_slots.meeting_type', 'r1')
          .gte('meeting_slots.scheduled_at', startDate)
          .lte('meeting_slots.scheduled_at', endDate)
          .range(offset, offset + pageSize - 1);
        
        if (error) throw error;
        const batch = (data || []) as unknown as AttendeeMatch[];
        allAttendees.push(...batch);
        
        if (batch.length < pageSize) {
          hasMore = false;
        } else {
          offset += pageSize;
        }
      }
      
      return allAttendees;
    },
    enabled: !!dateRange?.from,
  });

  // Filtrar attendees: apenas os cujo closer pertence à BU ativa
  const attendees = useMemo(() => {
    if (!bu || closerIdSet.size === 0) return rawAttendees;
    return rawAttendees.filter(a => {
      const closerId = a.meeting_slots?.closer_id;
      return closerId && closerIdSet.has(closerId);
    });
  }, [rawAttendees, bu, closerIdSet]);
  
  // Date preset handler
  const handleDatePreset = (preset: DatePreset) => {
    const now = new Date();
    setDatePreset(preset);
    if (preset === 'today') {
      setDateRange({ from: startOfDay(now), to: endOfDay(now) });
    } else if (preset === 'week') {
      setDateRange({ from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) });
    } else if (preset === 'month') {
      setDateRange({ from: startOfMonth(now), to: endOfMonth(now) });
    }
  };

  // Independent SDR query via CRM deals (fallback when no R1 attendee match)
  const { data: crmDealOwners = [] } = useQuery({
    queryKey: ['crm-deal-owners-by-email', bu],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_deals')
        .select('owner_profile_id, crm_contacts!contact_id(email), profiles!crm_deals_owner_profile_id_fkey(full_name)')
        .not('owner_profile_id', 'is', null)
        .not('contact_id', 'is', null);
      if (error) throw error;
      return (data || []) as unknown as Array<{
        owner_profile_id: string;
        crm_contacts: { email: string | null } | null;
        profiles: { full_name: string | null } | null;
      }>;
    },
    staleTime: 5 * 60 * 1000,
  });

  const sdrByEmail = useMemo(() => {
    const m = new Map<string, string>();
    crmDealOwners.forEach(d => {
      const email = (d.crm_contacts?.email || '').toLowerCase().trim();
      const name = d.profiles?.full_name;
      if (email && name) m.set(email, name);
    });
    return m;
  }, [crmDealOwners]);

  // Names that are origin labels, not real person names
  const AUTOMATIC_ORIGIN_NAMES = new Set(['A010', 'Lançamento', 'Renovação', 'Vitalício', 'Live', 'Bio Instagram', 'Outros', 'Contrato', 'Sem Closer', 'Sem SDR', 'Closer Desconhecido', 'SDR Desconhecido']);

  // Unique SDR names for filter dropdown
  const sdrOptions = useMemo(() => {
    const set = new Set<string>();
    acquisitionClassified.forEach(c => {
      if (c.sdrName && !AUTOMATIC_ORIGIN_NAMES.has(c.sdrName)) set.add(c.sdrName);
    });
    sdrByEmail.forEach(name => {
      if (name && !AUTOMATIC_ORIGIN_NAMES.has(name)) set.add(name);
    });
    return Array.from(set).sort();
  }, [acquisitionClassified, sdrByEmail]);

  // Unique product names for filter
  const productOptions = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach(t => {
      if (t.product_name) set.add(t.product_name);
    });
    return Array.from(set).sort();
  }, [transactions]);

  // Has active filters?
  const hasActiveFilters = searchTerm || selectedChannel !== 'all' || selectedSource !== 'all' ||
    selectedCloserId !== 'all' || selectedCloserR2Id !== 'all' || selectedSdr !== 'all' || selectedProduct !== 'all' || selectedOriginId !== 'all';

  const clearAllFilters = () => {
    setSearchTerm('');
    setSelectedChannel('all');
    setSelectedSource('all');
    setSelectedCloserId('all');
    setSelectedCloserR2Id('all');
    setSelectedSdr('all');
    setSelectedProduct('all');
    setSelectedOriginId('all');
  };

  // Dados filtrados
  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];
    
    // Filtro por fonte (Hubla/Make)
    if (selectedSource !== 'all') {
      filtered = filtered.filter(t => t.source === selectedSource);
    }
    
    // Filtro por pipeline (origin/categoria)
    if (selectedOriginId !== 'all') {
      filtered = filtered.filter(t => t.product_category === selectedOriginId);
    }
    
    // Filtro por canal
    if (selectedChannel !== 'all') {
      filtered = filtered.filter(t => {
        const info = classifiedByTxId.get(t.id);
        const channel = info?.channel || '';
        return channel === selectedChannel.toUpperCase();
      });
    }
    
    // Filtro por closer R1 (via matching com attendees)
    if (selectedCloserId !== 'all') {
      const closerAttendees = attendees.filter((a: any) => 
        a.meeting_slots?.closer_id === selectedCloserId
      );
      
      const closerEmails = new Set(
        closerAttendees
          .map((a: any) => a.crm_deals?.crm_contacts?.email?.toLowerCase())
          .filter(Boolean)
      );
      
      const closerPhones = new Set(
        closerAttendees
          .map((a: any) => normalizePhone(a.crm_deals?.crm_contacts?.phone))
          .filter((p: string) => p.length >= 8)
      );
      
      filtered = filtered.filter(t => {
        const txEmail = (t.customer_email || '').toLowerCase();
        const txPhone = normalizePhone(t.customer_phone);
        
        return closerEmails.has(txEmail) || 
               (txPhone.length >= 8 && closerPhones.has(txPhone));
      });
    }

    // Filtro por Closer R2
    if (selectedCloserR2Id !== 'all') {
      const r2Name = r2CloserNameMap.get(selectedCloserR2Id);
      if (r2Name) {
        filtered = filtered.filter(t => {
          const email = (t.customer_email || '').toLowerCase().trim();
          return r2CloserByEmail.get(email) === r2Name;
        });
      }
    }

    // Filtro por SDR
    if (selectedSdr !== 'all') {
      filtered = filtered.filter(t => {
        const info = classifiedByTxId.get(t.id);
        const email = (t.customer_email || '').toLowerCase().trim();
        const sdrName = (info?.sdrName && !new Set(['A010', 'Lançamento', 'Renovação', 'Vitalício', 'Live', 'Bio Instagram', 'Outros', 'Contrato', 'Sem Closer', 'Sem SDR', 'Closer Desconhecido', 'SDR Desconhecido']).has(info.sdrName))
          ? info.sdrName
          : (sdrByEmail.get(email) || '-');
        return sdrName === selectedSdr;
      });
    }
    
    // Filtro por produto
    if (selectedProduct !== 'all') {
      filtered = filtered.filter(t => t.product_name === selectedProduct);
    }

    // Filtro por busca textual
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      const termDigits = searchTerm.replace(/\D/g, '');
      
      filtered = filtered.filter(t => {
        const nameMatch = (t.customer_name || '').toLowerCase().includes(term);
        const emailMatch = (t.customer_email || '').toLowerCase().includes(term);
        const phoneMatch = termDigits.length >= 4 && 
          (t.customer_phone || '').replace(/\D/g, '').includes(termDigits);
        
        return nameMatch || emailMatch || phoneMatch;
      });
    }
    
    return filtered;
  }, [transactions, selectedChannel, selectedSource, selectedOriginId, selectedCloserId, selectedCloserR2Id, selectedSdr, selectedProduct, searchTerm, attendees, classifiedByTxId, r2CloserByEmail, r2CloserNameMap, sdrByEmail]);
  
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTransactions.slice(start, start + itemsPerPage);
  }, [filteredTransactions, currentPage, itemsPerPage]);
  
  // Reset página ao mudar filtros
  useMemo(() => {
    setCurrentPage(1);
  }, [selectedChannel, selectedSource, selectedOriginId, selectedCloserId, selectedCloserR2Id, selectedSdr, selectedProduct, searchTerm, dateRange]);
  
  const handlePageSizeChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };
  
  // Calculate stats from filtered data
  const stats = useMemo(() => {
    const totalGross = filteredTransactions.reduce((sum, t) => {
      if (shouldUseBUFilter) {
        return sum + (t.product_price || t.net_value || 0);
      }
      const isFirst = globalFirstIds.has(t.id);
      return sum + getDeduplicatedGross(t, isFirst);
    }, 0);
    const totalNet = filteredTransactions.reduce((sum, t) => sum + (t.net_value || 0), 0);
    const count = filteredTransactions.length;
    const avgTicket = count > 0 ? totalNet / count : 0;
    
    return { totalGross, totalNet, count, avgTicket };
  }, [filteredTransactions, globalFirstIds]);


  // Helper to get enriched data for a transaction
  const getEnrichedData = (row: any) => {
    const info = classifiedByTxId.get(row.id);
    const email = (row.customer_email || '').toLowerCase().trim();

    const closerR1 = info?.closerName && !AUTOMATIC_ORIGIN_NAMES.has(info.closerName)
      ? info.closerName : '-';
    const sdr = (info?.sdrName && !AUTOMATIC_ORIGIN_NAMES.has(info.sdrName))
      ? info.sdrName
      : (sdrByEmail.get(email) || '-');

    const stageInfo = stageByEmail.get(email);

    return {
      canal: info?.origin || '-',
      closerR1,
      closerR2: r2CloserByEmail.get(email) || '-',
      sdr,
      dtA010: a010Dates.get(email) || null,
      dtContrato: contractDates.get(email) || null,
      dtParceria: partnershipDates.get(email) || null,
      stageAtual: stageInfo?.stageName || null,
    };
  };
  
  // Aggregated by-client view
  const byClientRows = useMemo((): ByClientRow[] => {
    if (viewMode !== 'by_client') return [];
    const map = new Map<string, ByClientRow & { _txIds: string[] }>();

    filteredTransactions.forEach(tx => {
      const key = (tx.customer_email || '').toLowerCase().trim() || `name:${(tx.customer_name || '').toUpperCase().trim()}`;
      const enriched = getEnrichedData(tx);
      const grossVal = shouldUseBUFilter
        ? (tx.product_price || tx.net_value || 0)
        : getDeduplicatedGross(tx, globalFirstIds.has(tx.id));
      const category = (tx.product_category || '').toLowerCase();

      let existing = map.get(key);
      if (!existing) {
        existing = {
          nome: tx.customer_name || '-',
          email: tx.customer_email || '-',
          telefone: tx.customer_phone || '-',
          totalTx: 0,
          brutoA010: 0,
          brutoContrato: 0,
          brutoParceria: 0,
          brutoOutros: 0,
          brutoTotal: 0,
          liquidoTotal: 0,
          primeiraCompra: null,
          ultimaCompra: null,
          closerR1: '-',
          closerR2: '-',
          sdr: '-',
          stageAtual: null,
          _txIds: [],
        };
        map.set(key, existing);
      }

      existing.totalTx += 1;
      existing.liquidoTotal += (tx.net_value || 0);
      existing.brutoTotal += grossVal;

      if (category === 'a010') existing.brutoA010 += grossVal;
      else if (category === 'contrato') existing.brutoContrato += grossVal;
      else if (category === 'parceria') existing.brutoParceria += grossVal;
      else existing.brutoOutros += grossVal;

      // Dates
      if (tx.sale_date) {
        if (!existing.primeiraCompra || tx.sale_date < existing.primeiraCompra) existing.primeiraCompra = tx.sale_date;
        if (!existing.ultimaCompra || tx.sale_date > existing.ultimaCompra) existing.ultimaCompra = tx.sale_date;
      }

      // Enrichment: pick first non-dash values
      if (existing.closerR1 === '-' && enriched.closerR1 !== '-') existing.closerR1 = enriched.closerR1;
      if (existing.closerR2 === '-' && enriched.closerR2 !== '-') existing.closerR2 = enriched.closerR2;
      if (existing.sdr === '-' && enriched.sdr !== '-') existing.sdr = enriched.sdr;
      if (!existing.stageAtual && enriched.stageAtual) existing.stageAtual = enriched.stageAtual;
      if (existing.telefone === '-' && tx.customer_phone) existing.telefone = tx.customer_phone;
    });

    return Array.from(map.values())
      .sort((a, b) => b.brutoTotal - a.brutoTotal);
  }, [filteredTransactions, viewMode, globalFirstIds, shouldUseBUFilter]);

  // Pagination source based on view mode
  const paginationSource = viewMode === 'by_client' ? byClientRows : filteredTransactions;
  const totalPaginationItems = paginationSource.length;
  const totalPages = Math.ceil(totalPaginationItems / itemsPerPage);

  const paginatedByClient = useMemo(() => {
    if (viewMode !== 'by_client') return [];
    const start = (currentPage - 1) * itemsPerPage;
    return byClientRows.slice(start, start + itemsPerPage);
  }, [byClientRows, currentPage, itemsPerPage, viewMode]);

  // Export to Excel
  const handleExportExcel = () => {
    if (viewMode === 'by_client') {
      const exportData = byClientRows.map(row => ({
        'Cliente': row.nome,
        'Email': row.email,
        'Telefone': row.telefone,
        'SDR': row.sdr,
        'Closer R1': row.closerR1,
        'Closer R2': row.closerR2,
        'Qtd Tx': row.totalTx,
        'Bruto A010': row.brutoA010,
        'Bruto Contrato': row.brutoContrato,
        'Bruto Parceria': row.brutoParceria,
        'Bruto Outros': row.brutoOutros,
        'Bruto Total': row.brutoTotal,
        'Líquido Total': row.liquidoTotal,
        '1ª Compra': row.primeiraCompra ? format(parseISO(row.primeiraCompra), 'dd/MM/yyyy', { locale: ptBR }) : '',
        'Última Compra': row.ultimaCompra ? format(parseISO(row.ultimaCompra), 'dd/MM/yyyy', { locale: ptBR }) : '',
        'Stage Atual': row.stageAtual || '',
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Por Cliente');
      XLSX.writeFile(wb, `vendas_por_cliente_${bu}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      return;
    }

    const exportData = filteredTransactions.map(row => {
      const enriched = getEnrichedData(row);
      return {
        'Data Atualização': row.sale_date ? format(parseISO(row.sale_date), 'dd/MM/yyyy', { locale: ptBR }) : '',
        'Cliente': row.customer_name || '',
        'Produto': row.product_name || '',
        'Canal': enriched.canal,
        'SDR': enriched.sdr,
        'Closer R1': enriched.closerR1,
        'Closer R2': enriched.closerR2,
        'Dt A010': enriched.dtA010 ? format(parseISO(enriched.dtA010), 'dd/MM/yyyy', { locale: ptBR }) : '',
        'Dt Contrato': enriched.dtContrato ? format(parseISO(enriched.dtContrato), 'dd/MM/yyyy', { locale: ptBR }) : '',
        'Dt Parceria': enriched.dtParceria ? format(parseISO(enriched.dtParceria), 'dd/MM/yyyy', { locale: ptBR }) : '',
        'Bruto': shouldUseBUFilter ? (row.product_price || row.net_value || 0) : getDeduplicatedGross(row, globalFirstIds.has(row.id)),
        'Líquido': row.net_value || 0,
        'Parcela': row.installment_number ? `${row.installment_number}/${row.total_installments}` : '-',
        'Stage Atual': enriched.stageAtual || '',
        'Email': row.customer_email || '',
        'Telefone': row.customer_phone || '',
      };
    });
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vendas');
    
    const fileName = `vendas_${bu}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };
  
  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          {/* Row 1: Date presets + DatePicker + Search */}
          <div className="flex flex-wrap items-center gap-2">
            {(['today', 'week', 'month', 'custom'] as DatePreset[]).map(p => (
              <Button
                key={p}
                variant={datePreset === p ? 'default' : 'outline'}
                size="sm"
                className="h-8"
                onClick={() => {
                  if (p === 'custom') {
                    setDatePreset('custom');
                  } else {
                    handleDatePreset(p);
                  }
                }}
              >
                {p === 'today' ? 'Hoje' : p === 'week' ? 'Semana' : p === 'month' ? 'Mês' : 'Custom'}
              </Button>
            ))}

            <div className="min-w-[200px]">
              <DatePickerCustom
                mode="range"
                selected={dateRange}
                onSelect={(range) => {
                  if (range) {
                    setDateRange(range as DateRange);
                    setDatePreset('custom');
                  }
                }}
                placeholder="Selecione o período"
              />
            </div>

            <div className="relative flex-1 min-w-[200px] max-w-[300px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Nome, email ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>

          {/* Row 2: SDR, Closer R1, Closer R2, Canal, Pipeline, Fonte, Limpar, Excel */}
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedSdr} onValueChange={setSelectedSdr}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="SDR" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos SDRs</SelectItem>
                {sdrOptions.map(name => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedCloserId} onValueChange={setSelectedCloserId}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="Closer R1" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos R1</SelectItem>
                {closers.map(closer => (
                  <SelectItem key={closer.id} value={closer.id}>{closer.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedCloserR2Id} onValueChange={setSelectedCloserR2Id}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="Closer R2" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos R2</SelectItem>
                {r2Closers.map(closer => (
                  <SelectItem key={closer.id} value={closer.id}>{closer.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedProduct} onValueChange={setSelectedProduct}>
              <SelectTrigger className="w-[200px] h-9">
                <SelectValue placeholder="Produto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Produtos</SelectItem>
                {productOptions.map(name => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedChannel} onValueChange={setSelectedChannel}>
              <SelectTrigger className="w-[120px] h-9">
                <SelectValue placeholder="Canal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="a010">A010</SelectItem>
                <SelectItem value="bio">BIO</SelectItem>
                <SelectItem value="live">LIVE</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedOriginId} onValueChange={setSelectedOriginId}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="Pipeline" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {origins.map(origin => (
                  <SelectItem key={origin.id} value={origin.id}>
                    {origin.display_name || origin.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedSource} onValueChange={setSelectedSource}>
              <SelectTrigger className="w-[120px] h-9">
                <SelectValue placeholder="Fonte" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="hubla">Hubla</SelectItem>
                <SelectItem value="make">Make</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-9 px-2 text-muted-foreground">
                <X className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            )}

            <Button size="sm" className="h-9 ml-auto" onClick={handleExportExcel} disabled={filteredTransactions.length === 0}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <ShoppingCart className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Transações</p>
                <p className="text-3xl font-bold">{stats.count}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-success/10">
                <DollarSign className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Faturamento Bruto</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalGross)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-warning/10">
                <DollarSign className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Receita Líquida</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalNet)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-muted">
                <TrendingUp className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ticket Médio</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.avgTicket)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Revenue by Closer */}
      <CloserRevenueSummaryTable
        transactions={filteredTransactions as any}
        closers={closers}
        attendees={attendees as any}
        globalFirstIds={globalFirstIds}
        isLoading={isLoading}
        startDate={dateRange?.from}
        endDate={dateRange?.to}
        bu={bu}
      />
      
      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Transações no Período
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma transação encontrada no período selecionado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data Atualização</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>SDR</TableHead>
                    <TableHead>Closer R1</TableHead>
                    <TableHead>Closer R2</TableHead>
                    <TableHead>Dt A010</TableHead>
                    <TableHead>Dt Contrato</TableHead>
                    <TableHead>Dt Parceria</TableHead>
                    <TableHead className="text-right">Bruto</TableHead>
                    <TableHead className="text-right">Líquido</TableHead>
                    <TableHead>Parcela</TableHead>
                    <TableHead>Stage Atual</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {paginatedTransactions.map((row, index) => {
                    const enriched = getEnrichedData(row);
                    return (
                      <TableRow key={row.id || index}>
                        <TableCell className="whitespace-nowrap">
                          {row.sale_date 
                            ? format(parseISO(row.sale_date), 'dd/MM/yyyy', { locale: ptBR })
                            : '-'
                          }
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate">{row.customer_name || '-'}</TableCell>
                        <TableCell className="font-medium max-w-[180px] truncate">
                          {row.product_name || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="whitespace-nowrap">
                            {enriched.canal}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {enriched.sdr}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {enriched.closerR1}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {enriched.closerR2}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {enriched.dtA010 
                            ? format(parseISO(enriched.dtA010), 'dd/MM/yy', { locale: ptBR })
                            : '-'
                          }
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {enriched.dtContrato 
                            ? format(parseISO(enriched.dtContrato), 'dd/MM/yy', { locale: ptBR })
                            : '-'
                          }
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {enriched.dtParceria 
                            ? format(parseISO(enriched.dtParceria), 'dd/MM/yy', { locale: ptBR })
                            : '-'
                          }
                        </TableCell>
                        <TableCell className="text-right font-mono whitespace-nowrap">
                          {formatCurrency(row.gross_override || row.product_price || 0)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-success whitespace-nowrap">
                          {formatCurrency(row.net_value || 0)}
                        </TableCell>
                        <TableCell>
                          {row.installment_number 
                            ? `${row.installment_number}/${row.total_installments}`
                            : '-'
                          }
                        </TableCell>
                        <TableCell>
                          {enriched.stageAtual 
                            ? <Badge variant="outline">{enriched.stageAtual}</Badge>
                            : '-'
                          }
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {/* Controles de Paginação */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 border-t">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Mostrar</span>
                    <Select value={String(itemsPerPage)} onValueChange={handlePageSizeChange}>
                      <SelectTrigger className="w-[80px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAGE_SIZE_OPTIONS.map(size => (
                          <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Mostrando {Math.min((currentPage - 1) * itemsPerPage + 1, filteredTransactions.length)} a {Math.min(currentPage * itemsPerPage, filteredTransactions.length)} de {filteredTransactions.length} transações
                  </span>
                </div>
                
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="px-3 text-sm">
                    Página {currentPage} de {totalPages || 1}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage >= totalPages}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
