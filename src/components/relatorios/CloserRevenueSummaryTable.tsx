import { useState, useMemo } from 'react';
import { calcTicketParceria, TICKET_PARCERIA_TOOLTIP, type TicketParceria, type VendaTicket } from '@/lib/ticketParceria';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronDown, Users, Info } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCanalEntrada, useCanaisEntradaLista } from '@/hooks/useCanalEntrada';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/formatters';
import { getDeduplicatedGross, normalizeProductKey } from '@/lib/incorporadorPricing';
import { CloserRevenueDetailDialog } from './CloserRevenueDetailDialog';
import { useAtribuicaoCloser } from '@/hooks/useAtribuicaoCloser';
import { usePagamentosDaVenda, calcRecebimento } from '@/hooks/usePagamentosDaVenda';
import { useDonosDasVendas } from '@/hooks/useDonosDasVendas';

interface Closer {
  id: string;
  name: string;
}

interface AttendeeMatch {
  id: string;
  attendee_phone: string | null;
  deal_id: string | null;
  meeting_slots: { closer_id: string | null; scheduled_at: string | null } | null;
  crm_deals: { crm_contacts: { email: string | null; phone: string | null } | null } | null;
}

interface Transaction {
  id: string;
  customer_email: string | null;
  customer_phone: string | null;
  product_name: string | null;
  product_category: string | null;
  product_price: number | null;
  net_value: number | null;
  sale_date: string | null;
  sale_status: string | null;
  installment_number: number | null;
  gross_override?: number | null;
  reference_price?: number | null;
  sale_origin?: string | null;
}

interface CloserRevenueSummaryTableProps {
  transactions: Transaction[];
  closers: Closer[];
  attendees: AttendeeMatch[];
  globalFirstIds: Set<string>;
  isLoading?: boolean;
  startDate?: Date;
  endDate?: Date;
  bu?: string;
}

// Categorias permitidas da BU Incorporador (allowlist — nível de módulo)
export const ALLOWED_INCORPORADOR_CATEGORIES = new Set([
  'contrato',
  'incorporador',
  'parceria',
  'a010',
  'renovacao',
  'ob_vitalicio',
  'contrato-anticrise',
  'p2',
  'recorrencia',
]);

export type ModoAgrupamento = 'closer' | 'sdr' | 'canal';
const MODO_KEY = 'closer-revenue-agrupar-por';
const MODO_TITULO: Record<ModoAgrupamento, string> = {
  closer: 'Faturamento por Closer',
  sdr: 'Faturamento por SDR',
  canal: 'Faturamento por Canal de Entrada',
};
const CANAL_DIRETO = 'Direto (sem entrada)';
const MOSTRAR_SEM_VENDA_KEY = 'canal-mostrar-sem-venda';

/** P2 (A005) não é venda nova: continuação da parceria. Fica só no detalhe. */
export const isP2 = (tx: { product_name?: string | null; product_category?: string | null }) =>
  (tx.product_name || '').trim().toUpperCase().startsWith('A005') || tx.product_category === 'p2';

export const vendaKey = (
  tx: { id?: string; customer_email?: string | null; customer_name?: string | null; product_name?: string | null },
  donoMap?: Map<string, string>,
) => {
  const dono = tx.id ? donoMap?.get(tx.id) : undefined;
  const email = (tx.customer_email || '').toLowerCase().replace(/\s+/g, '');
  const quem = dono || email || (tx.customer_name || '').toLowerCase().trim();
  return `${quem}|${normalizeProductKey(tx.product_name || null)}`;
};

interface CloserRow {
  id: string;
  name: string;
  count: number;
  gross: number;
  net: number;
  outsideCount: number;
  outsideGross: number;
  aReceber?: number;
  outraBu?: boolean;
  vendas?: number;
  p2Count?: number;
  vendasComBruto?: number;
  outsideVendas?: number;
  ticketParceria?: TicketParceria;
}

export function CloserRevenueSummaryTable({
  transactions,
  closers,
  attendees,
  globalFirstIds,
  isLoading,
  startDate,
  endDate,
  bu,
}: CloserRevenueSummaryTableProps) {
  const [selectedCloser, setSelectedCloser] = useState<{ id: string; name: string } | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [modo, setModoState] = useState<ModoAgrupamento>(() => {
    try {
      const v = localStorage.getItem(MODO_KEY);
      if (v === 'closer' || v === 'sdr' || v === 'canal') return v;
    } catch { /* ignore */ }
    return 'closer';
  });
  const setModo = (v: ModoAgrupamento) => {
    setModoState(v);
    setSelectedCloser(null);
    try { localStorage.setItem(MODO_KEY, v); } catch { /* ignore */ }
  };
  const [mostrarSemVenda, setMostrarSemVendaState] = useState<boolean>(() => {
    try {
      if (localStorage.getItem(MOSTRAR_SEM_VENDA_KEY) === 'false') return false;
    } catch { /* ignore */ }
    return true;
  });
  const setMostrarSemVenda = (v: boolean) => {
    setMostrarSemVendaState(v);
    try { localStorage.setItem(MOSTRAR_SEM_VENDA_KEY, String(v)); } catch { /* ignore */ }
  };

  // Filtrar apenas transações que pertencem à BU Incorporador (allowlist)
  const filteredTxs = useMemo(() => (
    bu === 'incorporador'
      ? transactions.filter(tx => {
          const cat = tx.product_category || '';
          return ALLOWED_INCORPORADOR_CATEGORIES.has(cat) || cat === '';
        })
      : transactions
  ), [transactions, bu]);
  const filteredIds = useMemo(() => filteredTxs.map(t => t.id), [filteredTxs]);
  const { map: atribuicaoMap, isLoading: loadingAtribuicao } = useAtribuicaoCloser(filteredIds, bu);
  const pagamentoIds = useMemo(
    () => filteredTxs.filter(tx => getDeduplicatedGross(tx as any, globalFirstIds.has(tx.id)) > 0).map(tx => tx.id),
    [filteredTxs, globalFirstIds],
  );
  const { map: pagamentosMap } = usePagamentosDaVenda(pagamentoIds);
  const { map: canalMap, isLoading: loadingCanal } = useCanalEntrada(filteredIds, modo === 'canal');
  const { map: donoMap, isLoading: loadingDonos } = useDonosDasVendas(filteredIds);
  const { data: canaisLista, isLoading: loadingLista } = useCanaisEntradaLista();

  const sdrIds = useMemo(() => {
    if (modo !== 'sdr') return [] as string[];
    const set = new Set<string>();
    atribuicaoMap.forEach((a) => { if (a.sdr_profile_id) set.add(a.sdr_profile_id); });
    return Array.from(set).sort();
  }, [atribuicaoMap, modo]);
  const { data: sdrNames, isLoading: loadingSdrNames } = useQuery({
    queryKey: ['closer-revenue-sdr-names', sdrIds.join(',')],
    enabled: sdrIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, full_name').in('id', sdrIds);
      if (error) throw error;
      return new Map((data || []).map((p: any) => [p.id as string, (p.full_name as string) || 'SDR sem nome']));
    },
  });

  const { summaryData, closerTransactionsMap } = useMemo(() => {
    // Venda = cliente + produto normalizado (pagamentos repetidos viram 1 venda). Só contagem.
    const vendasPorLinha = new Map<string, Map<string, number>>();
    const outsidePorLinha = new Map<string, Set<string>>();
    const vendasTotal = new Map<string, number>();
    const outsideTotal = new Set<string>();
    // Vendas consolidadas p/ ticket de parceria (mesmo conjunto da coluna Vendas)
    const ticketPorLinha = new Map<string, Map<string, VendaTicket>>();
    const ticketTotal = new Map<string, VendaTicket>();
    const addTicket = (m: Map<string, VendaTicket>, k: string, tx: Transaction, gross: number) => {
      const v = m.get(k) || { productName: tx.product_name, bruto: 0, liquido: 0, refunded: false };
      v.bruto += gross; v.liquido += tx.net_value || 0;
      if (tx.sale_status === 'refunded') v.refunded = true;
      m.set(k, v);
    };
    let p2Pagamentos = 0;
    let p2Liquido = 0;
    const track = (rowId: string, tx: Transaction, gross: number, outside = false) => {
      if (isP2(tx)) return;
      const k = vendaKey(tx, donoMap);
      if (outside) {
        const s = outsidePorLinha.get(rowId) || new Set<string>();
        s.add(k); outsidePorLinha.set(rowId, s); outsideTotal.add(k);
        return;
      }
      const m = vendasPorLinha.get(rowId) || new Map<string, number>();
      m.set(k, (m.get(k) || 0) + gross); vendasPorLinha.set(rowId, m);
      vendasTotal.set(k, (vendasTotal.get(k) || 0) + gross);
      const tm = ticketPorLinha.get(rowId) || new Map<string, VendaTicket>();
      addTicket(tm, k, tx, gross); ticketPorLinha.set(rowId, tm);
      addTicket(ticketTotal, `${rowId}::${k}`, tx, gross);
    };
    const finalize = (rows: CloserRow[]) => {
      for (const row of rows) {
        const m = vendasPorLinha.get(row.id);
        row.vendas = m ? m.size : 0;
        row.vendasComBruto = m ? Array.from(m.values()).filter((g) => g > 0).length : 0;
        row.outsideVendas = outsidePorLinha.get(row.id)?.size || 0;
        row.ticketParceria = calcTicketParceria(Array.from(ticketPorLinha.get(row.id)?.values() || []));
      }
      return {
        totalVendas: vendasTotal.size,
        totalVendasComBruto: Array.from(vendasTotal.values()).filter((g) => g > 0).length,
        totalOutsideVendas: outsideTotal.size,
        totalTicketParceria: calcTicketParceria(
          Array.from(ticketTotal.entries())
            .filter(([k]) => rows.some((r) => k.startsWith(`${r.id}::`)))
            .map(([, v]) => v),
        ),
      };
    };
    const closerTotals = new Map<string, CloserRow>();
    const txMap = new Map<string, Transaction[]>();
    let unassigned: CloserRow = { id: '__unassigned__', name: 'Sem closer', count: 0, gross: 0, net: 0, outsideCount: 0, outsideGross: 0 };
    const unassignedTxs: Transaction[] = [];
    let launch: CloserRow = { id: '__launch__', name: 'Lançamento', count: 0, gross: 0, net: 0, outsideCount: 0, outsideGross: 0 };
    const launchTxs: Transaction[] = [];
    let lucrometro: CloserRow = { id: '__lucrometro__', name: 'Lucrômetro - Funil', count: 0, gross: 0, net: 0, outsideCount: 0, outsideGross: 0 };
    const lucrometroTxs: Transaction[] = [];
    let a010: CloserRow = { id: '__a010__', name: 'A010 - Funil', count: 0, gross: 0, net: 0, outsideCount: 0, outsideGross: 0 };
    const a010Txs: Transaction[] = [];
    let renovacao: CloserRow = { id: '__renovacao__', name: 'Renovação', count: 0, gross: 0, net: 0, outsideCount: 0, outsideGross: 0 };
    const renovacaoTxs: Transaction[] = [];
    let vitalicio: CloserRow = { id: '__vitalicio__', name: 'Vitalício', count: 0, gross: 0, net: 0, outsideCount: 0, outsideGross: 0 };
    const vitalicioTxs: Transaction[] = [];
    
    // Modo Canal: todas as transações filtradas, sem baldes automáticos e sem outside
    if (modo === 'canal') {
      const canalTotals = new Map<string, CloserRow>();
      for (const tx of filteredTxs) {
        const p2 = isP2(tx);
        if (p2) { p2Pagamentos++; p2Liquido += tx.net_value || 0; }
        const gross = p2 ? 0 : getDeduplicatedGross(tx as any, globalFirstIds.has(tx.id));
        const net = p2 ? 0 : (tx.net_value || 0);
        const aRec = p2 ? 0 : calcRecebimento(gross, pagamentosMap.get(tx.id)?.pago).aReceber;
        const canal = canalMap.get(tx.id)?.canal || CANAL_DIRETO;
        const id = `canal:${canal}`;
        const row = canalTotals.get(id) || { id, name: canal, count: 0, gross: 0, net: 0, outsideCount: 0, outsideGross: 0, aReceber: 0 };
        if (p2) row.p2Count = (row.p2Count || 0) + 1; else row.count++;
        track(id, tx, gross);
        row.gross += gross;
        row.net += net;
        row.aReceber = (row.aReceber || 0) + aRec;
        canalTotals.set(id, row);
        const arr = txMap.get(id) || [];
        arr.push(tx);
        txMap.set(id, arr);
      }
      // Monta a lista a partir da ordem oficial de `canais_entrada_lista`; canais fora da lista
      // (que vieram das vendas) entram no fim, antes de "Direto (sem entrada)".
      const lista = canaisLista || [];
      const listaSet = new Set(lista);
      const comVendaLista: CloserRow[] = [];
      const zeradas: CloserRow[] = [];
      for (const canal of lista) {
        const row = canalTotals.get(`canal:${canal}`);
        if (row) {
          if (row.count > 0 || (row.p2Count || 0) > 0) comVendaLista.push(row);
          else zeradas.push(row);
        } else {
          zeradas.push({ id: `canal:${canal}`, name: canal, count: 0, gross: 0, net: 0, outsideCount: 0, outsideGross: 0, aReceber: 0 });
        }
      }
      comVendaLista.sort((a, b) => b.gross - a.gross);
      const extras = Array.from(canalTotals.values())
        .filter((r) => !listaSet.has(r.name))
        .sort((a, b) => b.gross - a.gross);
      let rows = [...comVendaLista, ...extras, ...zeradas];
      // "Direto (sem entrada)" sempre por último
      const diretoRow = rows.find((r) => r.name === CANAL_DIRETO);
      if (diretoRow) rows = [...rows.filter((r) => r !== diretoRow), diretoRow];
      if (!mostrarSemVenda) rows = rows.filter((r) => r.count > 0 || (r.p2Count || 0) > 0);
      const vt = finalize(rows);
      return {
        summaryData: {
          rows,
          ...vt,
          totalGross: rows.reduce((s, r) => s + r.gross, 0),
          totalNet: rows.reduce((s, r) => s + r.net, 0),
          totalAReceber: rows.reduce((s, r) => s + (r.aReceber || 0), 0),
          totalCount: rows.reduce((s, r) => s + r.count, 0),
          totalOutsideCount: 0,
          totalOutsideGross: 0,
          p2Pagamentos,
          p2Liquido,
        },
        closerTransactionsMap: txMap,
      };
    }

    for (const tx of filteredTxs) {
      const isFirst = globalFirstIds.has(tx.id);
      const p2 = isP2(tx);
      if (p2) { p2Pagamentos++; p2Liquido += tx.net_value || 0; }
      const gross = p2 ? 0 : getDeduplicatedGross(tx as any, isFirst);
      const net = p2 ? 0 : (tx.net_value || 0);
      const aRec = p2 ? 0 : calcRecebimento(gross, pagamentosMap.get(tx.id)?.pago).aReceber;
      
      // 1. Launch sales — but only if no R1 match (Inside Sales override)
      if (tx.sale_origin === 'launch' || 
          (tx.product_name && tx.product_name.toLowerCase().includes('contrato mcf'))) {
        const hasR1Match = atribuicaoMap.has(tx.id);
        
        if (!hasR1Match) {
          // Pure launch — isolate
          if (p2) launch.p2Count = (launch.p2Count || 0) + 1; else launch.count++;
        track('__launch__', tx, gross);
          launch.gross += gross;
        launch.aReceber = (launch.aReceber || 0) + aRec;
          launch.net += net;
          launchTxs.push(tx);
          continue;
        }
        // Has R1 match — fall through to closer attribution (step 5)
      }
      
      // 2. A010 - Funil de entrada automático
      if (tx.product_category === 'a010') {
        if (p2) a010.p2Count = (a010.p2Count || 0) + 1; else a010.count++;
        track('__a010__', tx, gross);
        a010.gross += gross;
        a010.aReceber = (a010.aReceber || 0) + aRec;
        a010.net += net;
        a010Txs.push(tx);
        continue;
      }
      
      // 3. Renovação
      if (tx.product_category === 'renovacao') {
        if (p2) renovacao.p2Count = (renovacao.p2Count || 0) + 1; else renovacao.count++;
        track('__renovacao__', tx, gross);
        renovacao.gross += gross;
        renovacao.aReceber = (renovacao.aReceber || 0) + aRec;
        renovacao.net += net;
        renovacaoTxs.push(tx);
        continue;
      }
      
      // 4. Vitalício (order bump)
      if (tx.product_category === 'ob_vitalicio') {
        if (p2) vitalicio.p2Count = (vitalicio.p2Count || 0) + 1; else vitalicio.count++;
        track('__vitalicio__', tx, gross);
        vitalicio.gross += gross;
        vitalicio.aReceber = (vitalicio.aReceber || 0) + aRec;
        vitalicio.net += net;
        vitalicioTxs.push(tx);
        continue;
      }
      
      // 5. Match com closer (RPC atribuicao_closer_vendas)
      const atr = atribuicaoMap.get(tx.id);
      if (atr) {
        // Modo SDR agrupa por sdr_profile_id; sem SDR → "Sem SDR"
        const key = modo === 'sdr' ? (atr.sdr_profile_id || '__sem_sdr__') : atr.closer_id;
        const nome = modo === 'sdr'
          ? (atr.sdr_profile_id ? (sdrNames?.get(atr.sdr_profile_id) || 'SDR sem nome') : 'Sem SDR')
          : atr.closer_nome;
        const existing = closerTotals.get(key) || { id: key, name: nome, count: 0, gross: 0, net: 0, outsideCount: 0, outsideGross: 0, outraBu: modo === 'sdr' ? false : atr.outra_bu };
        if (atr.is_outside && !p2) {
          if (!p2) existing.outsideCount++;
          track(key, tx, gross, true);
          existing.outsideGross += gross;
        } else {
          if (p2) existing.p2Count = (existing.p2Count || 0) + 1; else existing.count++;
          track(key, tx, gross);
          existing.gross += gross;
          existing.aReceber = (existing.aReceber || 0) + aRec;
          existing.net += net;
        }
        closerTotals.set(key, existing);
        const arr = txMap.get(key) || [];
        arr.push(tx);
        txMap.set(key, arr);
        continue;
      }

      // 6. Lucrômetro - Funil (sem atribuição)
      const pnLower = (tx.product_name || '').toLowerCase();
      if (pnLower.includes('lucrômetro') || pnLower.includes('lucrometro')) {
        if (p2) lucrometro.p2Count = (lucrometro.p2Count || 0) + 1; else lucrometro.count++;
        track('__lucrometro__', tx, gross);
        lucrometro.gross += gross;
        lucrometro.aReceber = (lucrometro.aReceber || 0) + aRec;
        lucrometro.net += net;
        lucrometroTxs.push(tx);
        continue;
      }

      // 7. Sem closer
      if (p2) unassigned.p2Count = (unassigned.p2Count || 0) + 1; else unassigned.count++;
        track('__unassigned__', tx, gross);
      unassigned.gross += gross;
      unassigned.aReceber = (unassigned.aReceber || 0) + aRec;
      unassigned.net += net;
      unassignedTxs.push(tx);
    }
    
    const rows: CloserRow[] = Array.from(closerTotals.values())
      .filter((r) => r.count > 0 || r.outsideCount > 0 || (r.p2Count || 0) > 0)
      .sort((a, b) => (a.id === '__sem_sdr__' ? 1 : 0) - (b.id === '__sem_sdr__' ? 1 : 0) || b.gross - a.gross);
    
    // Categorias automáticas no final
    const autoCategories = [
      { row: launch, txs: launchTxs, key: '__launch__' },
      { row: a010, txs: a010Txs, key: '__a010__' },
      { row: renovacao, txs: renovacaoTxs, key: '__renovacao__' },
      { row: vitalicio, txs: vitalicioTxs, key: '__vitalicio__' },
      { row: lucrometro, txs: lucrometroTxs, key: '__lucrometro__' },
      { row: unassigned, txs: unassignedTxs, key: '__unassigned__' },
    ];
    
    for (const cat of autoCategories) {
      if (cat.row.count > 0 || (cat.row.p2Count || 0) > 0) {
        rows.push(cat.row);
        txMap.set(cat.key, cat.txs);
      }
    }
    
    const totalGross = rows.reduce((s, r) => s + r.gross, 0);
    const totalNet = rows.reduce((s, r) => s + r.net, 0);
    const totalAReceber = rows.reduce((s, r) => s + (r.aReceber || 0), 0);
    const totalCount = rows.reduce((s, r) => s + r.count, 0);
    const totalOutsideCount = rows.reduce((s, r) => s + r.outsideCount, 0);
    const totalOutsideGross = rows.reduce((s, r) => s + r.outsideGross, 0);
    const vt = finalize(rows);
    
    return {
      summaryData: { rows, ...vt, totalGross, totalNet, totalAReceber, totalCount, totalOutsideCount, totalOutsideGross, p2Pagamentos, p2Liquido },
      closerTransactionsMap: txMap,
    };
  }, [filteredTxs, atribuicaoMap, pagamentosMap, globalFirstIds, bu, modo, canalMap, sdrNames, canaisLista, mostrarSemVenda, donoMap]);

  if (isLoading || loadingAtribuicao) return null;
  if (modo === 'closer' && summaryData.rows.length === 0) return null;
  const modoCarregando = loadingCanal || loadingDonos || (modo === 'canal' && loadingLista) || (modo === 'sdr' && loadingSdrNames);

  const selectedTxs = selectedCloser ? (closerTransactionsMap.get(selectedCloser.id) || []) : [];

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {MODO_TITULO[modo]}
                  {modo === 'canal' && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground" onClick={(e) => e.stopPropagation()} />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs text-xs">
                          Canal = primeiro produto de entrada comprado pelo cliente; sem compra de entrada, usa a etiqueta do lead no CRM.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  <span onClick={(e) => e.stopPropagation()}>
                    <ToggleGroup
                      type="single"
                      size="sm"
                      variant="outline"
                      value={modo}
                      onValueChange={(v) => v && setModo(v as ModoAgrupamento)}
                      className="ml-2"
                    >
                      <ToggleGroupItem value="closer" className="h-7 px-2 text-xs">Closer</ToggleGroupItem>
                      <ToggleGroupItem value="sdr" className="h-7 px-2 text-xs">SDR</ToggleGroupItem>
                      <ToggleGroupItem value="canal" className="h-7 px-2 text-xs">Canal de entrada</ToggleGroupItem>
                    </ToggleGroup>
                  </span>
                  {modo === 'canal' && (
                    <span className="ml-1 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={mostrarSemVenda}
                        onCheckedChange={setMostrarSemVenda}
                        className="scale-90"
                        aria-label="Mostrar canais sem venda"
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">Mostrar canais sem venda</span>
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-mono text-xs">
                    {summaryData.totalVendas} vendas · {summaryData.totalCount} pagamentos
                  </Badge>
                  <Badge variant="outline" className="font-mono text-xs">
                    {formatCurrency(summaryData.totalGross)}
                  </Badge>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </span>
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              {modoCarregando ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Carregando…</p>
              ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{modo === 'closer' ? 'Closer' : modo === 'sdr' ? 'SDR' : 'Canal'}</TableHead>
                    <TableHead className="text-right">Vendas</TableHead>
                    <TableHead className="text-right">Faturamento Bruto</TableHead>
                    <TableHead className="text-right">A receber</TableHead>
                    <TableHead className="text-right">Receita Líquida</TableHead>
                    <TableHead className="text-right">
                      <span className="inline-flex items-center gap-1">
                        Ticket Médio Bruto
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                            <TooltipContent>{TICKET_PARCERIA_TOOLTIP}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </span>
                    </TableHead>
                    <TableHead className="text-right">
                      <span className="inline-flex items-center gap-1">
                        Ticket Médio Líquido
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                            <TooltipContent>{TICKET_PARCERIA_TOOLTIP}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </span>
                    </TableHead>
                    <TableHead className="text-right">% do Total</TableHead>
                    <TableHead className="text-right">Outside</TableHead>
                    <TableHead className="text-right">Fat. Outside</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaryData.rows.map((row) => {
                    const soP2 = row.count === 0 && row.outsideCount === 0 && (row.p2Count || 0) > 0;
                    const zerada = row.count === 0 && !soP2;
                    const semValor = zerada || soP2;
                    return (
                      <TableRow key={row.name} className={zerada ? 'text-muted-foreground' : undefined}>
                        <TableCell>
                          {zerada ? (
                            <span className="font-medium">{row.name}</span>
                          ) : (
                            <button
                              className={`font-medium text-left hover:underline cursor-pointer ${
                                row.id === '__unassigned__' || row.id === '__sem_sdr__' || row.name === CANAL_DIRETO ? 'text-muted-foreground' : 
                                row.id === '__launch__' ? 'text-amber-500' :
                                row.id === '__a010__' || row.id === '__lucrometro__' ? 'text-blue-400' :
                                row.id === '__renovacao__' ? 'text-teal-400' :
                                row.id === '__vitalicio__' ? 'text-purple-400' :
                                'text-primary'
                              }`}
                              onClick={() => setSelectedCloser({ id: row.id, name: row.name })}
                            >
                              {row.id === '__launch__' ? '🚀 ' : 
                               row.id === '__a010__' ? '📊 ' : 
                               row.id === '__renovacao__' ? '🔄 ' :
                               row.id === '__vitalicio__' ? '♾️ ' : ''}{row.name}
                            </button>
                          )}
                          {row.outraBu && (
                            <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0">outra BU</Badge>
                          )}
                          {soP2 && (
                            <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">só P2</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{semValor ? '-' : (row.vendas || 0)}</TableCell>
                        <TableCell className="text-right font-mono">
                          {semValor ? '-' : formatCurrency(row.gross)}
                        </TableCell>
                        <TableCell className={`text-right font-mono ${!semValor && (row.aReceber || 0) > 0 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                          {!semValor && (row.aReceber || 0) > 0 ? formatCurrency(row.aReceber || 0) : '-'}
                        </TableCell>
                        <TableCell className={`text-right font-mono ${semValor ? '' : 'text-success'}`}>
                          {semValor ? '-' : formatCurrency(row.net)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {row.ticketParceria?.ticketBruto != null ? formatCurrency(row.ticketParceria.ticketBruto) : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {row.ticketParceria?.ticketLiquido != null ? formatCurrency(row.ticketParceria.ticketLiquido) : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {semValor ? '-' : (summaryData.totalGross > 0
                            ? ((row.gross / summaryData.totalGross) * 100).toFixed(1)
                            : '0.0') + '%'}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {(row.outsideVendas || 0) > 0 ? row.outsideVendas : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {row.outsideGross > 0 ? formatCurrency(row.outsideGross) : '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-bold">Total</TableCell>
                    <TableCell className="text-right font-bold">{summaryData.totalVendas}</TableCell>
                    <TableCell className="text-right font-mono font-bold">
                      {formatCurrency(summaryData.totalGross)}
                    </TableCell>
                    <TableCell className={`text-right font-mono font-bold ${summaryData.totalAReceber > 0 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                      {summaryData.totalAReceber > 0 ? formatCurrency(summaryData.totalAReceber) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-success">
                      {formatCurrency(summaryData.totalNet)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold">
                      {summaryData.totalTicketParceria.ticketBruto != null ? formatCurrency(summaryData.totalTicketParceria.ticketBruto) : '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold">
                      {summaryData.totalTicketParceria.ticketLiquido != null ? formatCurrency(summaryData.totalTicketParceria.ticketLiquido) : '—'}
                    </TableCell>
                    <TableCell className="text-right font-bold">100%</TableCell>
                    <TableCell className="text-right font-bold text-muted-foreground">
                      {summaryData.totalOutsideVendas > 0 ? summaryData.totalOutsideVendas : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-muted-foreground">
                      {summaryData.totalOutsideGross > 0 ? formatCurrency(summaryData.totalOutsideGross) : '-'}
                    </TableCell>
                  </TableRow>
                  {summaryData.p2Pagamentos > 0 && (
                    <TableRow>
                      <TableCell colSpan={11} className="text-xs text-muted-foreground font-normal">
                        P2 fora da tabela: {summaryData.p2Pagamentos} pagamentos · líquido {formatCurrency(summaryData.p2Liquido)} — veja no detalhe de cada closer
                      </TableCell>
                    </TableRow>
                  )}
                </TableFooter>
              </Table>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {selectedCloser && (
        <CloserRevenueDetailDialog
          open={!!selectedCloser}
          onOpenChange={(open) => !open && setSelectedCloser(null)}
          closerName={selectedCloser.name}
          closerId={selectedCloser.id}
          transactions={selectedTxs}
          globalFirstIds={globalFirstIds}
          attendees={attendees}
          closers={closers}
          startDate={startDate}
          endDate={endDate}
          atribuicaoMap={atribuicaoMap}
          pagamentosMap={pagamentosMap}
          bu={bu}
          modo={modo}
          canalMap={canalMap}
          donoMap={donoMap}
        />
      )}
    </>
  );
}
