import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePickerCustom } from "@/components/ui/DatePickerCustom";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { 
  useUpdateTransactionDashboardFlag, 
  useUpdateTransactionSaleDate,
  useUpdateMultipleTransactionsDashboardFlag 
} from "@/hooks/useHublaTransactions";
import { useIncorporadorTransactions } from "@/hooks/useIncorporadorTransactions";
import { IncorporadorTransactionDrawer } from "@/components/incorporador/IncorporadorTransactionDrawer";
import { TransactionFormDialog } from "@/components/incorporador/TransactionFormDialog";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { Download, Search, RefreshCw, Filter, CalendarIcon, Eye, ArrowUp, ArrowDown, CheckSquare, XSquare, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Plus, Pencil } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { startOfMonth, startOfWeek, endOfWeek, subWeeks, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { normalizeProductForDedup, getPrecoReferencia } from "@/lib/precosReferencia";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SelectedTransaction {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  product_name: string;
  sale_date: string;
  product_price: number | null;
  net_value: number | null;
  installment_number: number | null;
  total_installments: number | null;
}

type SortField = 'sale_date' | 'net_value' | 'product_price' | 'customer_name';
type SortDirection = 'asc' | 'desc';

export default function TransacoesIncorp() {
  const now = new Date();
  const defaultStart = startOfMonth(now);
  const defaultEnd = now;
  
  const [startDate, setStartDate] = useState<Date | undefined>(defaultStart);
  const [endDate, setEndDate] = useState<Date | undefined>(defaultEnd);
  const [searchTerm, setSearchTerm] = useState("");
  const [showOnlyCountable, setShowOnlyCountable] = useState(false);
  const [hideDuplicates, setHideDuplicates] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState<SelectedTransaction | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  
  // Estados para modal de criar/editar
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingTransaction, setEditingTransaction] = useState<SelectedTransaction | null>(null);
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('sale_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // Filtro para produtos Incorporador 50k
  const { data: transactions, isLoading, refetch } = useIncorporadorTransactions({
    startDate,
    endDate,
    search: searchTerm,
    onlyCountInDashboard: showOnlyCountable,
  });

  const updateFlag = useUpdateTransactionDashboardFlag();
  const updateSaleDate = useUpdateTransactionSaleDate();
  const updateMultipleFlags = useUpdateMultipleTransactionsDashboardFlag();

  const handleToggleCountInDashboard = async (id: string, currentValue: boolean | null) => {
    try {
      await updateFlag.mutateAsync({ 
        id, 
        countInDashboard: !(currentValue ?? true) 
      });
      toast({
        title: "Atualizado",
        description: "Transação atualizada com sucesso",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a transação",
        variant: "destructive",
      });
    }
  };

  const handleDateChange = async (id: string, newDate: Date | undefined) => {
    if (!newDate) return;
    
    try {
      await updateSaleDate.mutateAsync({
        id,
        saleDate: newDate.toISOString(),
      });
      setEditingDateId(null);
      toast({
        title: "Data atualizada",
        description: `Transação movida para ${format(newDate, 'dd/MM/yyyy', { locale: ptBR })}`,
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a data",
        variant: "destructive",
      });
    }
  };

  const handleOpenDetails = (tx: SelectedTransaction) => {
    setSelectedTransaction(tx);
    setDrawerOpen(true);
  };

  const handleOpenCreate = () => {
    setFormMode("create");
    setEditingTransaction(null);
    setFormDialogOpen(true);
  };

  const handleOpenEdit = (tx: SelectedTransaction & { count_in_dashboard?: boolean | null }) => {
    setFormMode("edit");
    setEditingTransaction({
      ...tx,
      count_in_dashboard: tx.count_in_dashboard,
    } as any);
    setFormDialogOpen(true);
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    const pageIds = paginatedTransactions.map(tx => tx.id);
    const allSelected = pageIds.every(id => selectedIds.has(id));
    
    if (allSelected) {
      setSelectedIds(prev => {
        const newSet = new Set(prev);
        pageIds.forEach(id => newSet.delete(id));
        return newSet;
      });
    } else {
      setSelectedIds(prev => new Set([...prev, ...pageIds]));
    }
  };

  const handleBatchMark = async (countInDashboard: boolean) => {
    if (selectedIds.size === 0) return;
    
    try {
      await updateMultipleFlags.mutateAsync({
        ids: Array.from(selectedIds),
        countInDashboard,
      });
      setSelectedIds(new Set());
      toast({
        title: "Atualizado",
        description: `${selectedIds.size} transações ${countInDashboard ? 'marcadas' : 'desmarcadas'} com sucesso`,
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar as transações",
        variant: "destructive",
      });
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1 inline" />
      : <ArrowDown className="h-3 w-3 ml-1 inline" />;
  };

  const displayTransactions = useMemo(() => {
    if (!transactions) return [];
    
    let filtered = transactions.filter(tx => {
      const hublaId = tx.hubla_id || "";
      const isNewsale = hublaId.startsWith("newsale-");
      const isZeroValue = (tx.net_value || 0) < 1;
      if (isNewsale && isZeroValue) return false;
      return true;
    });
    
    if (hideDuplicates) {
      const seen = new Map<string, typeof filtered[0]>();
      filtered.forEach(tx => {
        const key = `${tx.customer_email?.toLowerCase() || ''}-${tx.sale_date?.split('T')[0] || ''}-${Math.round(tx.net_value || 0)}`;
        const existing = seen.get(key);
        if (!existing || 
            (tx.source === 'hubla' && existing.source === 'make') ||
            (tx.count_in_dashboard && !existing.count_in_dashboard)) {
          seen.set(key, tx);
        }
      });
      filtered = Array.from(seen.values());
    }
    
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'sale_date':
          comparison = new Date(a.sale_date || 0).getTime() - new Date(b.sale_date || 0).getTime();
          break;
        case 'net_value':
          comparison = (a.net_value || 0) - (b.net_value || 0);
          break;
        case 'product_price':
          comparison = (a.product_price || 0) - (b.product_price || 0);
          break;
        case 'customer_name':
          comparison = (a.customer_name || '').localeCompare(b.customer_name || '');
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  }, [transactions, hideDuplicates, sortField, sortDirection]);

  // Paginação
  const totalPages = Math.ceil(displayTransactions.length / ITEMS_PER_PAGE);

  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return displayTransactions.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [displayTransactions, currentPage, ITEMS_PER_PAGE]);

  // Reset página quando filtros mudam
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, startDate, endDate, showOnlyCountable, hideDuplicates]);

  // Mapa para identificar duplicatas por email+produto (para mostrar na tabela)
  const duplicateMap = useMemo(() => {
    const map = new Map<string, string>(); // id -> 'original' | 'duplicate'
    const seen = new Map<string, string>(); // key -> first transaction id
    
    displayTransactions.forEach(tx => {
      if ((tx.installment_number || 1) !== 1) return;
      
      const email = tx.customer_email?.toLowerCase() || '';
      const prodNorm = normalizeProductForDedup(tx.product_name);
      const key = `${email}-${prodNorm}`;
      
      if (!seen.has(key)) {
        seen.set(key, tx.id);
        map.set(tx.id, 'original');
      } else {
        map.set(tx.id, 'duplicate');
      }
    });
    
    return map;
  }, [displayTransactions]);

  const totals = useMemo(() => {
    if (!displayTransactions) return { bruto: 0, liquido: 0, count: 0, countable: 0 };
    
    const countable = displayTransactions.filter(tx => tx.count_in_dashboard !== false);
    
    // Deduplicar por email+produto para cálculo do bruto
    const uniqueByEmailProduct = new Map<string, typeof countable[0]>();
    
    countable.forEach(tx => {
      if ((tx.installment_number || 1) !== 1) return; // Só primeira parcela
      
      const email = tx.customer_email?.toLowerCase() || '';
      const prodNorm = normalizeProductForDedup(tx.product_name);
      const key = `${email}-${prodNorm}`;
      
      // Manter apenas a primeira ocorrência com maior valor
      const existing = uniqueByEmailProduct.get(key);
      if (!existing || (tx.product_price || 0) > (existing.product_price || 0)) {
        uniqueByEmailProduct.set(key, tx);
      }
    });
    
    // Calcular bruto usando preços de referência fixos
    let bruto = 0;
    uniqueByEmailProduct.forEach(tx => {
      bruto += getPrecoReferencia(tx.product_name, tx.product_price || 0);
    });
    
    // Líquido soma tudo
    const liquido = countable.reduce((sum, tx) => sum + (tx.net_value || 0), 0);
    
    return {
      bruto,
      liquido,
      count: displayTransactions.length,
      countable: countable.length,
    };
  }, [displayTransactions]);

  const handleExport = () => {
    if (!displayTransactions || displayTransactions.length === 0) {
      toast({ title: "Sem dados", description: "Nenhuma transação para exportar" });
      return;
    }

    const headers = ["Data", "Produto", "Cliente", "Email", "Parcela", "Bruto", "Líquido", "Contar"];
    const rows = displayTransactions.map(tx => [
      formatDate(tx.sale_date),
      tx.product_name,
      tx.customer_name || "",
      tx.customer_email || "",
      tx.installment_number && tx.total_installments 
        ? `${tx.installment_number}/${tx.total_installments}` 
        : "1/1",
      tx.product_price || 0,
      tx.net_value || 0,
      tx.count_in_dashboard !== false ? "Sim" : "Não",
    ]);

    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transacoes-incorporador-${startDate?.toISOString().split("T")[0]}-${endDate?.toISOString().split("T")[0]}.csv`;
    a.click();

    toast({ title: "Exportado", description: "Arquivo CSV gerado com sucesso" });
  };

  const isSomeSelected = selectedIds.size > 0;

  const setLastWeek = () => {
    const lastWeekStart = subWeeks(startOfWeek(now, { weekStartsOn: 6 }), 1);
    const lastWeekEnd = subWeeks(endOfWeek(now, { weekStartsOn: 6 }), 1);
    setStartDate(lastWeekStart);
    setEndDate(lastWeekEnd);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Transações Incorporador</h2>
          <p className="text-muted-foreground mt-1">
            Gerencie quais transações contam no Dashboard (Incorporador 50k)
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button size="sm" onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Transação
          </Button>
        </div>
      </div>

      {isSomeSelected && (
        <Card className="bg-primary/10 border-primary/30">
          <CardContent className="py-3 flex items-center justify-between">
            <span className="text-sm font-medium">
              📋 {selectedIds.size} selecionado{selectedIds.size > 1 ? 's' : ''}
            </span>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => handleBatchMark(true)}
                disabled={updateMultipleFlags.isPending}
              >
                <CheckSquare className="h-4 w-4 mr-2" />
                Marcar no Dash
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => handleBatchMark(false)}
                disabled={updateMultipleFlags.isPending}
              >
                <XSquare className="h-4 w-4 mr-2" />
                Desmarcar
              </Button>
              <Button 
                size="sm" 
                variant="ghost"
                onClick={() => setSelectedIds(new Set())}
              >
                Limpar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total Transações</p>
            <p className="text-2xl font-bold">{totals.count}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Contando no Dash</p>
            <p className="text-2xl font-bold text-green-500">{totals.countable}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Bruto (Contando)</p>
            <p className="text-2xl font-bold">{formatCurrency(totals.bruto)}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Líquido (Contando)</p>
            <p className="text-2xl font-bold text-success">{formatCurrency(totals.liquido)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm text-muted-foreground mb-1 block">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Nome, email ou produto..." 
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Data Início</label>
              <DatePickerCustom 
                mode="single" 
                selected={startDate}
                onSelect={(date) => setStartDate(date as Date | undefined)}
                placeholder="Início" 
              />
            </div>
            
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Data Fim</label>
              <DatePickerCustom 
                mode="single" 
                selected={endDate}
                onSelect={(date) => setEndDate(date as Date | undefined)}
                placeholder="Fim" 
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox 
                id="onlyCountable"
                checked={showOnlyCountable}
                onCheckedChange={(checked) => setShowOnlyCountable(!!checked)}
              />
              <label htmlFor="onlyCountable" className="text-sm cursor-pointer">
                Só contando no Dash
              </label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox 
                id="hideDuplicates"
                checked={hideDuplicates}
                onCheckedChange={(checked) => setHideDuplicates(!!checked)}
              />
              <label htmlFor="hideDuplicates" className="text-sm cursor-pointer">
                Ocultar duplicatas
              </label>
            </div>

            <Button variant="outline" size="sm" onClick={setLastWeek}>
              Semana Anterior
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox 
                    checked={paginatedTransactions.length > 0 && paginatedTransactions.every(tx => selectedIds.has(tx.id))}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('sale_date')}
                >
                  Data <SortIcon field="sale_date" />
                </TableHead>
                <TableHead>Produto</TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('customer_name')}
                >
                  Cliente <SortIcon field="customer_name" />
                </TableHead>
                <TableHead>Parcela</TableHead>
                <TableHead 
                  className="text-right cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('product_price')}
                >
                  Bruto <SortIcon field="product_price" />
                </TableHead>
                <TableHead 
                  className="text-right cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('net_value')}
                >
                  Líquido <SortIcon field="net_value" />
                </TableHead>
                <TableHead className="text-center">No Dash</TableHead>
                <TableHead className="w-20">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={9}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : displayTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nenhuma transação encontrada
                  </TableCell>
                </TableRow>
              ) : (
                paginatedTransactions.map((tx) => (
                  <TableRow key={tx.id} className={cn(
                    tx.count_in_dashboard === false && "opacity-50"
                  )}>
                    <TableCell>
                      <Checkbox 
                        checked={selectedIds.has(tx.id)}
                        onCheckedChange={() => toggleSelection(tx.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <Popover 
                        open={editingDateId === tx.id} 
                        onOpenChange={(open) => setEditingDateId(open ? tx.id : null)}
                      >
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-auto py-1 px-2">
                            <CalendarIcon className="h-3 w-3 mr-1" />
                            {formatDate(tx.sale_date)}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={tx.sale_date ? new Date(tx.sale_date) : undefined}
                            onSelect={(date) => handleDateChange(tx.id, date)}
                            locale={ptBR}
                          />
                        </PopoverContent>
                      </Popover>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[200px] truncate" title={tx.product_name}>
                        {tx.product_name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium truncate max-w-[150px]">{tx.customer_name || '-'}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[150px]">{tx.customer_email || ''}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {tx.installment_number && tx.total_installments
                        ? `${tx.installment_number}/${tx.total_installments}`
                        : "1/1"}
                    </TableCell>
                    <TableCell className="text-right">
                      {(() => {
                        const isDuplicate = duplicateMap.get(tx.id) === 'duplicate';
                        const isFirstInstallment = (tx.installment_number || 1) === 1;
                        
                        if (!isFirstInstallment || isDuplicate) {
                          return (
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-muted-foreground">R$ 0,00</span>
                              {isDuplicate && (
                                <Badge variant="outline" className="text-xs text-orange-500 border-orange-500">
                                  Dup
                                </Badge>
                              )}
                            </div>
                          );
                        }
                        
                        const precoRef = getPrecoReferencia(tx.product_name, tx.product_price || 0);
                        return formatCurrency(precoRef);
                      })()}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(tx.net_value || 0)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={tx.count_in_dashboard !== false}
                        onCheckedChange={() => handleToggleCountInDashboard(tx.id, tx.count_in_dashboard)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit({
                            id: tx.id,
                            customer_name: tx.customer_name,
                            customer_email: tx.customer_email,
                            customer_phone: tx.customer_phone,
                            product_name: tx.product_name,
                            sale_date: tx.sale_date,
                            product_price: tx.product_price,
                            net_value: tx.net_value,
                            installment_number: tx.installment_number,
                            total_installments: tx.total_installments,
                            count_in_dashboard: tx.count_in_dashboard,
                          } as any)}
                          title="Editar transação"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDetails({
                            id: tx.id,
                            customer_name: tx.customer_name,
                            customer_email: tx.customer_email,
                            customer_phone: tx.customer_phone,
                            product_name: tx.product_name,
                            sale_date: tx.sale_date,
                            product_price: tx.product_price,
                            net_value: tx.net_value,
                            installment_number: tx.installment_number,
                            total_installments: tx.total_installments,
                          })}
                          title="Ver detalhes"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          
          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="text-sm text-muted-foreground">
                Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a{' '}
                {Math.min(currentPage * ITEMS_PER_PAGE, displayTransactions.length)} de{' '}
                {displayTransactions.length} transações
              </span>
              
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <span className="text-sm px-3">
                  Página {currentPage} de {totalPages}
                </span>
                
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <IncorporadorTransactionDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        transaction={selectedTransaction}
      />

      <TransactionFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        mode={formMode}
        transaction={editingTransaction as any}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
