import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DatePickerCustom } from '@/components/ui/DatePickerCustom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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

interface HublaTransaction {
  id: string;
  product_name: string | null;
  product_price: number | null;
  net_value: number | null;
  customer_name: string | null;
  customer_email: string | null;
  sale_date: string | null;
  sale_status: string | null;
  installment_number: number | null;
  total_installments: number | null;
  source: string | null;
}

interface CrossBURow {
  txId: string;
  nome: string;
  email: string;
  telefone: string;
  grupoCota: string;
  produto: string;
  saleDate: string | null;
  bruto: number;
  liquido: number;
  parcela: string;
  fonte: string;
  status: string;
}

export function CrossBUReportPanel({ bu }: CrossBUReportPanelProps) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [datePreset, setDatePreset] = useState<DatePreset>('month');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
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

  // Build email→lead map
  const emailToLead = useMemo(() => {
    const m = new Map<string, ConsorcioLead>();
    leads.forEach(l => {
      const email = (l.email || '').toLowerCase().trim();
      if (email) m.set(email, l);
    });
    return m;
  }, [leads]);

  const leadEmails = useMemo(() => Array.from(emailToLead.keys()).filter(Boolean), [emailToLead]);

  // Query 2: Fetch hubla_transactions for those emails (batched)
  const { data: transactions = [], isLoading: loadingTx } = useQuery({
    queryKey: ['cross-bu-transactions', leadEmails.length, dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async () => {
      if (leadEmails.length === 0) return [];
      const all: HublaTransaction[] = [];
      const batchSize = 200;

      for (let i = 0; i < leadEmails.length; i += batchSize) {
        const batch = leadEmails.slice(i, i + batchSize);
        let query = supabase
          .from('hubla_transactions')
          .select('id, product_name, product_price, net_value, customer_name, customer_email, sale_date, sale_status, installment_number, total_installments, source')
          .in('customer_email', batch);

        if (dateRange?.from) {
          const start = format(dateRange.from, 'yyyy-MM-dd') + 'T00:00:00-03:00';
          query = query.gte('sale_date', start);
        }
        if (dateRange?.to) {
          const end = format(dateRange.to, 'yyyy-MM-dd') + 'T23:59:59-03:00';
          query = query.lte('sale_date', end);
        }

        // Paginate within each batch
        let offset = 0;
        let hasMore = true;
        while (hasMore) {
          const { data, error } = await query.range(offset, offset + 999);
          if (error) throw error;
          const rows = (data || []) as HublaTransaction[];
          all.push(...rows);
          hasMore = rows.length >= 1000;
          offset += 1000;
        }
      }
      return all;
    },
    enabled: leadEmails.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = loadingLeads || loadingTx;

  // Join: build flat rows
  const allRows: CrossBURow[] = useMemo(() => {
    return transactions.map(tx => {
      const email = (tx.customer_email || '').toLowerCase().trim();
      const lead = emailToLead.get(email);
      return {
        txId: tx.id,
        nome: lead?.nome_completo || tx.customer_name || '-',
        email: lead?.email || tx.customer_email || '-',
        telefone: lead?.telefone || '-',
        grupoCota: lead ? `${lead.grupo || '-'}/${lead.cota || '-'}` : '-',
        produto: tx.product_name || '-',
        saleDate: tx.sale_date,
        bruto: tx.product_price || 0,
        liquido: tx.net_value || 0,
        parcela: tx.installment_number ? `${tx.installment_number}/${tx.total_installments || '?'}` : '-',
        fonte: tx.source || '-',
        status: tx.sale_status || '-',
      };
    });
  }, [transactions, emailToLead]);

  // Unique products/statuses for filters
  const productOptions = useMemo(() => {
    const s = new Set<string>();
    allRows.forEach(r => { if (r.produto !== '-') s.add(r.produto); });
    return Array.from(s).sort();
  }, [allRows]);

  const statusOptions = useMemo(() => {
    const s = new Set<string>();
    allRows.forEach(r => { if (r.status !== '-') s.add(r.status); });
    return Array.from(s).sort();
  }, [allRows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    let rows = [...allRows];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter(r =>
        r.nome.toLowerCase().includes(term) ||
        r.email.toLowerCase().includes(term) ||
        r.telefone.includes(term)
      );
    }
    if (selectedProduct !== 'all') {
      rows = rows.filter(r => r.produto === selectedProduct);
    }
    if (selectedStatus !== 'all') {
      rows = rows.filter(r => r.status === selectedStatus);
    }
    return rows;
  }, [allRows, searchTerm, selectedProduct, selectedStatus]);

  // Stats
  const stats = useMemo(() => {
    const uniqueEmails = new Set(filteredRows.map(r => r.email.toLowerCase()));
    const totalGross = filteredRows.reduce((s, r) => s + r.bruto, 0);
    return {
      leads: uniqueEmails.size,
      count: filteredRows.length,
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

  const hasActiveFilters = searchTerm || selectedProduct !== 'all' || selectedStatus !== 'all';
  const clearAllFilters = () => {
    setSearchTerm('');
    setSelectedProduct('all');
    setSelectedStatus('all');
    setCurrentPage(1);
  };

  const handlePageSizeChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  // Export Excel
  const handleExportExcel = () => {
    const data = filteredRows.map(r => ({
      'Data': r.saleDate ? format(parseISO(r.saleDate), 'dd/MM/yyyy', { locale: ptBR }) : '-',
      'Cliente': r.nome,
      'Email': r.email,
      'Telefone': r.telefone,
      'Grupo/Cota': r.grupoCota,
      'Produto': r.produto,
      'Bruto': r.bruto,
      'Líquido': r.liquido,
      'Parcela': r.parcela,
      'Fonte': r.fonte,
      'Status': r.status,
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
            {/* Date presets */}
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

            <Select value={selectedProduct} onValueChange={v => { setSelectedProduct(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[200px] h-9">
                <SelectValue placeholder="Produto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Produtos</SelectItem>
                {productOptions.map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={v => { setSelectedStatus(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {statusOptions.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

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

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Transações Cross-BU dos Leads do Consórcio
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma transação encontrada no período selecionado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Grupo/Cota</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Bruto</TableHead>
                    <TableHead className="text-right">Líquido</TableHead>
                    <TableHead>Parcela</TableHead>
                    <TableHead>Fonte</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRows.map((row, index) => (
                    <TableRow key={row.txId || index}>
                      <TableCell className="whitespace-nowrap">
                        {row.saleDate ? format(parseISO(row.saleDate), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate">{row.nome}</TableCell>
                      <TableCell className="max-w-[180px] truncate text-sm">{row.email}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{row.telefone}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{row.grupoCota}</TableCell>
                      <TableCell className="font-medium max-w-[180px] truncate">{row.produto}</TableCell>
                      <TableCell className="text-right font-mono whitespace-nowrap">
                        {formatCurrency(row.bruto)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-success whitespace-nowrap">
                        {formatCurrency(row.liquido)}
                      </TableCell>
                      <TableCell>{row.parcela}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{row.fonte}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{row.status}</Badge>
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
                    Mostrando {Math.min((currentPage - 1) * itemsPerPage + 1, filteredRows.length)} a {Math.min(currentPage * itemsPerPage, filteredRows.length)} de {filteredRows.length} transações
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
