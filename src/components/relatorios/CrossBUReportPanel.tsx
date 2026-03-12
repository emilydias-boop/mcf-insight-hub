import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DatePickerCustom } from '@/components/ui/DatePickerCustom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileSpreadsheet, DollarSign, ShoppingCart, TrendingUp, Loader2, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X, Users } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/formatters';
import * as XLSX from 'xlsx';
import { BusinessUnit } from '@/hooks/useMyBU';

interface CrossBUReportPanelProps {
  bu: BusinessUnit;
}

type DatePreset = 'today' | 'week' | 'month' | 'custom';

interface ConsorcioLead {
  id: string;
  nome_completo: string | null;
  email: string | null;
  telefone: string | null;
  grupo: string | null;
  cota: string | null;
  origem: string | null;
}

interface HublaTransactionRaw {
  id: string;
  product_name: string | null;
  product_category: string | null;
  product_price: number | null;
  net_value: number | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  sale_date: string | null;
  sale_status: string | null;
  installment_number: number | null;
  total_installments: number | null;
  source: string | null;
}

interface CrossBULeadRow {
  key: string;
  nome: string;
  email: string;
  telefone: string;
  grupoCota: string;
  totalTx: number;
  brutoA010: number;
  brutoContrato: number;
  brutoParceria: number;
  brutoOutros: number;
  brutoTotal: number;
  liquidoTotal: number;
  primeiraCompra: string | null;
  ultimaCompra: string | null;
}

function classifyCategory(cat: string | null): 'a010' | 'contrato' | 'parceria' | 'outros' {
  const c = (cat || '').toLowerCase().trim();
  if (c === 'a010') return 'a010';
  if (c === 'contrato') return 'contrato';
  if (c === 'parceria') return 'parceria';
  return 'outros';
}

export function CrossBUReportPanel({ bu }: CrossBUReportPanelProps) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [datePreset, setDatePreset] = useState<DatePreset>('month');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const PAGE_SIZE_OPTIONS = [25, 50, 100];

  // Query 1: Fetch all consortium_cards leads
  const { data: leads = [], isLoading: loadingLeads } = useQuery({
    queryKey: ['consortium-cards-leads'],
    queryFn: async () => {
      const all: ConsorcioLead[] = [];
      let offset = 0;
      const pageSize = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from('consortium_cards')
          .select('id, nome_completo, email, telefone, grupo, cota, origem')
          .range(offset, offset + pageSize - 1);
        if (error) throw error;
        const batch = (data || []) as ConsorcioLead[];
        all.push(...batch);
        hasMore = batch.length >= pageSize;
        offset += pageSize;
      }
      return all;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Build name→leads[] map
  const nameToLeads = useMemo(() => {
    const m = new Map<string, ConsorcioLead[]>();
    leads.forEach(l => {
      const name = (l.nome_completo || '').toUpperCase().trim();
      if (name) {
        const existing = m.get(name) || [];
        existing.push(l);
        m.set(name, existing);
      }
    });
    return m;
  }, [leads]);

  // Query 2: Fetch hubla_transactions in date range (with product_category)
  const { data: transactions = [], isLoading: loadingTx } = useQuery({
    queryKey: ['cross-bu-transactions-by-name', dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async () => {
      const all: HublaTransactionRaw[] = [];
      let offset = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore && offset < 5000) {
        let query = supabase
          .from('hubla_transactions')
          .select('id, product_name, product_category, product_price, net_value, customer_name, customer_email, customer_phone, sale_date, sale_status, installment_number, total_installments, source')
          .order('sale_date', { ascending: false })
          .range(offset, offset + pageSize - 1);

        if (dateRange?.from) {
          const start = format(dateRange.from, 'yyyy-MM-dd') + 'T00:00:00-03:00';
          query = query.gte('sale_date', start);
        }
        if (dateRange?.to) {
          const end = format(dateRange.to, 'yyyy-MM-dd') + 'T23:59:59-03:00';
          query = query.lte('sale_date', end);
        }

        const { data, error } = await query;
        if (error) throw error;
        const rows = (data || []) as HublaTransactionRaw[];
        all.push(...rows);
        hasMore = rows.length >= pageSize;
        offset += pageSize;
      }
      return all;
    },
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = loadingLeads || loadingTx;

  // Aggregate: group transactions by normalized name, sum by category
  const allRows: CrossBULeadRow[] = useMemo(() => {
    if (nameToLeads.size === 0) return [];

    const grouped = new Map<string, CrossBULeadRow>();

    transactions.forEach(tx => {
      const txName = (tx.customer_name || '').toUpperCase().trim();
      if (!txName || !nameToLeads.has(txName)) return;

      const matchedLeads = nameToLeads.get(txName) || [];
      const grupoCota = matchedLeads.map(l => `${l.grupo || '-'}/${l.cota || '-'}`).join(', ');
      const cat = classifyCategory(tx.product_category);
      const bruto = tx.product_price || 0;
      const liquido = tx.net_value || 0;

      const existing = grouped.get(txName);
      if (existing) {
        existing.totalTx += 1;
        if (cat === 'a010') existing.brutoA010 += bruto;
        else if (cat === 'contrato') existing.brutoContrato += bruto;
        else if (cat === 'parceria') existing.brutoParceria += bruto;
        else existing.brutoOutros += bruto;
        existing.brutoTotal += bruto;
        existing.liquidoTotal += liquido;
        if (tx.sale_date && (!existing.primeiraCompra || tx.sale_date < existing.primeiraCompra)) {
          existing.primeiraCompra = tx.sale_date;
        }
        if (tx.sale_date && (!existing.ultimaCompra || tx.sale_date > existing.ultimaCompra)) {
          existing.ultimaCompra = tx.sale_date;
        }
        // Enrich email/phone if missing
        if (existing.email === '-' && tx.customer_email) existing.email = tx.customer_email;
        if (existing.telefone === '-' && tx.customer_phone) existing.telefone = tx.customer_phone;
      } else {
        grouped.set(txName, {
          key: txName,
          nome: tx.customer_name || '-',
          email: tx.customer_email || matchedLeads[0]?.email || '-',
          telefone: tx.customer_phone || matchedLeads[0]?.telefone || '-',
          grupoCota,
          totalTx: 1,
          brutoA010: cat === 'a010' ? bruto : 0,
          brutoContrato: cat === 'contrato' ? bruto : 0,
          brutoParceria: cat === 'parceria' ? bruto : 0,
          brutoOutros: cat === 'outros' ? bruto : 0,
          brutoTotal: bruto,
          liquidoTotal: liquido,
          primeiraCompra: tx.sale_date,
          ultimaCompra: tx.sale_date,
        });
      }
    });

    return Array.from(grouped.values()).sort((a, b) => b.brutoTotal - a.brutoTotal);
  }, [transactions, nameToLeads]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    if (!searchTerm) return allRows;
    const term = searchTerm.toLowerCase();
    return allRows.filter(r =>
      r.nome.toLowerCase().includes(term) ||
      r.email.toLowerCase().includes(term) ||
      r.telefone.includes(term)
    );
  }, [allRows, searchTerm]);

  // Stats
  const stats = useMemo(() => {
    const totalTx = filteredRows.reduce((s, r) => s + r.totalTx, 0);
    const totalGross = filteredRows.reduce((s, r) => s + r.brutoTotal, 0);
    return {
      leads: filteredRows.length,
      totalTx,
      totalGross,
      avgTicket: filteredRows.length > 0 ? totalGross / filteredRows.length : 0,
    };
  }, [filteredRows]);

  // Pagination
  const totalPages = Math.ceil(filteredRows.length / itemsPerPage);
  const paginatedRows = filteredRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Date preset handler
  const handleDatePreset = (preset: DatePreset) => {
    const now = new Date();
    setDatePreset(preset);
    setCurrentPage(1);
    if (preset === 'today') {
      setDateRange({ from: startOfDay(now), to: endOfDay(now) });
    } else if (preset === 'week') {
      setDateRange({ from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) });
    } else if (preset === 'month') {
      setDateRange({ from: startOfMonth(now), to: endOfMonth(now) });
    }
  };

  const hasActiveFilters = !!searchTerm;
  const clearAllFilters = () => {
    setSearchTerm('');
    setCurrentPage(1);
  };

  const handlePageSizeChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  // Export Excel
  const handleExportExcel = () => {
    const data = filteredRows.map(r => ({
      'Cliente': r.nome,
      'Email': r.email,
      'Telefone': r.telefone,
      'Grupo/Cota': r.grupoCota,
      'Qtd Transações': r.totalTx,
      'Bruto A010': r.brutoA010,
      'Bruto Contrato': r.brutoContrato,
      'Bruto Parceria': r.brutoParceria,
      'Bruto Outros': r.brutoOutros,
      'Bruto Total': r.brutoTotal,
      'Líquido Total': r.liquidoTotal,
      '1ª Compra': r.primeiraCompra ? format(parseISO(r.primeiraCompra), 'dd/MM/yyyy', { locale: ptBR }) : '-',
      'Última Compra': r.ultimaCompra ? format(parseISO(r.ultimaCompra), 'dd/MM/yyyy', { locale: ptBR }) : '-',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cross-BU');
    XLSX.writeFile(wb, `cross-bu-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1">
              {(['today', 'week', 'month', 'custom'] as DatePreset[]).map(preset => (
                <Button
                  key={preset}
                  variant={datePreset === preset ? 'default' : 'outline'}
                  size="sm"
                  className="h-9"
                  onClick={() => handleDatePreset(preset)}
                >
                  {{ today: 'Hoje', week: 'Semana', month: 'Mês', custom: 'Custom' }[preset]}
                </Button>
              ))}
            </div>

            <DatePickerCustom
              selected={dateRange}
              onSelect={(range) => { setDateRange(range as DateRange); setDatePreset('custom'); setCurrentPage(1); }}
              mode="range"
            />

            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar nome/email/tel..."
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="pl-8 w-[220px] h-9"
              />
            </div>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-9 px-2 text-muted-foreground">
                <X className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            )}

            <Button size="sm" className="h-9 ml-auto" onClick={handleExportExcel} disabled={filteredRows.length === 0}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Leads com Compras</p>
                <p className="text-3xl font-bold">{stats.leads}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <ShoppingCart className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Transações</p>
                <p className="text-3xl font-bold">{stats.totalTx}</p>
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
              <div className="p-3 rounded-full bg-muted">
                <TrendingUp className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ticket Médio / Lead</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.avgTicket)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Leads do Consórcio — Compras Cross-BU (Agrupado)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum lead com transações encontrado no período selecionado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Grupo/Cota</TableHead>
                    <TableHead className="text-center">Qtd Tx</TableHead>
                    <TableHead className="text-right">A010</TableHead>
                    <TableHead className="text-right">Contrato</TableHead>
                    <TableHead className="text-right">Parceria</TableHead>
                    <TableHead className="text-right">Outros</TableHead>
                    <TableHead className="text-right">Bruto Total</TableHead>
                    <TableHead className="text-right">Líquido Total</TableHead>
                    <TableHead>1ª Compra</TableHead>
                    <TableHead>Última Compra</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRows.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell className="max-w-[160px] truncate font-medium">{row.nome}</TableCell>
                      <TableCell className="max-w-[180px] truncate text-sm">{row.email}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{row.telefone}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm max-w-[200px] truncate">{row.grupoCota}</TableCell>
                      <TableCell className="text-center">{row.totalTx}</TableCell>
                      <TableCell className="text-right font-mono whitespace-nowrap">
                        {row.brutoA010 > 0 ? formatCurrency(row.brutoA010) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono whitespace-nowrap">
                        {row.brutoContrato > 0 ? formatCurrency(row.brutoContrato) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono whitespace-nowrap">
                        {row.brutoParceria > 0 ? formatCurrency(row.brutoParceria) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono whitespace-nowrap">
                        {row.brutoOutros > 0 ? formatCurrency(row.brutoOutros) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold whitespace-nowrap">
                        {formatCurrency(row.brutoTotal)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-success whitespace-nowrap">
                        {formatCurrency(row.liquidoTotal)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {row.primeiraCompra ? format(parseISO(row.primeiraCompra), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {row.ultimaCompra ? format(parseISO(row.ultimaCompra), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
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
                    Mostrando {Math.min((currentPage - 1) * itemsPerPage + 1, filteredRows.length)} a {Math.min(currentPage * itemsPerPage, filteredRows.length)} de {filteredRows.length} leads
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="px-3 text-sm">Página {currentPage} de {totalPages || 1}</span>
                  <Button variant="outline" size="icon" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => setCurrentPage(totalPages)} disabled={currentPage >= totalPages}>
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
