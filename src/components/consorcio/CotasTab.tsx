import { useState, useMemo, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
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
  Copy,
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
import { AlertDialogTrigger } from '@/components/ui/alert-dialog';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination';
import { useConsorcioCards, useConsorcioSummary, useDeleteConsorcioCard } from '@/hooks/useConsorcio';
import { useRecalculateAllCommissions } from '@/hooks/useRecalculateCommissions';
import { useConsorcioEmployees } from '@/hooks/useEmployees';
import { useConsorcioCotasOrigem, useConsorcioCardCreators } from '@/hooks/useConsorcioCotasOrigem';
import { useAuth } from '@/contexts/AuthContext';
import { ConsorcioCardForm } from '@/components/consorcio/ConsorcioCardForm';
import { ConsorcioCardDrawer } from '@/components/consorcio/ConsorcioCardDrawer';
import { DeleteCartaDialog } from '@/components/consorcio/DeleteCartaDialog';
import { ConsorcioConfigModal } from '@/components/consorcio/ConsorcioConfigModal';
import { STATUS_OPTIONS, ORIGEM_OPTIONS, ConsorcioCard } from '@/types/consorcio';
import {
  useConsorcioCategoriaOptions,
  useConsorcioOrigemOptions,
  useConsorcioTipoOptions,
} from '@/hooks/useConsorcioConfigOptions';
import { parseDateWithoutTimezone } from '@/lib/dateHelpers';

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

  const adjustedDay = Math.min(diaVencimento, 28);

  let nextDueDate = new Date(currentYear, currentMonth, adjustedDay);

  if (currentDay > diaVencimento) {
    nextDueDate = new Date(currentYear, currentMonth + 1, adjustedDay);
  }

  return nextDueDate;
}

interface CotasTabProps {
  /** Período global do funil (eixo: data_contratacao) — controlado pela página. */
  range?: { startDate?: Date; endDate?: Date };
  /** Selo da timeline: mostrar só as cotas originadas no funil. */
  onlyDoFunil?: boolean;
  /** Selo da timeline: mostrar só as cotas SEM vínculo com o funil. */
  onlyExternas?: boolean;
  onClearQuickFilter?: () => void;
}

export function CotasTab({ range, onlyDoFunil, onlyExternas, onClearQuickFilter }: CotasTabProps) {
  const { role } = useAuth();
  const canRecalculate = role === 'admin' || role === 'coordenador';

  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [tipoFilter, setTipoFilter] = useState<string>('todos');
  const [vendedorFilter, setVendedorFilter] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [vencimentoFilter, setVencimentoFilter] = useState<string>('todos');
  const [grupoFilter, setGrupoFilter] = useState<string>('todos');
  const [origemFilter, setOrigemFilter] = useState<string>('todos');
  const [objetivoFilter, setObjetivoFilter] = useState<string>('todos');
  const [formOpen, setFormOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);
  const [editingCard, setEditingCard] = useState<ConsorcioCard | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [configOpen, setConfigOpen] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [duplicatingCard, setDuplicatingCard] = useState<Partial<ConsorcioCard> | null>(null);
  const [recalcOpen, setRecalcOpen] = useState(false);

  const { data: employees } = useConsorcioEmployees();
  const { data: tipoOptions = [] } = useConsorcioTipoOptions();
  const { data: categoriaOptions = [] } = useConsorcioCategoriaOptions();
  const { data: origemOptions = [] } = useConsorcioOrigemOptions();

  const now = new Date();
  // Período vem do filtro global da timeline do funil.
  const resolvedDateRange = {
    startDate: range?.startDate,
    endDate: range?.endDate,
  };

  const filters = {
    startDate: resolvedDateRange.startDate,
    endDate: resolvedDateRange.endDate,
    status: statusFilter !== 'todos' ? statusFilter : undefined,
    tipoProduto: tipoFilter !== 'todos' ? tipoFilter : undefined,
    vendedorId: vendedorFilter !== 'todos' ? vendedorFilter : undefined,
    search: searchTerm || undefined,
    diaVencimento: vencimentoFilter !== 'todos' ? Number(vencimentoFilter) : undefined,
    grupo: grupoFilter !== 'todos' ? grupoFilter : undefined,
    origem: origemFilter !== 'todos' ? origemFilter : undefined,
    objetivo: objetivoFilter !== 'todos' ? (objetivoFilter as 'auto' | 'imovel') : undefined,
  };

  const { data: cards, isLoading: cardsLoading } = useConsorcioCards(filters);
  const { data: summary, isLoading: summaryLoading } = useConsorcioSummary({
    startDate: resolvedDateRange.startDate,
    endDate: resolvedDateRange.endDate,
  });
  const deleteCard = useDeleteConsorcioCard();
  const recalculateAll = useRecalculateAllCommissions();
  const { data: funnelCardIds } = useConsorcioCotasOrigem();

  // Sort cards: Data de Contratação (desc) -> Cota (desc) -> Grupo (asc)
  const sortedCards = useMemo(() => {
    if (!cards) return [];
    let base = cards;
    if (funnelCardIds) {
      if (onlyDoFunil) base = cards.filter((c) => funnelCardIds.has(c.id));
      else if (onlyExternas) base = cards.filter((c) => !funnelCardIds.has(c.id));
    }
    return [...base].sort((a, b) => {
      const dateCompare = new Date(b.data_contratacao).getTime() - new Date(a.data_contratacao).getTime();
      if (dateCompare !== 0) return dateCompare;

      const cotaCompare = Number(b.cota) - Number(a.cota);
      if (cotaCompare !== 0) return cotaCompare;

      return Number(a.grupo) - Number(b.grupo);
    });
  }, [cards, onlyDoFunil, onlyExternas, funnelCardIds]);

  // "Criada por": `consortium_cards` não tem coluna de autoria — usamos o
  // actor_name do primeiro evento de `consortium_card_activity_log`.
  const { data: creators } = useConsorcioCardCreators(
    useMemo(() => sortedCards.map((c: any) => c.id), [sortedCards]),
  );

  /** Quebra nominal das cotas externas (para cobrança da equipe). */
  const externasBreakdown = useMemo(() => {
    if (!onlyExternas) return null;
    const byVendedor = new Map<string, number>();
    const byOrigem = new Map<string, number>();
    sortedCards.forEach((c: any) => {
      const v = (c.vendedor_name || '').trim() || 'sem vendedor';
      byVendedor.set(v, (byVendedor.get(v) || 0) + 1);
      const o = (c.origem || '').trim() || 'sem origem';
      const label = ORIGEM_OPTIONS.find((x) => x.value === o)?.label || o;
      byOrigem.set(label, (byOrigem.get(label) || 0) + 1);
    });
    const fmt = (m: Map<string, number>) =>
      Array.from(m.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k} ${v}`)
        .join(' · ');
    return { vendedores: fmt(byVendedor), origens: fmt(byOrigem) };
  }, [onlyExternas, sortedCards]);

  const totalPages = Math.ceil((sortedCards?.length || 0) / itemsPerPage);
  const paginatedCards = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedCards.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedCards, currentPage, itemsPerPage]);

  const uniqueGrupos = useMemo(() => {
    if (!cards) return [];
    const grupos = [...new Set(cards.map(c => c.grupo))];
    return grupos.sort((a, b) => Number(a) - Number(b));
  }, [cards]);

  const uniqueVencimentos = useMemo(() => {
    if (!cards) return [];
    const dias = [...new Set(cards.map(c => c.dia_vencimento))];
    return dias.sort((a, b) => a - b);
  }, [cards]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, tipoFilter, vendedorFilter, range?.startDate, range?.endDate, itemsPerPage, searchTerm, vencimentoFilter, grupoFilter, origemFilter, objetivoFilter]);

  const handleViewCard = (card: ConsorcioCard) => {
    setSelectedCardId(card.id);
    setDrawerOpen(true);
  };

  const handleEditCard = (card: ConsorcioCard) => {
    setEditingCard(card);
    setFormOpen(true);
  };

  const handleDeleteCard = async (cardId: string, motivo: string) => {
    await deleteCard.mutateAsync({ cardId, motivo });
    setDeletingCardId(null);
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

    const esc = (v: any) => {
      if (v === null || v === undefined || v === '') return '';
      const s = String(v).replace(/"/g, '""');
      return /[",;\n\r]/.test(s) ? `"${s}"` : s;
    };
    const fmtDate = (d: any) => (d ? format(parseDateWithoutTimezone(d), 'dd/MM/yyyy') : '');

    const headers = [
      'Nº', 'Status', 'Tipo Pessoa', 'Categoria', 'Origem', 'Origem Detalhe', 'Tipo Produto', 'Objetivo',
      // Cota
      'Grupo', 'Cota', 'Valor Crédito', 'Dia Vencimento', 'Próximo Vencimento', 'DT Reserva', 'DT Contratação',
      'Valor Parcela', 'Parcelas Pagas', 'Total Parcelas', 'Saldo Devedor',
      // Comissão
      'Comissão (R$)', 'Comissão Recebida', 'Comissão Pendente',
      // Vendedor
      'Responsável', 'Vendedor ID',
      // PF
      'Nome Completo', 'CPF', 'RG', 'Data Nascimento', 'Estado Civil', 'CPF Cônjuge',
      'Telefone', 'Email', 'Profissão', 'Tipo Servidor', 'Renda', 'Patrimônio', 'PIX',
      'CEP', 'Rua', 'Número', 'Complemento', 'Bairro', 'Cidade', 'Estado',
      // PJ
      'Razão Social', 'CNPJ', 'Natureza Jurídica', 'Inscrição Estadual', 'Data Fundação',
      'Telefone Comercial', 'Email Comercial', 'Faturamento Mensal', 'Nº Funcionários',
      'CEP Comercial', 'Rua Comercial', 'Número Comercial', 'Complemento Comercial',
      'Bairro Comercial', 'Cidade Comercial', 'Estado Comercial',
      // Extras
      'É Transferência', 'Transferido De', 'Observações',
    ];

    const rows = sortedCards.map((card: any, index) => {
      const displayName = card.tipo_pessoa === 'pf' ? card.nome_completo : card.razao_social;
      const proximoVencimento = calcularProximoVencimento(card.dia_vencimento);
      const origemConfig = ORIGEM_OPTIONS.find(o => o.value === card.origem);

      return [
        index + 1,
        card.status,
        card.tipo_pessoa === 'pf' ? 'PF' : 'PJ',
        card.categoria === 'inside' ? 'Inside' : 'Life',
        origemConfig?.label || card.origem,
        card.origem_detalhe,
        card.tipo_produto,
        card.objetivo === 'auto' ? 'Auto' : card.objetivo === 'imovel' ? 'Imóvel' : '',
        card.grupo,
        card.cota,
        card.valor_credito,
        card.dia_vencimento,
        format(proximoVencimento, 'dd/MM/yyyy'),
        fmtDate(card.data_reserva),
        fmtDate(card.data_contratacao),
        card.valor_parcela ?? '',
        card.parcelas_pagas ?? '',
        card.total_parcelas ?? '',
        card.saldo_devedor ?? '',
        card.valor_comissao || 0,
        card.valor_comissao_recebida ?? '',
        card.valor_comissao_pendente ?? '',
        getFirstTwoNames(card.vendedor_name) || displayName ? card.vendedor_name : '',
        card.vendedor_id,
        // PF
        card.nome_completo, card.cpf, card.rg, fmtDate(card.data_nascimento), card.estado_civil, card.cpf_conjuge,
        card.telefone, card.email, card.profissao, card.tipo_servidor, card.renda, card.patrimonio, card.pix,
        card.endereco_cep, card.endereco_rua, card.endereco_numero, card.endereco_complemento,
        card.endereco_bairro, card.endereco_cidade, card.endereco_estado,
        // PJ
        card.razao_social, card.cnpj, card.natureza_juridica, card.inscricao_estadual, fmtDate(card.data_fundacao),
        card.telefone_comercial, card.email_comercial, card.faturamento_mensal, card.num_funcionarios,
        card.endereco_comercial_cep, card.endereco_comercial_rua, card.endereco_comercial_numero,
        card.endereco_comercial_complemento, card.endereco_comercial_bairro,
        card.endereco_comercial_cidade, card.endereco_comercial_estado,
        // Extras
        card.e_transferencia ? 'Sim' : 'Não', card.transferido_de, card.observacoes,
      ].map(esc);
    });

    // BOM for Excel UTF-8 compatibility
    const csvContent = '\uFEFF' + [headers.map(esc).join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `consorcio_${format(now, 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Barra de ação da etapa Cotas */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {canRecalculate && (
            <AlertDialog open={recalcOpen} onOpenChange={setRecalcOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={recalculateAll.isPending}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${recalculateAll.isPending ? 'animate-spin' : ''}`} />
                  Recalcular comissões
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Recalcular todas as comissões?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação reprocessa TODAS as cartas e TODAS as parcelas de consórcio, gravando
                    novamente o valor de comissão de cada parcela. Pode levar alguns minutos e alterar
                    valores já registrados. Use apenas quando a tabela de comissões mudar.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      recalculateAll.mutate();
                      setRecalcOpen(false);
                    }}
                  >
                    Recalcular
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Configurações
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={!cards || cards.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Cota
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="space-y-4">
        {/* Bloco 1 — Globais (valor das cotas + comissões geradas) */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Globais</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Cartas Novas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {summaryLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <p className="text-2xl font-bold text-blue-500">{formatCurrency(summary?.valorCartasNovas || 0)}</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Cartas Subidas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {summaryLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(summary?.valorCartasSubidas || 0)}</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Comissão Prevista (Cartas Novas)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {summaryLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <p className="text-2xl font-bold text-blue-500">{formatCurrency(summary?.comissaoPrevistaNovas || 0)}</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Comissão Realizada (Cartas Subidas)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {summaryLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(summary?.comissaoRealizadaSubidas || 0)}</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Bloco 2 — Líquidos do mês */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Líquidos do Mês</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
                  Comissão Prevista
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
        </div>
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

        <Select value={objetivoFilter} onValueChange={setObjetivoFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Objetivo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Objetivo</SelectItem>
            <SelectItem value="auto">🚗 Auto</SelectItem>
            <SelectItem value="imovel">🏠 Imóvel</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex-1" />

      </div>

      {onlyDoFunil && (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-primary/50 text-primary">
            Filtrado: cotas originadas no funil
          </Badge>
          <Button size="sm" variant="ghost" onClick={onClearQuickFilter}>
            Limpar filtro
          </Button>
        </div>
      )}

      {onlyExternas && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-amber-500/50 text-amber-600">
              Filtrado: cotas externas (sem vínculo com o funil)
            </Badge>
            <Button size="sm" variant="ghost" onClick={onClearQuickFilter}>
              Limpar filtro
            </Button>
          </div>
          {externasBreakdown && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs space-y-1">
              <div>
                <span className="text-muted-foreground">Por vendedor: </span>
                <span className="font-medium">{externasBreakdown.vendedores || '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Por origem declarada: </span>
                <span className="font-medium">{externasBreakdown.origens || '—'}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">Nº</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="text-center">Grupo</TableHead>
                <TableHead className="text-center">Cota</TableHead>
                <TableHead className="text-right">Valor Crédito</TableHead>
                <TableHead>DT Reserva</TableHead>
                <TableHead>DT Contratação</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Objetivo</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Origem no funil</TableHead>
                <TableHead>Criada por</TableHead>
                <TableHead>Criada em</TableHead>
                <TableHead className="text-right">Comissão</TableHead>
                <TableHead className="w-20">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cardsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={18}>
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
                        {card.data_reserva
                          ? format(parseDateWithoutTimezone(card.data_reserva), 'dd/MM/yyyy')
                          : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>
                        {card.data_contratacao
                          ? format(parseDateWithoutTimezone(card.data_contratacao), 'dd/MM/yyyy')
                          : <span className="text-muted-foreground">-</span>}
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
                        {card.objetivo === 'auto' ? (
                          <Badge variant="outline">🚗 Auto</Badge>
                        ) : card.objetivo === 'imovel' ? (
                          <Badge variant="outline">🏠 Imóvel</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
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
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Excluir carta"
                            className="text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingCardId(card.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={15} className="text-center py-10 text-muted-foreground">
                    Nenhuma carta encontrada para o período selecionado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
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

      <DeleteCartaDialog
        open={!!deletingCardId}
        onOpenChange={(v) => !v && setDeletingCardId(null)}
        isDeleting={deleteCard.isPending}
        onConfirm={(motivo) => deletingCardId && handleDeleteCard(deletingCardId, motivo)}
      />

      {/* Config Modal */}
      <ConsorcioConfigModal
        open={configOpen}
        onOpenChange={setConfigOpen}
      />
    </div>
  );
}
