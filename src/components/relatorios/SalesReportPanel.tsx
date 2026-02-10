import { useState, useMemo } from 'react';
import { CloserRevenueSummaryTable } from './CloserRevenueSummaryTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DatePickerCustom } from '@/components/ui/DatePickerCustom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileSpreadsheet, DollarSign, ShoppingCart, TrendingUp, Loader2, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { useAllHublaTransactions, TransactionFilters } from '@/hooks/useAllHublaTransactions';
import { formatCurrency } from '@/lib/formatters';
import * as XLSX from 'xlsx';
import { BusinessUnit } from '@/hooks/useMyBU';
import { useGestorClosers } from '@/hooks/useGestorClosers';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getDeduplicatedGross } from '@/lib/incorporadorPricing';

interface SalesReportPanelProps {
  bu: BusinessUnit;
}

// Detectar canal de vendas baseado nas tags do Clint ou nome do produto
const detectSalesChannel = (productName: string | null): 'A010' | 'BIO' | 'LIVE' => {
  const name = (productName || '').toLowerCase();
  // Detectar canal baseado no nome do produto
  if (name.includes('a010')) {
    return 'A010';
  }
  if (name.includes('bio') || name.includes('instagram')) {
    return 'BIO';
  }
  
  return 'LIVE';
};

// Normaliza telefone para comparação
const normalizePhone = (phone: string | null | undefined): string => {
  return (phone || '').replace(/\D/g, '');
};

export function SalesReportPanel({ bu }: SalesReportPanelProps) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedChannel, setSelectedChannel] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [selectedCloserId, setSelectedCloserId] = useState<string>('all');
  const [selectedOriginId, setSelectedOriginId] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  
  const PAGE_SIZE_OPTIONS = [25, 50, 100];
  
  const filters: TransactionFilters = useMemo(() => ({
    startDate: dateRange?.from,
    endDate: dateRange?.to,
    search: undefined,
    selectedProducts: undefined,
  }), [dateRange]);
  
  const { data: transactions = [], isLoading } = useAllHublaTransactions(filters);
  
  // Closers R1
  const { data: closers = [] } = useGestorClosers('r1');
  
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
  
  // IDs de primeira transação (para deduplicação do bruto)
  const { data: globalFirstIds = new Set<string>() } = useQuery({
    queryKey: ['global-first-transaction-ids'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_first_transaction_ids');
      if (error) throw error;
      return new Set((data || []).map((r: { id: string }) => r.id));
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
  
  // Interface para attendees
  interface AttendeeMatch {
    id: string;
    attendee_phone: string | null;
    deal_id: string | null;
    meeting_slots: { closer_id: string | null; scheduled_at: string | null } | null;
    crm_deals: { crm_contacts: { email: string | null; phone: string | null } | null } | null;
  }

  // Attendees para matching com closers
  const { data: attendees = [] } = useQuery<AttendeeMatch[]>({
    queryKey: ['attendees-for-sales-matching', dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async (): Promise<AttendeeMatch[]> => {
      if (!dateRange?.from) return [];
      
      const startDate = dateRange.from.toISOString();
      const endDate = dateRange.to 
        ? new Date(new Date(dateRange.to).setHours(23, 59, 59, 999)).toISOString()
        : undefined;
      
      let query = supabase
        .from('meeting_slot_attendees')
        .select(`
          id, attendee_phone, deal_id,
          meeting_slots!inner(closer_id, scheduled_at),
          crm_deals!deal_id(crm_contacts!contact_id(email, phone))
        `)
        .eq('status', 'contract_paid')
        .gte('contract_paid_at', startDate);
      
      if (endDate) {
        query = query.lte('contract_paid_at', endDate);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as AttendeeMatch[];
    },
    enabled: !!dateRange?.from,
  });
  
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
        const channel = detectSalesChannel(t.product_name);
        return channel === selectedChannel.toUpperCase();
      });
    }
    
    // Filtro por closer (via matching com attendees)
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
  }, [transactions, selectedChannel, selectedSource, selectedOriginId, selectedCloserId, searchTerm, attendees]);
  
  // Paginação
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTransactions.slice(start, start + itemsPerPage);
  }, [filteredTransactions, currentPage, itemsPerPage]);
  
  // Reset página ao mudar filtros
  useMemo(() => {
    setCurrentPage(1);
  }, [selectedChannel, selectedSource, selectedOriginId, selectedCloserId, searchTerm, dateRange]);
  
  const handlePageSizeChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };
  
  // Calculate stats from filtered data (usando deduplicação consistente com Transações/Fechamento)
  const stats = useMemo(() => {
    const totalGross = filteredTransactions.reduce((sum, t) => {
      const isFirst = globalFirstIds.has(t.id);
      return sum + getDeduplicatedGross(t, isFirst);
    }, 0);
    const totalNet = filteredTransactions.reduce((sum, t) => sum + (t.net_value || 0), 0);
    const count = filteredTransactions.length;
    const avgTicket = count > 0 ? totalNet / count : 0;
    
    return { totalGross, totalNet, count, avgTicket };
  }, [filteredTransactions, globalFirstIds]);
  
  // Export to Excel
  const handleExportExcel = () => {
    const exportData = filteredTransactions.map(row => ({
      'Data': row.sale_date ? format(parseISO(row.sale_date), 'dd/MM/yyyy', { locale: ptBR }) : '',
      'Produto': row.product_name || '',
      'Canal': detectSalesChannel(row.product_name),
      'Categoria': row.product_category || '',
      'Cliente': row.customer_name || '',
      'Email': row.customer_email || '',
      'Telefone': row.customer_phone || '',
      'Valor Bruto': getDeduplicatedGross(row, globalFirstIds.has(row.id)),
      'Valor Líquido': row.net_value || 0,
      'Parcela': row.installment_number ? `${row.installment_number}/${row.total_installments}` : '-',
      'Status': row.sale_status || '',
      'Fonte': row.source || '',
      'Tags': '',
    }));
    
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
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[180px]">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Período</label>
              <DatePickerCustom
                mode="range"
                selected={dateRange}
                onSelect={(range) => range && setDateRange(range as DateRange)}
                placeholder="Selecione o período"
              />
            </div>
            
            <div className="w-[200px]">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome, email ou telefone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            <div className="w-[120px]">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Fonte</label>
              <Select value={selectedSource} onValueChange={setSelectedSource}>
                <SelectTrigger>
                  <SelectValue placeholder="Fonte" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="hubla">Hubla</SelectItem>
                  <SelectItem value="make">Make</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="w-[160px]">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Closer</label>
              <Select value={selectedCloserId} onValueChange={setSelectedCloserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Closer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {closers.map(closer => (
                    <SelectItem key={closer.id} value={closer.id}>
                      {closer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="w-[160px]">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Pipeline</label>
              <Select value={selectedOriginId} onValueChange={setSelectedOriginId}>
                <SelectTrigger>
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
            </div>
            
            <div className="w-[120px]">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Canal</label>
              <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                <SelectTrigger>
                  <SelectValue placeholder="Canal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="a010">A010</SelectItem>
                  <SelectItem value="bio">BIO</SelectItem>
                  <SelectItem value="live">LIVE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Button onClick={handleExportExcel} disabled={filteredTransactions.length === 0}>
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
                    <TableHead>Data</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right">Valor Bruto</TableHead>
                    <TableHead className="text-right">Valor Líquido</TableHead>
                    <TableHead>Parcela</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {paginatedTransactions.map((row, index) => {
                    const channel = detectSalesChannel(row.product_name);
                    return (
                      <TableRow key={row.id || index}>
                        <TableCell>
                          {row.sale_date 
                            ? format(parseISO(row.sale_date), 'dd/MM/yyyy', { locale: ptBR })
                            : '-'
                          }
                        </TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {row.product_name || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={channel === 'A010' ? 'default' : channel === 'BIO' ? 'secondary' : 'outline'}>
                            {channel}
                          </Badge>
                        </TableCell>
                        <TableCell>{row.customer_name || '-'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.customer_email || '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(row.gross_override || row.product_price || 0)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-success">
                          {formatCurrency(row.net_value || 0)}
                        </TableCell>
                        <TableCell>
                          {row.installment_number 
                            ? `${row.installment_number}/${row.total_installments}`
                            : '-'
                          }
                        </TableCell>
                        <TableCell>
                          <Badge variant={row.sale_status === 'paid' ? 'default' : 'secondary'}>
                            {row.sale_status || '-'}
                          </Badge>
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
