import { useState, useMemo, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Settings,
  Search,
  RefreshCw,
  Copy
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
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useConsorcioCards, useConsorcioSummary, useDeleteConsorcioCard } from '@/hooks/useConsorcio';
import { useRecalculateAllCommissions } from '@/hooks/useRecalculateCommissions';
import { useConsorcioEmployees } from '@/hooks/useEmployees';
import { ConsorcioCardForm } from '@/components/consorcio/ConsorcioCardForm';
import { ConsorcioCardDrawer } from '@/components/consorcio/ConsorcioCardDrawer';
import { ConsorcioConfigModal } from '@/components/consorcio/ConsorcioConfigModal';
import { ConsorcioPeriodFilter, DateRangeFilter } from '@/components/consorcio/ConsorcioPeriodFilter';
import { STATUS_OPTIONS, CATEGORIA_OPTIONS, ORIGEM_OPTIONS, ConsorcioCard } from '@/types/consorcio';
import { PendingRegistrationsList } from '@/components/consorcio/PendingRegistrationsList';
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

// Extract first two names from full name (for Responsável column)
function getFirstTwoNames(fullName?: string): string {
  if (!fullName) return '-';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 2) return fullName.trim();
  return `${parts[0]} ${parts[1]}`;
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
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [vencimentoFilter, setVencimentoFilter] = useState<string>('todos');
  const [grupoFilter, setGrupoFilter] = useState<string>('todos');
  const [origemFilter, setOrigemFilter] = useState<string>('todos');
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter>({
    startDate: undefined,
    endDate: undefined,
    label: 'Período'
  });
  const [formOpen, setFormOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<ConsorcioCard | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [configOpen, setConfigOpen] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [duplicatingCard, setDuplicatingCard] = useState<Partial<ConsorcioCard> | null>(null);

  const { data: employees } = useConsorcioEmployees();
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
    startDate: dateRangeFilter.startDate || startDate,
    endDate: dateRangeFilter.endDate || endDate,
    status: statusFilter !== 'todos' ? statusFilter : undefined,
    tipoProduto: tipoFilter !== 'todos' ? tipoFilter : undefined,
    vendedorId: vendedorFilter !== 'todos' ? vendedorFilter : undefined,
    search: searchTerm || undefined,
    diaVencimento: vencimentoFilter !== 'todos' ? Number(vencimentoFilter) : undefined,
    grupo: grupoFilter !== 'todos' ? grupoFilter : undefined,
    origem: origemFilter !== 'todos' ? origemFilter : undefined,
  };

  const { data: cards, isLoading: cardsLoading } = useConsorcioCards(filters);
  const { data: summary, isLoading: summaryLoading } = useConsorcioSummary({
    startDate: dateRangeFilter.startDate || startDate,
    endDate: dateRangeFilter.endDate || endDate,
  });
  const deleteCard = useDeleteConsorcioCard();
  const recalculateAll = useRecalculateAllCommissions();

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
  const totalPages = Math.ceil((sortedCards?.length || 0) / itemsPerPage);
  const paginatedCards = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedCards.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedCards, currentPage, itemsPerPage]);

  // Get unique groups for filter dropdown
  const uniqueGrupos = useMemo(() => {
    if (!cards) return [];
    const grupos = [...new Set(cards.map(c => c.grupo))];
    return grupos.sort((a, b) => Number(a) - Number(b));
  }, [cards]);

  // Get unique vencimento days for filter dropdown
  const uniqueVencimentos = useMemo(() => {
    if (!cards) return [];
    const dias = [...new Set(cards.map(c => c.dia_vencimento))];
    return dias.sort((a, b) => a - b);
  }, [cards]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, tipoFilter, vendedorFilter, period, itemsPerPage, searchTerm, vencimentoFilter, grupoFilter, origemFilter, dateRangeFilter]);

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

  const handleDuplicateCard = (card: ConsorcioCard) => {
    const personalData: Partial<ConsorcioCard> = {
      tipo_pessoa: card.tipo_pessoa,
      categoria: card.categoria,
      origem: card.origem,
      origem_detalhe: card.origem_detalhe,
      vendedor_id: card.vendedor_id,
      vendedor_name: card.vendedor_name,
      tipo_produto: card.tipo_produto,
      observacoes: card.observacoes,
      // PF
      nome_completo: card.nome_completo,
      cpf: card.cpf,
      rg: card.rg,
      data_nascimento: card.data_nascimento,
      estado_civil: card.estado_civil,
      cpf_conjuge: card.cpf_conjuge,
      endereco_cep: card.endereco_cep,
      endereco_rua: card.endereco_rua,
      endereco_numero: card.endereco_numero,
      endereco_complemento: card.endereco_complemento,
      endereco_bairro: card.endereco_bairro,
      endereco_cidade: card.endereco_cidade,
      endereco_estado: card.endereco_estado,
      telefone: card.telefone,
      email: card.email,
      profissao: card.profissao,
      tipo_servidor: card.tipo_servidor,
      renda: card.renda,
      patrimonio: card.patrimonio,
      pix: card.pix,
      // PJ
      razao_social: card.razao_social,
      cnpj: card.cnpj,
      natureza_juridica: card.natureza_juridica,
      inscricao_estadual: card.inscricao_estadual,
      data_fundacao: card.data_fundacao,
      endereco_comercial_cep: card.endereco_comercial_cep,
      endereco_comercial_rua: card.endereco_comercial_rua,
      endereco_comercial_numero: card.endereco_comercial_numero,
      endereco_comercial_complemento: card.endereco_comercial_complemento,
      endereco_comercial_bairro: card.endereco_comercial_bairro,
      endereco_comercial_cidade: card.endereco_comercial_cidade,
      endereco_comercial_estado: card.endereco_comercial_estado,
      telefone_comercial: card.telefone_comercial,
      email_comercial: card.email_comercial,
      faturamento_mensal: card.faturamento_mensal,
      num_funcionarios: card.num_funcionarios,
      e_transferencia: card.e_transferencia,
      transferido_de: card.transferido_de,
    };
    setDuplicatingCard(personalData);
    setFormOpen(true);
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
        displayName || '-',
        card.grupo,
        card.cota,
        card.valor_credito,
        format(parseDateWithoutTimezone(card.data_contratacao), 'dd/MM/yyyy'),
        format(proximoVencimento, 'dd/MM/yyyy'),
        card.tipo_produto,
        card.categoria === 'inside' ? 'Inside' : 'Life',
        origemConfig?.label || card.origem,
        card.status,
        getFirstTwoNames(card.vendedor_name),
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
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => recalculateAll.mutate()}
            disabled={recalculateAll.isPending}
            title="Recalcular todas as comissões"
          >
            <RefreshCw className={`h-4 w-4 ${recalculateAll.isPending ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setConfigOpen(true)}>
            <Settings className="h-4 w-4" />
          </Button>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Cota
          </Button>
        </div>
      </div>

      <Tabs defaultValue="cotas" className="space-y-6">
        <TabsList>
          <TabsTrigger value="cotas">Cotas</TabsTrigger>
          <TabsTrigger value="pendentes">Cadastros Pendentes</TabsTrigger>
        </TabsList>

        <TabsContent value="cotas" className="space-y-6">
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
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Nome, telefone ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 w-64"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-28">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Status</SelectItem>
            {STATUS_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="w-28">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Tipo</SelectItem>
            {tipoOptions.map(opt => (
              <SelectItem key={opt.id} value={opt.name}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={vendedorFilter} onValueChange={setVendedorFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Vendedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Vendedor</SelectItem>
            {employees?.map(emp => (
              <SelectItem key={emp.id} value={emp.id}>{emp.nome_completo}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={vencimentoFilter} onValueChange={setVencimentoFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Vencimento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Vencimento</SelectItem>
            {uniqueVencimentos.map(dia => (
              <SelectItem key={dia} value={String(dia)}>Dia {dia}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={grupoFilter} onValueChange={setGrupoFilter}>
          <SelectTrigger className="w-28">
            <SelectValue placeholder="Grupo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Grupo</SelectItem>
            {uniqueGrupos.map(grupo => (
              <SelectItem key={grupo} value={grupo}>{grupo}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={origemFilter} onValueChange={setOrigemFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Origem</SelectItem>
            {origemOptions.map(opt => (
              <SelectItem key={opt.id} value={opt.name}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <ConsorcioPeriodFilter 
          value={dateRangeFilter} 
          onChange={setDateRangeFilter} 
        />

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
                  const orderNumber = sortedCards.length - ((currentPage - 1) * itemsPerPage + index);

                  return (
                    <TableRow 
                      key={card.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleViewCard(card)}
                    >
                      <TableCell className="text-center font-medium text-muted-foreground">
                        {orderNumber}
                      </TableCell>
                      <TableCell className="font-medium">{displayName || '-'}</TableCell>
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
                      <TableCell>{getFirstTwoNames(card.vendedor_name)}</TableCell>
                      <TableCell className="text-right">
                        {card.valor_comissao_total ? formatCurrencyFull(card.valor_comissao_total) : '-'}
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
                          <Button 
                            variant="ghost" 
                            size="icon"
                            title="Duplicar carta"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicateCard(card);
                            }}
                          >
                            <Copy className="h-4 w-4" />
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
      {sortedCards.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Select 
              value={itemsPerPage.toString()} 
              onValueChange={(v) => {
                setItemsPerPage(Number(v));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-24 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 / pág</SelectItem>
                <SelectItem value="12">12 / pág</SelectItem>
                <SelectItem value="25">25 / pág</SelectItem>
                <SelectItem value="50">50 / pág</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, sortedCards.length)} de {sortedCards.length} registros
            </span>
          </div>
          {totalPages > 1 && (
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
          )}
        </div>
      )}

      {/* Form Dialog */}
      <ConsorcioCardForm 
        open={formOpen} 
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setEditingCard(null);
            setDuplicatingCard(null);
          }
        }}
        card={editingCard}
        duplicateFrom={duplicatingCard}
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
        </TabsContent>

        <TabsContent value="pendentes">
          <PendingRegistrationsList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
