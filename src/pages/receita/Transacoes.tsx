import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePickerCustom } from "@/components/ui/DatePickerCustom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useHublaTransactionsFiltered, useUpdateTransactionDashboardFlag, useUpdateTransactionSaleDate } from "@/hooks/useHublaTransactions";
import { TransactionDetailsDrawer } from "@/components/receita/TransactionDetailsDrawer";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { Download, Search, RefreshCw, Filter, CalendarIcon, Eye } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { startOfWeek, endOfWeek, subWeeks, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

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

export default function ReceitaTransacoes() {
  const now = new Date();
  const defaultStart = startOfWeek(now, { weekStartsOn: 6 });
  const defaultEnd = endOfWeek(now, { weekStartsOn: 6 });
  
  const [startDate, setStartDate] = useState<Date | undefined>(defaultStart);
  const [endDate, setEndDate] = useState<Date | undefined>(defaultEnd);
  const [searchTerm, setSearchTerm] = useState("");
  const [showOnlyCountable, setShowOnlyCountable] = useState(false);
  const [productCategory, setProductCategory] = useState("all");
  const [selectedTransaction, setSelectedTransaction] = useState<SelectedTransaction | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingDateId, setEditingDateId] = useState<string | null>(null);

  const { data: transactions, isLoading, refetch } = useHublaTransactionsFiltered({
    startDate,
    endDate,
    search: searchTerm,
    onlyCountInDashboard: showOnlyCountable,
    productCategory: productCategory === "all" ? undefined : productCategory,
  });

  const updateFlag = useUpdateTransactionDashboardFlag();
  const updateSaleDate = useUpdateTransactionSaleDate();

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

  const totals = useMemo(() => {
    if (!transactions) return { bruto: 0, liquido: 0, count: 0, countable: 0 };
    
    const countable = transactions.filter(tx => tx.count_in_dashboard !== false);
    return {
      bruto: countable.reduce((sum, tx) => sum + (tx.product_price || 0), 0),
      liquido: countable.reduce((sum, tx) => sum + (tx.net_value || 0), 0),
      count: transactions.length,
      countable: countable.length,
    };
  }, [transactions]);

  const categories = useMemo(() => {
    if (!transactions) return [];
    const cats = new Set(transactions.map(tx => tx.product_category).filter(Boolean));
    return Array.from(cats).sort();
  }, [transactions]);

  const handleExport = () => {
    if (!transactions || transactions.length === 0) {
      toast({ title: "Sem dados", description: "Nenhuma transação para exportar" });
      return;
    }

    const headers = ["Data", "Produto", "Cliente", "Email", "Parcela", "Bruto", "Líquido", "Contar"];
    const rows = transactions.map(tx => [
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
    a.download = `transacoes-${startDate?.toISOString().split("T")[0]}-${endDate?.toISOString().split("T")[0]}.csv`;
    a.click();

    toast({ title: "Exportado", description: "Arquivo CSV gerado com sucesso" });
  };

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
          <h2 className="text-2xl font-bold text-foreground">Transações de Receita</h2>
          <p className="text-muted-foreground mt-1">
            Gerencie quais transações contam no Dashboard
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
        </div>
      </div>

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

            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Categoria</label>
              <Select value={productCategory} onValueChange={setProductCategory}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat!}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

            <Button variant="outline" size="sm" onClick={setLastWeek}>
              Semana Anterior
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card className="bg-card border-border">
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground w-10">
                        Contar
                      </th>
                      <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">
                        Data
                      </th>
                      <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">
                        Produto
                      </th>
                      <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">
                        Cliente
                      </th>
                      <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">
                        Email
                      </th>
                      <th className="text-center py-3 px-2 text-sm font-medium text-muted-foreground">
                        Parcela
                      </th>
                      <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">
                        Bruto
                      </th>
                      <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">
                        Líquido
                      </th>
                      <th className="text-center py-3 px-2 text-sm font-medium text-muted-foreground">
                        Fonte
                      </th>
                      <th className="text-center py-3 px-2 text-sm font-medium text-muted-foreground w-10">
                        
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions?.map((tx) => {
                      const isRecurring = (tx.installment_number || 1) > 1;
                      const isCountable = tx.count_in_dashboard !== false;
                      
                      return (
                        <tr 
                          key={tx.id} 
                          className={cn(
                            "border-b border-border hover:bg-muted/50 transition-colors",
                            !isCountable && 'opacity-50 bg-muted/20',
                            isRecurring && 'bg-yellow-500/5'
                          )}
                        >
                          <td className="py-2 px-2">
                            <Checkbox 
                              checked={isCountable}
                              onCheckedChange={() => handleToggleCountInDashboard(tx.id, tx.count_in_dashboard)}
                              disabled={updateFlag.isPending}
                            />
                          </td>
                          <td className="py-2 px-2 text-sm text-foreground whitespace-nowrap">
                            <Popover 
                              open={editingDateId === tx.id} 
                              onOpenChange={(open) => setEditingDateId(open ? tx.id : null)}
                            >
                              <PopoverTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-7 px-2 font-normal hover:bg-muted"
                                >
                                  <CalendarIcon className="h-3 w-3 mr-1 text-muted-foreground" />
                                  {formatDate(tx.sale_date)}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={new Date(tx.sale_date)}
                                  onSelect={(date) => handleDateChange(tx.id, date)}
                                  locale={ptBR}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          </td>
                          <td className="py-2 px-2 text-sm text-foreground max-w-[200px] truncate" title={tx.product_name}>
                            {tx.product_name}
                          </td>
                          <td className="py-2 px-2 text-sm text-foreground max-w-[150px] truncate font-medium" title={tx.customer_name || ''}>
                            {tx.customer_name || '-'}
                          </td>
                          <td className="py-2 px-2 text-sm text-muted-foreground max-w-[180px] truncate" title={tx.customer_email || ''}>
                            {tx.customer_email || '-'}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <Badge variant={isRecurring ? "secondary" : "outline"} className="text-xs">
                              {tx.installment_number || 1}/{tx.total_installments || 1}
                            </Badge>
                          </td>
                          <td className="py-2 px-2 text-sm text-right font-medium">
                            {formatCurrency(tx.product_price || 0)}
                          </td>
                          <td className="py-2 px-2 text-sm text-right font-medium text-success">
                            {formatCurrency(tx.net_value || 0)}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <Badge variant="outline" className="text-xs capitalize">
                              {tx.source || 'hubla'}
                            </Badge>
                          </td>
                          <td className="py-2 px-2 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
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
                            >
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  Mostrando {transactions?.length || 0} transações
                  {showOnlyCountable ? ' (só contando no dash)' : ''}
                </span>
                <span className="text-xs">
                  Clique na data para editar | Clique no 👁 para ver detalhes
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <TransactionDetailsDrawer 
        transaction={selectedTransaction}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
