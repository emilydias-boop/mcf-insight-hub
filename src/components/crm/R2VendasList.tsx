import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, RefreshCw, Download, Eye, Pencil, Trash2, XCircle, Undo2, Link2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useR2CarrinhoVendas, R2CarrinhoVenda } from '@/hooks/useR2CarrinhoVendas';
import { useUnlinkedTransactions } from '@/hooks/useUnlinkedTransactions';
import { useDeleteTransaction } from '@/hooks/useHublaTransactions';
import { TransactionFormDialog } from '@/components/incorporador/TransactionFormDialog';
import { IncorporadorTransactionDrawer } from '@/components/incorporador/IncorporadorTransactionDrawer';
import { LinkAttendeeDialog } from '@/components/crm/LinkAttendeeDialog';
import { useQueryClient } from '@tanstack/react-query';
import { getDeduplicatedGross } from '@/lib/incorporadorPricing';

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40];

interface R2VendasListProps {
  weekStart: Date;
  weekEnd: Date;
}

const formatCurrency = (value: number | null) => {
  if (value === null || value === undefined) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export function R2VendasList({ weekStart, weekEnd }: R2VendasListProps) {
  const queryClient = useQueryClient();
  const { data: vendas = [], isLoading, refetch } = useR2CarrinhoVendas(weekStart);
  const { data: unlinkedTransactions = [], isLoading: isLoadingUnlinked } = useUnlinkedTransactions(weekStart);
  const deleteTransaction = useDeleteTransaction();

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const [selectedVenda, setSelectedVenda] = useState<R2CarrinhoVenda | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [vendaToDelete, setVendaToDelete] = useState<R2CarrinhoVenda | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [transactionToLink, setTransactionToLink] = useState<{ id: string; name: string } | null>(null);

  // Calcular totais - Bruto exclui itens com excluded_from_cart=true
  const totals = useMemo(() => {
    const brutoTotal = vendas
      .filter(v => !v.excluded_from_cart)
      .reduce((sum, v) => sum + getDeduplicatedGross(v), 0);
    const liquidoTotal = vendas.reduce((sum, v) => sum + (v.net_value || 0), 0);
    return {
      count: vendas.length,
      bruto: brutoTotal,
      liquido: liquidoTotal,
    };
  }, [vendas]);

  // Paginação
  const totalPages = Math.ceil(vendas.length / pageSize);
  const paginatedVendas = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return vendas.slice(start, start + pageSize);
  }, [vendas, currentPage, pageSize]);

  const handleRefresh = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['r2-carrinho-vendas'] });
    queryClient.invalidateQueries({ queryKey: ['unlinked-transactions'] });
  };

  const handleOpenLinkDialog = (id: string, name: string) => {
    setTransactionToLink({ id, name });
    setLinkDialogOpen(true);
  };

  const handleExport = () => {
    if (vendas.length === 0) {
      toast.error('Nenhuma venda para exportar');
      return;
    }

    const headers = ['Data', 'Produto', 'Cliente', 'Email', 'Parcela', 'Bruto', 'Líquido', 'Fonte', 'Closer'];
    const rows = vendas.map((v) => [
      format(new Date(v.sale_date), 'dd/MM/yyyy HH:mm'),
      v.product_name || '',
      v.customer_name || '',
      v.customer_email || '',
      `${v.installment_number || 1}/${v.total_installments || 1}`,
      getDeduplicatedGross(v).toFixed(2),
      (v.net_value || 0).toFixed(2),
      v.source || '',
      v.r2_closer_name || '',
    ]);

    const csvContent = [headers.join(';'), ...rows.map((row) => row.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vendas-r2-carrinho-${format(weekStart, 'dd-MM-yyyy')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado com sucesso!');
  };

  const handleViewDetails = (venda: R2CarrinhoVenda) => {
    setSelectedVenda(venda);
    setDetailsDrawerOpen(true);
  };

  const handleEdit = (venda: R2CarrinhoVenda) => {
    setSelectedVenda(venda);
    setEditDialogOpen(true);
  };

  const handleDelete = (venda: R2CarrinhoVenda) => {
    setVendaToDelete(venda);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!vendaToDelete) return;
    try {
      await deleteTransaction.mutateAsync(vendaToDelete.id);
      toast.success('Transação excluída com sucesso');
      refetch();
    } catch (error) {
      toast.error('Erro ao excluir transação');
    } finally {
      setDeleteDialogOpen(false);
      setVendaToDelete(null);
    }
  };

  const handlePageSizeChange = (value: string) => {
    setPageSize(Number(value));
    setCurrentPage(1);
  };

  // Toggle excluir do carrinho (bruto)
  const handleToggleExcludeFromCart = async (venda: R2CarrinhoVenda) => {
    const newValue = !venda.excluded_from_cart;
    
    const { error } = await supabase
      .from('hubla_transactions')
      .update({ excluded_from_cart: newValue })
      .eq('id', venda.id);
    
    if (error) {
      toast.error('Erro ao atualizar transação');
      console.error('Error toggling exclude:', error);
    } else {
      toast.success(newValue ? 'Transação excluída do carrinho' : 'Transação restaurada no carrinho');
      refetch();
    }
  };

  // Mapear venda para formato esperado pelo drawer
  const mapVendaToTransaction = (venda: R2CarrinhoVenda | null) => {
    if (!venda) return null;
    return {
      id: venda.id,
      hubla_id: venda.hubla_id,
      product_name: venda.product_name || '',
      product_price: venda.product_price,
      net_value: venda.net_value,
      customer_name: venda.customer_name,
      customer_email: venda.customer_email,
      customer_phone: venda.customer_phone,
      sale_date: venda.sale_date,
      installment_number: venda.installment_number,
      total_installments: venda.total_installments,
      source: venda.source,
      gross_override: venda.gross_override,
    };
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            Vendas de Parceria - Semana de {format(weekStart, 'dd/MM', { locale: ptBR })} a {format(weekEnd, 'dd/MM/yyyy', { locale: ptBR })}
          </h3>
          <p className="text-sm text-muted-foreground">
            Transações de parceria vinculadas aos leads aprovados
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setCreateDialogOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Nova Transação
          </Button>
          <Button variant="outline" size="icon" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleExport}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-10 rounded-full bg-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Transações</p>
                <p className="text-2xl font-bold">
                  {isLoading ? '...' : totals.count}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-10 rounded-full bg-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Bruto Total</p>
                <p className="text-2xl font-bold">
                  {isLoading ? '...' : formatCurrency(totals.bruto)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-10 rounded-full bg-emerald-500" />
              <div>
                <p className="text-sm text-muted-foreground">Líquido Total</p>
                <p className="text-2xl font-bold">
                  {isLoading ? '...' : formatCurrency(totals.liquido)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-center">Parcela</TableHead>
                <TableHead className="text-right">Bruto</TableHead>
                <TableHead className="text-right">Líquido</TableHead>
                <TableHead>Fonte</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : paginatedVendas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhuma venda de parceria encontrada para os leads aprovados desta semana
                  </TableCell>
                </TableRow>
              ) : (
                paginatedVendas.map((venda) => (
                  <TableRow 
                    key={venda.id}
                    className={venda.excluded_from_cart ? 'opacity-50' : ''}
                  >
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {format(new Date(venda.sale_date), 'dd/MM/yyyy', { locale: ptBR })}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(venda.sale_date), 'HH:mm')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[200px] truncate" title={venda.product_name || ''}>
                        {venda.product_name || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium truncate max-w-[150px]" title={venda.customer_name || ''}>
                          {venda.customer_name || '-'}
                        </span>
                        {venda.r2_closer_name && (
                          <span 
                            className="text-xs px-1.5 py-0.5 rounded-full w-fit mt-1"
                            style={{ 
                              backgroundColor: venda.r2_closer_color ? `${venda.r2_closer_color}20` : 'hsl(var(--muted))',
                              color: venda.r2_closer_color || 'hsl(var(--muted-foreground))'
                            }}
                          >
                            {venda.r2_closer_name}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">
                        {venda.installment_number || 1}/{venda.total_installments || 1}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {venda.excluded_from_cart ? (
                        <span className="text-muted-foreground line-through">
                          {formatCurrency(getDeduplicatedGross(venda))}
                        </span>
                      ) : (
                        formatCurrency(getDeduplicatedGross(venda))
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium text-emerald-600">
                      {formatCurrency(venda.net_value)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="secondary" className="capitalize">
                          {venda.source || 'hubla'}
                        </Badge>
                        {venda.is_manual_link && (
                          <Badge variant="outline" className="text-blue-500 border-blue-500/50">
                            <Link2 className="h-3 w-3 mr-1" />
                            Manual
                          </Badge>
                        )}
                        {venda.excluded_from_cart && (
                          <Badge variant="outline" className="text-orange-500 border-orange-500/50">
                            Excluído
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleViewDetails(venda)}
                          title="Ver detalhes"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(venda)}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-8 w-8 ${venda.excluded_from_cart ? 'text-orange-500 hover:text-orange-600' : 'text-muted-foreground hover:text-foreground'}`}
                          onClick={() => handleToggleExcludeFromCart(venda)}
                          title={venda.excluded_from_cart ? 'Restaurar no carrinho' : 'Excluir do carrinho (não conta no Bruto)'}
                        >
                          {venda.excluded_from_cart ? <Undo2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                        </Button>
                        {venda.source === 'manual' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(venda)}
                            title="Excluir permanentemente"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Vendas Não Vinculadas */}
      {unlinkedTransactions.length > 0 && (
        <Card className="border-amber-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Vendas Sem Vínculo ({unlinkedTransactions.length})
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Transações de parceria que não deram match automático. Vincule manualmente a um lead aprovado.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Email/Telefone</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Fonte</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingUnlinked ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ) : (
                  unlinkedTransactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {format(new Date(tx.sale_date), 'dd/MM/yyyy', { locale: ptBR })}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(tx.sale_date), 'HH:mm')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {tx.customer_name || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col text-sm text-muted-foreground">
                          {tx.customer_email && <span>{tx.customer_email}</span>}
                          {tx.customer_phone && <span>{tx.customer_phone}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(tx.product_price)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {tx.source || 'hubla'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenLinkDialog(tx.id, tx.customer_name || 'Cliente')}
                        >
                          <Link2 className="h-4 w-4 mr-1" />
                          Vincular
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Paginação */}
      {vendas.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Itens por página:</span>
            <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
              <SelectTrigger className="w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              Mostrando {Math.min((currentPage - 1) * pageSize + 1, vendas.length)} -{' '}
              {Math.min(currentPage * pageSize, vendas.length)} de {vendas.length}
            </span>
          </div>

          {totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
                {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                  const page = i + 1;
                  return (
                    <PaginationItem key={page}>
                      <PaginationLink
                        onClick={() => setCurrentPage(page)}
                        isActive={currentPage === page}
                        className="cursor-pointer"
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      )}

      {/* Dialogs */}
      <TransactionFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        mode="create"
        onSuccess={handleRefresh}
      />

      <TransactionFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        mode="edit"
        transaction={selectedVenda ? mapVendaToTransaction(selectedVenda) : null}
        onSuccess={handleRefresh}
      />

      <IncorporadorTransactionDrawer
        transaction={mapVendaToTransaction(selectedVenda)}
        open={detailsDrawerOpen}
        onOpenChange={setDetailsDrawerOpen}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {transactionToLink && (
        <LinkAttendeeDialog
          open={linkDialogOpen}
          onOpenChange={setLinkDialogOpen}
          transactionId={transactionToLink.id}
          transactionName={transactionToLink.name}
          weekDate={weekStart}
        />
      )}
    </div>
  );
}
