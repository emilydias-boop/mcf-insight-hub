import { useState, useMemo } from 'react';
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
import { getDeduplicatedGross } from '@/lib/incorporadorPricing';
import { CloserRevenueDetailDialog } from './CloserRevenueDetailDialog';
import { useAtribuicaoCloser } from '@/hooks/useAtribuicaoCloser';
import { usePagamentosDaVenda, calcRecebimento } from '@/hooks/usePagamentosDaVenda';

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
        const gross = getDeduplicatedGross(tx as any, globalFirstIds.has(tx.id));
        const net = tx.net_value || 0;
        const aRec = calcRecebimento(gross, pagamentosMap.get(tx.id)?.pago).aReceber;
        const canal = canalMap.get(tx.id)?.canal || CANAL_DIRETO;
        const id = `canal:${canal}`;
        const row = canalTotals.get(id) || { id, name: canal, count: 0, gross: 0, net: 0, outsideCount: 0, outsideGross: 0, aReceber: 0 };
        row.count++;
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
          if (row.count > 0) comVendaLista.push(row);
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
      if (!mostrarSemVenda) rows = rows.filter((r) => r.count > 0);
      return {
        summaryData: {
          rows,
          totalGross: rows.reduce((s, r) => s + r.gross, 0),
          totalNet: rows.reduce((s, r) => s + r.net, 0),
          totalAReceber: rows.reduce((s, r) => s + (r.aReceber || 0), 0),
          totalCount: rows.reduce((s, r) => s + r.count, 0),
          totalOutsideCount: 0,
          totalOutsideGross: 0,
        },
        closerTransactionsMap: txMap,
      };
    }

    for (const tx of filteredTxs) {
      const isFirst = globalFirstIds.has(tx.id);
      const gross = getDeduplicatedGross(tx as any, isFirst);
      const net = tx.net_value || 0;
      const aRec = calcRecebimento(gross, pagamentosMap.get(tx.id)?.pago).aReceber;
      
      // 1. Launch sales — but only if no R1 match (Inside Sales override)
      if (tx.sale_origin === 'launch' || 
          (tx.product_name && tx.product_name.toLowerCase().includes('contrato mcf'))) {
        const hasR1Match = atribuicaoMap.has(tx.id);
        
        if (!hasR1Match) {
          // Pure launch — isolate
          launch.count++;
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
        a010.count++;
        a010.gross += gross;
        a010.aReceber = (a010.aReceber || 0) + aRec;
        a010.net += net;
        a010Txs.push(tx);
        continue;
      }
      
      // 3. Renovação
      if (tx.product_category === 'renovacao') {
        renovacao.count++;
        renovacao.gross += gross;
        renovacao.aReceber = (renovacao.aReceber || 0) + aRec;
        renovacao.net += net;
        renovacaoTxs.push(tx);
        continue;
      }
      
      // 4. Vitalício (order bump)
      if (tx.product_category === 'ob_vitalicio') {
        vitalicio.count++;
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
        if (atr.is_outside) {
          existing.outsideCount++;
          existing.outsideGross += gross;
        } else {
          existing.count++;
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
        lucrometro.count++;
        lucrometro.gross += gross;
        lucrometro.aReceber = (lucrometro.aReceber || 0) + aRec;
        lucrometro.net += net;
        lucrometroTxs.push(tx);
        continue;
      }

      // 7. Sem closer
      unassigned.count++;
      unassigned.gross += gross;
      unassigned.aReceber = (unassigned.aReceber || 0) + aRec;
      unassigned.net += net;
      unassignedTxs.push(tx);
    }
    
    const rows: CloserRow[] = Array.from(closerTotals.values())
      .filter((r) => r.count > 0 || r.outsideCount > 0)
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
      if (cat.row.count > 0) {
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
    
    return {
      summaryData: { rows, totalGross, totalNet, totalAReceber, totalCount, totalOutsideCount, totalOutsideGross },
      closerTransactionsMap: txMap,
    };
  }, [filteredTxs, atribuicaoMap, pagamentosMap, globalFirstIds, bu, modo, canalMap, sdrNames]);

  if (isLoading || loadingAtribuicao) return null;
  if (modo === 'closer' && summaryData.rows.length === 0) return null;
  const modoCarregando = loadingCanal || (modo === 'sdr' && loadingSdrNames);

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
                </span>
                <span className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-mono text-xs">
                    {summaryData.totalCount} transações
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
                    <TableHead className="text-right">Transações</TableHead>
                    <TableHead className="text-right">Faturamento Bruto</TableHead>
                    <TableHead className="text-right">A receber</TableHead>
                    <TableHead className="text-right">Receita Líquida</TableHead>
                    <TableHead className="text-right">Ticket Médio</TableHead>
                    <TableHead className="text-right">% do Total</TableHead>
                    <TableHead className="text-right">Outside</TableHead>
                    <TableHead className="text-right">Fat. Outside</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaryData.rows.map((row) => (
                    <TableRow key={row.name}>
                      <TableCell>
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
                        {row.outraBu && (
                          <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0">outra BU</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{row.count}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(row.gross)}
                      </TableCell>
                      <TableCell className={`text-right font-mono ${(row.aReceber || 0) > 0 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                        {(row.aReceber || 0) > 0 ? formatCurrency(row.aReceber || 0) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-success">
                        {formatCurrency(row.net)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(row.count > 0 ? row.net / row.count : 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        {summaryData.totalGross > 0
                          ? ((row.gross / summaryData.totalGross) * 100).toFixed(1)
                          : '0.0'}%
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {row.outsideCount > 0 ? row.outsideCount : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {row.outsideGross > 0 ? formatCurrency(row.outsideGross) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-bold">Total</TableCell>
                    <TableCell className="text-right font-bold">{summaryData.totalCount}</TableCell>
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
                      {formatCurrency(summaryData.totalCount > 0 ? summaryData.totalNet / summaryData.totalCount : 0)}
                    </TableCell>
                    <TableCell className="text-right font-bold">100%</TableCell>
                    <TableCell className="text-right font-bold text-muted-foreground">
                      {summaryData.totalOutsideCount > 0 ? summaryData.totalOutsideCount : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-muted-foreground">
                      {summaryData.totalOutsideGross > 0 ? formatCurrency(summaryData.totalOutsideGross) : '-'}
                    </TableCell>
                  </TableRow>
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
        />
      )}
    </>
  );
}
