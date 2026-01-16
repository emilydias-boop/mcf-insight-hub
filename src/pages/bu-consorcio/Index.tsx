import { useState, useMemo, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Plus, 
  Download, 
  CreditCard, 
  TrendingUp, 
  FileText,
  Filter,
  Eye,
  Edit,
  Trash2,
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

import { Skeleton } from '@/components/ui/skeleton';
import { useConsorcioCards, useConsorcioSummary, useDeleteConsorcioCard } from '@/hooks/useConsorcio';
import { useEmployees } from '@/hooks/useEmployees';
import { ConsorcioCardForm } from '@/components/consorcio/ConsorcioCardForm';
import { ConsorcioCardDrawer } from '@/components/consorcio/ConsorcioCardDrawer';
import { ConsorcioConfigModal } from '@/components/consorcio/ConsorcioConfigModal';
import { STATUS_OPTIONS, CATEGORIA_OPTIONS, ORIGEM_OPTIONS, ConsorcioCard } from '@/types/consorcio';
import { useConsorcioCategoriaOptions, useConsorcioOrigemOptions, useConsorcioTipoOptions } from '@/hooks/useConsorcioConfigOptions';
import { parseDateWithoutTimezone } from '@/lib/dateHelpers';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination';

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(1)}MM`;
  }
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(0)}K`;
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

// Extract first name and last name from full name
function getFirstLastName(fullName?: string): string {
  if (!fullName) return '-';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

// Calculate next due date based on dia_vencimento
function calcularProximoVencimento(diaVencimento: number): Date {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();
  
  // Adjust day to be valid for any month (max 28 for safety, or actual last day)
  const adjustedDay = Math.min(diaVencimento, 28);
  
  let nextDueDate = new Date(currentYear, currentMonth, adjustedDay);
  
  // If the due date has passed this month, move to next month
  if (currentDay > diaVencimento) {
    nextDueDate = new Date(currentYear, currentMonth + 1, adjustedDay);
  }
  
  return nextDueDate;
}

type PeriodType = 'month' | 'lastMonth' | 'custom';

export default function ConsorcioPage() {
  const [period, setPeriod] = useState<PeriodType>('month');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [tipoFilter, setTipoFilter] = useState<string>('todos');
  const [vendedorFilter, setVendedorFilter] = useState<string>('todos');
  const [formOpen, setFormOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<ConsorcioCard | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [configOpen, setConfigOpen] = useState(false);
  const ITEMS_PER_PAGE = 10;

  const { data: employees } = useEmployees();
  const { data: tipoOptions = [] } = useConsorcioTipoOptions();
  const { data: categoriaOptions = [] } = useConsorcioCategoriaOptions();
  const { data: origemOptions = [] } = useConsorcioOrigemOptions();

  // Calculate date range based on period
  const now = new Date();
  let startDate: Date;
  let endDate: Date;

  if (period === 'month') {
    startDate = startOfMonth(now);
    endDate = endOfMonth(now);
  } else if (period === 'lastMonth') {
    const lastMonth = subMonths(now, 1);
    startDate = startOfMonth(lastMonth);
    endDate = endOfMonth(lastMonth);
  } else {
    startDate = startOfMonth(now);
    endDate = endOfMonth(now);
  }

  const filters = {
    startDate,
    endDate,
    status: statusFilter !== 'todos' ? statusFilter : undefined,
    tipoProduto: tipoFilter !== 'todos' ? tipoFilter : undefined,
    vendedorId: vendedorFilter !== 'todos' ? vendedorFilter : undefined,
  };

  const { data: cards, isLoading: cardsLoading } = useConsorcioCards(filters);
  const { data: summary, isLoading: summaryLoading } = useConsorcioSummary({ startDate, endDate });
  const deleteCard = useDeleteConsorcioCard();

  // Sort cards: Data de Contratação (desc) → Cota (desc) → Grupo (asc)
  const sortedCards = useMemo(() => {
    if (!cards) return [];
    return [...cards].sort((a, b) => {
      // 1. Data de contratação (mais recente primeiro)
      const dateCompare = new Date(b.data_contratacao).getTime() - new Date(a.data_contratacao).getTime();
      if (dateCompare !== 0) return dateCompare;

      // 2. Cota (numérico decrescente - maior primeiro)
      const cotaCompare = Number(b.cota) - Number(a.cota);
      if (cotaCompare !== 0) return cotaCompare;

      // 3. Grupo (numérico crescente)
      return Number(a.grupo) - Number(b.grupo);
    });
  }, [cards]);

  // Pagination
  const totalPages = Math.ceil((sortedCards?.length || 0) / ITEMS_PER_PAGE);
  const paginatedCards = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedCards.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [sortedCards, currentPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, tipoFilter, vendedorFilter, period]);

  const handleViewCard = (card: ConsorcioCard) => {
    setSelectedCardId(card.id);
    setDrawerOpen(true);
  };

  const handleEditCard = (card: ConsorcioCard) => {
    setEditingCard(card);
    setFormOpen(true);
  };

  const handleDeleteCard = async (cardId: string) => {
    await deleteCard.mutateAsync(cardId);
  };

  const handleExportCSV = () => {
    if (!sortedCards || sortedCards.length === 0) return;

    const headers = ['Nº', 'Nome', 'Grupo', 'Cota', 'Valor Crédito', 'DT Contratação', 'Vencimento', 'Tipo', 'Categoria', 'Origem', 'Status', 'Responsável', 'Comissão'];
    const rows = sortedCards.map((card, index) => {
      const displayName = card.tipo_pessoa === 'pf' ? card.nome_completo : card.razao_social;
      const proximoVencimento = calcularProximoVencimento(card.dia_vencimento);
      const origemConfig = ORIGEM_OPTIONS.find(o => o.value === card.origem);
      
      return [
        index + 1,
        getFirstLastName(displayName),
        card.grupo,
        card.cota,
        card.valor_credito,
        format(parseDateWithoutTimezone(card.data_contratacao), 'dd/MM/yyyy'),
        format(proximoVencimento, 'dd/MM/yyyy'),
        card.tipo_produto,
        card.categoria === 'inside' ? 'Inside' : 'Life',
        origemConfig?.label || card.origem,
        card.status,
        card.vendedor_name || '',
        card.valor_comissao || 0,
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `consorcio_${format(now, 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">🏠 Consórcio</h1>
          <p className="text-muted-foreground">
            Gestão de cartas de consórcio
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">
                {format(now, 'MMMM yyyy', { locale: ptBR })}
              </SelectItem>
              <SelectItem value="lastMonth">
                {format(subMonths(now, 1), 'MMMM yyyy', { locale: ptBR })}
              </SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => setConfigOpen(true)}>
            <Settings className="h-4 w-4" />
          </Button>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Cota
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Total em Cartas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold">{formatCurrency(summary?.totalCredito || 0)}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Comissão Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold">{formatCurrency(summary?.comissaoTotal || 0)}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Comissão Recebida
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(summary?.comissaoRecebida || 0)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Comissão Pendente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold text-orange-600">
                {formatCurrency(summary?.comissaoPendente || 0)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Cartas Feitas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <p className="text-2xl font-bold">{summary?.totalCartas || 0}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Select / Parcelinha
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold">
                {summary?.cartasSelect || 0} / {summary?.cartasParcelinha || 0}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filtros:</span>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {STATUS_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {tipoOptions.map(opt => (
              <SelectItem key={opt.id} value={opt.name}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={vendedorFilter} onValueChange={setVendedorFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Vendedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {employees?.map(emp => (
              <SelectItem key={emp.id} value={emp.id}>{emp.nome_completo}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <Button variant="outline" onClick={handleExportCSV} disabled={!cards || cards.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">Nº</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="text-center">Grupo</TableHead>
                <TableHead className="text-center">Cota</TableHead>
                <TableHead className="text-right">Valor Crédito</TableHead>
                <TableHead>DT Contratação</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead className="text-right">Comissão</TableHead>
                <TableHead className="w-20">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cardsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={11}>
                      <Skeleton className="h-12 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : paginatedCards && paginatedCards.length > 0 ? (
                paginatedCards.map((card, index) => {
                  const displayName = card.tipo_pessoa === 'pf' ? card.nome_completo : card.razao_social;
                  const statusConfig = STATUS_OPTIONS.find(s => s.value === card.status);
                  const proximoVencimento = calcularProximoVencimento(card.dia_vencimento);
                  // Descending number: total - (page offset + index)
                  const orderNumber = sortedCards.length - ((currentPage - 1) * ITEMS_PER_PAGE + index);

                  return (
                    <TableRow 
                      key={card.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleViewCard(card)}
                    >
                      <TableCell className="text-center font-medium text-muted-foreground">
                        {orderNumber}
                      </TableCell>
                      <TableCell className="font-medium">{getFirstLastName(displayName)}</TableCell>
                      <TableCell className="text-center">{card.grupo}</TableCell>
                      <TableCell className="text-center font-medium">{card.cota}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrencyFull(Number(card.valor_credito))}
                      </TableCell>
                      <TableCell>
                        {format(parseDateWithoutTimezone(card.data_contratacao), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell>
                        {format(proximoVencimento, 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {card.tipo_produto}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const categoriaConfig = categoriaOptions.find(c => c.name === card.categoria) 
                            || CATEGORIA_OPTIONS.find(c => c.value === card.categoria);
                          return categoriaConfig ? (
                            <Badge style={{ backgroundColor: 'color' in categoriaConfig ? categoriaConfig.color : undefined }} className="text-white">
                              {categoriaConfig.label}
                            </Badge>
                          ) : (
                          <span className="text-muted-foreground">-</span>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const origemConfig = origemOptions.find(o => o.name === card.origem) 
                            || ORIGEM_OPTIONS.find(o => o.value === card.origem);
                          return origemConfig ? (
                            <span className="text-sm">{origemConfig.label}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        {statusConfig && (
                          <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                        )}
                      </TableCell>
                      <TableCell>{card.vendedor_name || '-'}</TableCell>
                      <TableCell className="text-right">
                        {card.valor_comissao ? formatCurrencyFull(Number(card.valor_comissao)) : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewCard(card);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditCard(card);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir carta?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação não pode ser desfeita. A carta e todas as suas parcelas serão excluídas permanentemente.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteCard(card.id)}>
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={14} className="text-center py-10 text-muted-foreground">
                    Nenhuma carta encontrada para o período selecionado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, sortedCards.length)} de {sortedCards.length} registros
          </span>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
              
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
                .map((page, idx, arr) => (
                  <span key={page} className="contents">
                    {idx > 0 && arr[idx - 1] !== page - 1 && (
                      <PaginationItem>
                        <PaginationEllipsis />
                      </PaginationItem>
                    )}
                    <PaginationItem>
                      <PaginationLink 
                        isActive={page === currentPage}
                        onClick={() => setCurrentPage(page)}
                        className="cursor-pointer"
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  </span>
                ))}
              
              <PaginationItem>
                <PaginationNext 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Form Dialog */}
      <ConsorcioCardForm 
        open={formOpen} 
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingCard(null);
        }}
        card={editingCard}
      />

      {/* Details Drawer */}
      <ConsorcioCardDrawer 
        cardId={selectedCardId} 
        open={drawerOpen} 
        onOpenChange={setDrawerOpen} 
      />

      {/* Config Modal */}
      <ConsorcioConfigModal 
        open={configOpen} 
        onOpenChange={setConfigOpen} 
      />
    </div>
  );
}
