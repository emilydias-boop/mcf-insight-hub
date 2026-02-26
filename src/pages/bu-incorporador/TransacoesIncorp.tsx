import { useState, useMemo } from 'react';
import { format, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { RefreshCw, Download, Search, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Plus, Filter, Users, Rocket } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGestorClosers } from '@/hooks/useGestorClosers';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePickerCustom } from '@/components/ui/DatePickerCustom';
import { TransactionFormDialog } from '@/components/incorporador/TransactionFormDialog';
import { IncorporadorTransactionDrawer } from '@/components/incorporador/IncorporadorTransactionDrawer';
import { ProductFilterSheet } from '@/components/incorporador/ProductFilterSheet';
import { BulkLaunchTagDialog } from '@/components/incorporador/BulkLaunchTagDialog';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { TransactionFilters, HublaTransaction } from '@/hooks/useAllHublaTransactions';
import { useTransactionsByBU } from '@/hooks/useTransactionsByBU';
import { useDeleteTransaction } from '@/hooks/useHublaTransactions';
import { formatCurrency } from '@/lib/formatters';
import { getDeduplicatedGross } from '@/lib/incorporadorPricing';
import { TransactionGroupRow, groupTransactionsByPurchase } from '@/components/incorporador/TransactionGroupRow';

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40];

export default function TransacoesIncorp() {
  // Filtros - inicia com o mês atual para evitar carregar toda a base
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<HublaTransaction | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [productFilterOpen, setProductFilterOpen] = useState(false);
  const [selectedCloserId, setSelectedCloserId] = useState<string>('all');
  const [bulkLaunchOpen, setBulkLaunchOpen] = useState(false);
  const [saleOriginFilter, setSaleOriginFilter] = useState<string>('all');

  const deleteMutation = useDeleteTransaction();
  
  // Closers disponíveis para filtro
  // Closers R1 apenas (Julio, Cristiane, Thayna)
  const { data: closers = [] } = useGestorClosers('r1');

  // Query com filtros
  const filters: TransactionFilters = {
    search: searchTerm || undefined,
    startDate,
    endDate,
    selectedProducts: selectedProducts.length > 0 ? selectedProducts : undefined,
  };

  const { data: allTransactions = [], isLoading, refetch, isFetching } = useTransactionsByBU('incorporador', filters);

  // Buscar IDs de primeira compra GLOBAL via RPC (consistente com Dashboard)
  const { data: globalFirstIds = new Set<string>() } = useQuery({
    queryKey: ['global-first-transaction-ids'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_first_transaction_ids');
      if (error) throw error;
      return new Set((data || []).map((r: { id: string }) => r.id));
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  // Attendees R1 para matching - busca TODOS os status (não apenas contract_paid)
  // para atribuir vendas ao closer R1 independente do tipo de produto
  const { data: attendees = [] } = useQuery({
    queryKey: ['r1-attendees-for-matching', startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      if (!startDate) return [];
      
      // Buscar período expandido (30 dias antes) para capturar leads
      // que fizeram R1 antes e compraram no período
      const expandedStart = new Date(startDate);
      expandedStart.setDate(expandedStart.getDate() - 30);
      
      const { data, error } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          id, 
          attendee_phone, 
          deal_id,
          meeting_slots!inner(closer_id, meeting_type),
          crm_deals!deal_id(crm_contacts!contact_id(email, phone))
        `)
        .eq('meeting_slots.meeting_type', 'r1')
        .gte('meeting_slots.scheduled_at', expandedStart.toISOString())
        .in('status', ['scheduled', 'invited', 'completed', 'contract_paid', 'rescheduled', 'no_show']);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!startDate,
  });

  // Produtos já são filtrados no RPC - usar diretamente
  const transactions = allTransactions;
  
  // Filtrar por closer (via matching com attendees - email, telefone ou linked_attendee_id)
  const filteredByCloser = useMemo(() => {
    let txs = transactions;
    
    // Filter by sale_origin
    if (saleOriginFilter !== 'all') {
      if (saleOriginFilter === 'uncategorized') {
        txs = txs.filter(t => !t.sale_origin);
      } else {
        txs = txs.filter(t => t.sale_origin === saleOriginFilter);
      }
    }
    
    if (selectedCloserId === 'all') return txs;
    
    const closerAttendees = attendees.filter((a: any) => 
      a.meeting_slots?.closer_id === selectedCloserId
    );
    
    const closerAttendeeIds = new Set(
      closerAttendees.map((a: any) => a.id)
    );
    
    const closerEmails = new Set(
      closerAttendees
        .map((a: any) => a.crm_deals?.crm_contacts?.email?.toLowerCase())
        .filter(Boolean)
    );
    
    const closerPhones = new Set(
      closerAttendees
        .map((a: any) => (a.crm_deals?.crm_contacts?.phone || '').replace(/\D/g, ''))
        .filter((p: string) => p.length >= 8)
    );
    
    return txs.filter(t => {
      const txEmail = (t.customer_email || '').toLowerCase();
      const txPhone = (t.customer_phone || '').replace(/\D/g, '');
      
      const emailMatch = closerEmails.has(txEmail);
      const phoneMatch = txPhone.length >= 8 && closerPhones.has(txPhone);
      const linkedMatch = t.linked_attendee_id && closerAttendeeIds.has(t.linked_attendee_id);
      
      return emailMatch || phoneMatch || linkedMatch;
    });
  }, [transactions, selectedCloserId, attendees, saleOriginFilter]);

  // Agrupa transações por compra (parent + order bumps)
  const transactionGroups = useMemo(() => {
    return groupTransactionsByPurchase(filteredByCloser, globalFirstIds);
  }, [filteredByCloser, globalFirstIds]);

  // Paginação por grupos
  const totalPages = Math.ceil(transactionGroups.length / itemsPerPage);
  const paginatedGroups = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return transactionGroups.slice(start, start + itemsPerPage);
  }, [transactionGroups, currentPage, itemsPerPage]);

  // Totais - Bruto usa deduplicação GLOBAL (consistente com Dashboard)
  const totals = useMemo(() => {
    let bruto = 0;
    let liquido = 0;

    transactionGroups.forEach(group => {
      bruto += group.totalGross;
      liquido += group.totalNet;
    });

    return { count: filteredByCloser.length, bruto, liquido };
  }, [transactionGroups, filteredByCloser]);

  // Handlers
  const handleRefresh = async () => {
    await refetch();
    toast.success('Dados atualizados!');
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setStartDate(undefined);
    setEndDate(undefined);
    setSelectedProducts([]);
    setSelectedCloserId('all');
    setSaleOriginFilter('all');
    setCurrentPage(1);
  };

  const handleExport = () => {
    if (filteredByCloser.length === 0) {
      toast.error('Nenhuma transação para exportar');
      return;
    }

    const headers = ['Data', 'Produto', 'Cliente', 'Email', 'Parcela', 'Bruto', 'Líquido', 'Fonte', 'Tipo', 'Duplicado'];
    const rows = filteredByCloser.map(t => {
      const isFirst = globalFirstIds.has(t.id);
      return [
        t.sale_date ? format(new Date(t.sale_date), 'dd/MM/yyyy HH:mm') : '',
        t.product_name || '',
        t.customer_name || '',
        t.customer_email || '',
        t.installment_number && t.total_installments ? `${t.installment_number}/${t.total_installments}` : '1/1',
        getDeduplicatedGross(t, isFirst).toFixed(2),
        t.net_value?.toFixed(2) || '0',
        t.source || '',
        isFirst ? 'Novo' : 'Recorrente',
        isFirst ? 'Não' : 'Sim',
      ];
    });

    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vendas-mcf-incorporador-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exportação concluída!');
  };

  const handleExportParcerias = async () => {
    toast.info('Buscando transações Parceria...');
    const { data, error } = await supabase
      .from('hubla_transactions')
      .select('*')
      .ilike('product_name', 'parceria')
      .gte('sale_date', '2026-02-01')
      .lt('sale_date', '2026-02-20')
      .order('sale_date', { ascending: true });

    if (error) {
      toast.error('Erro ao buscar: ' + error.message);
      return;
    }
    if (!data || data.length === 0) {
      toast.error('Nenhuma transação Parceria encontrada');
      return;
    }

    const headers = ['Cliente', 'Email', 'Telefone', 'Data Venda', 'Valor Pago (Bruto Atual)', 'Valor Liquido', 'Parcela', 'Total Parcelas', 'Gross Override', 'Hubla ID', 'Produto Real', 'Bruto Correto', 'Observacoes'];
    const rows = data.map((t: any) => [
      t.customer_name || '',
      t.customer_email || '',
      t.customer_phone || '',
      t.sale_date ? format(new Date(t.sale_date), 'dd/MM/yyyy HH:mm') : '',
      t.product_price?.toFixed(2) || '0',
      t.net_value?.toFixed(2) || '0',
      t.installment_number || '1',
      t.total_installments || '1',
      t.gross_override?.toFixed(2) || '',
      t.hubla_id || t.id || '',
      '', // Produto Real - vazio para preencher
      '', // Bruto Correto - vazio para preencher
      '', // Observações - vazio para preencher
    ]);

    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `parcerias-fevereiro-2026.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${data.length} transações Parceria exportadas!`);
  };

  // Reset página ao mudar filtros
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleStartDateChange = (date: Date | undefined) => {
    setStartDate(date);
    setCurrentPage(1);
  };

  const handleEndDateChange = (date: Date | undefined) => {
    setEndDate(date);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  const handleViewDetails = (transaction: HublaTransaction) => {
    setSelectedTransaction(transaction);
    setDetailsDrawerOpen(true);
  };

  const handleEdit = (transaction: HublaTransaction) => {
    setSelectedTransaction(transaction);
    setEditDialogOpen(true);
  };

  const handleDelete = (transaction: HublaTransaction) => {
    setSelectedTransaction(transaction);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (selectedTransaction) {
      try {
        await deleteMutation.mutateAsync(selectedTransaction.id);
        setDeleteDialogOpen(false);
        setSelectedTransaction(null);
        toast.success('Transação excluída!');
        // Aguarda um tick para garantir que o cache foi invalidado
        await refetch();
      } catch (error) {
        console.error('Erro ao excluir:', error);
        toast.error('Erro ao excluir transação');
      }
    }
  };

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Vendas MCF INCORPORADOR</h1>
            <p className="text-muted-foreground">Todas as vendas da plataforma Hubla</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setBulkLaunchOpen(true)} variant="outline">
              <Rocket className="h-4 w-4 mr-2" />
              Marcar Launch
            </Button>
            <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Transação
            </Button>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportParcerias} className="border-amber-500 text-amber-700 hover:bg-amber-50">
              <Download className="h-4 w-4 mr-2" />
              Exportar Parcerias
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Buscar</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Nome, email ou produto..."
                    value={searchTerm}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="w-full sm:w-48">
                <label className="text-sm font-medium mb-2 block">Data Inicial</label>
                <DatePickerCustom
                  selected={startDate}
                  onSelect={handleStartDateChange}
                  placeholder="Selecione..."
                />
              </div>
              <div className="w-full sm:w-48">
                <label className="text-sm font-medium mb-2 block">Data Final</label>
                <DatePickerCustom
                  selected={endDate}
                  onSelect={handleEndDateChange}
                  placeholder="Selecione..."
                />
              </div>
              <div className="w-full sm:w-48">
                <label className="text-sm font-medium mb-2 block">Closer</label>
                <Select value={selectedCloserId} onValueChange={(v) => {
                  setSelectedCloserId(v);
                  setCurrentPage(1);
                }}>
                  <SelectTrigger>
                    <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Todos" />
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
              <div className="w-full sm:w-40">
                <label className="text-sm font-medium mb-2 block">Origem</label>
                <Select value={saleOriginFilter} onValueChange={(v) => {
                  setSaleOriginFilter(v);
                  setCurrentPage(1);
                }}>
                  <SelectTrigger>
                    <Rocket className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="launch">🚀 Lançamento</SelectItem>
                    <SelectItem value="closer">Closer</SelectItem>
                    <SelectItem value="outside">Outside</SelectItem>
                    <SelectItem value="uncategorized">Sem categoria</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button 
                  variant="outline" 
                  onClick={() => setProductFilterOpen(true)}
                  className="relative"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Produtos
                  {selectedProducts.length > 0 && (
                    <Badge variant="default" className="ml-2 h-5 px-1.5 text-xs">
                      {selectedProducts.length}
                    </Badge>
                  )}
                </Button>
              </div>
              <Button variant="ghost" size="icon" onClick={handleClearFilters} title="Limpar filtros">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Cards de Resumo */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm font-medium text-muted-foreground">Total de Transações</div>
              <div className="text-2xl font-bold">{totals.count.toLocaleString('pt-BR')}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm font-medium text-muted-foreground">Bruto Total</div>
              <div className="text-2xl font-bold">{formatCurrency(totals.bruto)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm font-medium text-muted-foreground">Líquido Total</div>
              <div className="text-2xl font-bold text-primary">{formatCurrency(totals.liquido)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabela */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">Data</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="w-24 text-center">Parcela</TableHead>
                    <TableHead className="w-28 text-right">Bruto</TableHead>
                    <TableHead className="w-28 text-right">Líquido</TableHead>
                    <TableHead className="w-24">Fonte</TableHead>
                    <TableHead className="w-24 text-center">Tipo</TableHead>
                    <TableHead className="w-20">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16 mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      </TableRow>
                    ))
                  ) : paginatedGroups.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                        Nenhuma transação encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedGroups.map((group) => (
                      <TransactionGroupRow
                        key={group.id}
                        group={group}
                        globalFirstIds={globalFirstIds}
                        onViewDetails={handleViewDetails}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Paginação */}
            {transactionGroups.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between border-t px-4 py-3 gap-3">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Mostrar</span>
                    <Select value={itemsPerPage.toString()} onValueChange={handlePageSizeChange}>
                      <SelectTrigger className="w-[70px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAGE_SIZE_OPTIONS.map((size) => (
                          <SelectItem key={size} value={size.toString()}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-muted-foreground">grupos por página</span>
                  </div>
                  <div className="text-sm text-muted-foreground hidden md:block">
                    {transactionGroups.length.toLocaleString('pt-BR')} grupos ({filteredByCloser.length.toLocaleString('pt-BR')} transações)
                  </div>
                </div>
                {totalPages > 1 && (
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
                      Página {currentPage} de {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <TransactionFormDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          mode="create"
          onSuccess={() => refetch()}
        />

        <TransactionFormDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          mode="edit"
          transaction={selectedTransaction}
          onSuccess={() => {
            refetch();
            setSelectedTransaction(null);
          }}
        />

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir transação?</AlertDialogTitle>
              <AlertDialogDescription>
                Essa ação não pode ser desfeita. A transação de {selectedTransaction?.customer_name} será permanentemente removida.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={confirmDelete} 
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <IncorporadorTransactionDrawer
          transaction={selectedTransaction}
          open={detailsDrawerOpen}
          onOpenChange={setDetailsDrawerOpen}
        />

        <ProductFilterSheet
          open={productFilterOpen}
          onOpenChange={setProductFilterOpen}
          selectedProducts={selectedProducts}
          onApply={(products) => {
            setSelectedProducts(products);
            setCurrentPage(1);
          }}
        />

        <BulkLaunchTagDialog
          open={bulkLaunchOpen}
          onOpenChange={setBulkLaunchOpen}
          onSuccess={() => refetch()}
        />
    </div>
  );
}
