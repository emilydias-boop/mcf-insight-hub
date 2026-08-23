import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
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
  Database,
  Search,
  RefreshCw,
  Copy,
  FileBadge,
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
import { GerarComprovanteModal } from '@/components/consorcio/GerarComprovanteModal';
import { TermoPanelDialog } from '@/components/consorcio/TermoPanelDialog';
import { useComprovantesByCard } from '@/hooks/useConsorcioTermos';
import { useConsorcioCardDealLinks } from '@/hooks/useLeadReport';
import { STATUS_OPTIONS, ConsorcioCard } from '@/types/consorcio';
import { resolveOrigemLabel } from '@/lib/consorcioOrigem';
import {
  useConsorcioCategoriaOptions,
  useConsorcioOrigemOptions,
  useConsorcioTipoOptions,
} from '@/hooks/useConsorcioConfigOptions';
import { parseDateWithoutTimezone } from '@/lib/dateHelpers';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { useTableSortUrl } from '@/hooks/useTableSortUrl';
import { useDebounce } from '@/hooks/useDebounce';
import { ordenarPor } from '@/lib/ordenacaoTabela';

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

/** Rótulo do vencimento: nulo = definido pela Embracon depois da abertura. */
const VENCIMENTO_A_DEFINIR = 'A definir';

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

/** Ordem de processo dos status, para ordenar por etapa e não por alfabeto. */
const RANK_STATUS: Record<string, number> = {
  pendente: 1,
  ativa: 2,
  contemplada: 3,
  quitada: 4,
  cancelada: 5,
};

const COTAS_SORT_FIELDS = [
  'nome', 'grupo', 'cota', 'valor_credito', 'data_reserva', 'data_contratacao', 'vencimento',
  'tipo_produto', 'objetivo', 'origem', 'status', 'responsavel', 'origem_funil',
  'criada_por', 'criada_em', 'comissao',
] as const;
/** `padrao` = ordenação atual em três níveis; não é coluna clicável. */
type CotasSortField = (typeof COTAS_SORT_FIELDS)[number] | 'padrao';

export function CotasTab({ range, onlyDoFunil, onlyExternas, onClearQuickFilter }: CotasTabProps) {
  const { role } = useAuth();
  const canRecalculate = role === 'admin' || role === 'coordenador';

  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [tipoFilter, setTipoFilter] = useState<string>('todos');
  const [vendedorFilter, setVendedorFilter] = useState<string>('todos');
  const { field, dir, setSort, q, setQ } = useTableSortUrl<CotasSortField>({
    campos: COTAS_SORT_FIELDS,
    inicial: { field: 'padrao', dir: 'desc' },
    sufixo: 'Co',
  });
  // Inicializa só pelo `q` desta aba (`qCo`), nunca pelo que sobrou de outra.
  const [searchTerm, setSearchTerm] = useState<string>(q);
  // A busca é server-side: o campo responde na hora, a query espera 300ms.
  const searchAplicado = useDebounce(searchTerm, 300);
  useEffect(() => { setQ(searchAplicado); /* eslint-disable-next-line */ }, [searchAplicado]);

  /**
   * Nesta aba o ciclo da coluna ativa é asc → desc → padrão (os três níveis),
   * porque o default de três níveis é o único que vale a pena recuperar.
   */
  const toggle = useCallback(
    (f: CotasSortField) => {
      if (f !== field) return setSort(f, 'asc');
      if (dir === 'asc') return setSort(f, 'desc');
      return setSort('padrao', 'desc');
    },
    [field, dir, setSort],
  );

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
  const [comprovanteCard, setComprovanteCard] = useState<ConsorcioCard | null>(null);
  const [comprovantePanelCard, setComprovantePanelCard] = useState<ConsorcioCard | null>(null);

  /**
   * Deep-link de correção: `?editCard=<id>` abre a cota direto no formulário de
   * edição (usado pelo modal de resíduos do Painel Comercial para corrigir o
   * vendedor). O parâmetro é consumido uma vez e removido da URL.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const editCardId = searchParams.get('editCard');
  useEffect(() => {
    if (!editCardId) return;
    let cancelado = false;
    (async () => {
      const { data, error } = await supabase
        .from('consortium_cards')
        .select('*')
        .eq('id', editCardId)
        .maybeSingle();
      if (error) {
        toast.error(`Não foi possível abrir a cota: ${error.message}`);
      } else if (!cancelado && data) {
        setEditingCard(data as unknown as ConsorcioCard);
        setFormOpen(true);
      } else if (!cancelado) {
        toast.error('Cota não encontrada.');
      }
      const proximos = new URLSearchParams(searchParams);
      proximos.delete('editCard');
      setSearchParams(proximos, { replace: true });
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editCardId]);

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
    search: searchAplicado || undefined,
    diaVencimento: vencimentoFilter !== 'todos' ? Number(vencimentoFilter) : undefined,
    grupo: grupoFilter !== 'todos' ? grupoFilter : undefined,
    origem: origemFilter !== 'todos' ? origemFilter : undefined,
    objetivo: objetivoFilter !== 'todos' ? (objetivoFilter as 'auto' | 'imovel') : undefined,
  };

  const { data: cards, isLoading: cardsLoading } = useConsorcioCards(filters);
  // Os KPIs respeitam os MESMOS filtros da tabela, incluindo o recorte rápido
  // Do funil / Externas (antes eles só recebiam as datas e divergiam do grid).
  const { data: summary, isLoading: summaryLoading } = useConsorcioSummary({
    ...filters,
    funil: onlyDoFunil ? 'funil' : onlyExternas ? 'externas' : undefined,
  });
  const deleteCard = useDeleteConsorcioCard();
  const recalculateAll = useRecalculateAllCommissions();
  const { data: funnelCardIds } = useConsorcioCotasOrigem();
  const { data: comprovantesByCard = {} } = useComprovantesByCard();
  const comprovantesAtivos = (cardId: string) =>
    (comprovantesByCard[cardId] || []).filter((t) => t.status !== 'cancelado');

  // Ordenação padrão (3 níveis): Data de Contratação desc → Cota desc → Grupo asc.
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

  /**
   * Ordenação escolhida pelo usuário. Enquanto o campo é `padrao`, mantemos a
   * ordem de três níveis acima — `useTableSort` é de campo único e achataria o default.
   */
  const displayCards = useMemo(() => {
    if (field === 'padrao') return sortedCards;
    const extratores: Record<Exclude<CotasSortField, 'padrao'>, (c: any) => unknown> = {
      nome: (c) => (c.tipo_pessoa === 'pf' ? c.nome_completo : c.razao_social) || '',
      grupo: (c) => c.grupo,
      cota: (c) => c.cota,
      valor_credito: (c) => Number(c.valor_credito) || 0,
      data_reserva: (c) => (c.data_reserva ? parseDateWithoutTimezone(c.data_reserva) : null),
      data_contratacao: (c) => (c.data_contratacao ? parseDateWithoutTimezone(c.data_contratacao) : null),
      // Coluna calculada: ordena pela data que a tela mostra.
      vencimento: (c) => calcularProximoVencimento(c.dia_vencimento),
      tipo_produto: (c) => c.tipo_produto || '',
      objetivo: (c) => c.objetivo || '',
      origem: (c) => resolveOrigemLabel(c.origem, origemOptions),
      status: (c) => RANK_STATUS[c.status] ?? 9,
      responsavel: (c) => getFirstTwoNames(c.vendedor_name),
      origem_funil: (c) => funnelCardIds?.get(c.id) || '',
      criada_por: (c) => creators?.get(c.id) || '',
      criada_em: (c) => (c.created_at ? new Date(c.created_at) : null),
      comissao: (c) => Number(c.valor_comissao_total) || 0,
    };
    return ordenarPor(sortedCards, extratores[field], dir);
  }, [sortedCards, field, dir, origemOptions, funnelCardIds, creators]);

  /** Quebra nominal das cotas externas (para cobrança da equipe). */
  const externasBreakdown = useMemo(() => {
    if (!onlyExternas) return null;
    const byVendedor = new Map<string, number>();
    const byOrigem = new Map<string, number>();
    sortedCards.forEach((c: any) => {
      const v = (c.vendedor_name || '').trim() || 'sem vendedor';
      byVendedor.set(v, (byVendedor.get(v) || 0) + 1);
      const o = (c.origem || '').trim() || 'sem origem';
      const label = c.origem ? resolveOrigemLabel(c.origem, origemOptions) : o;
      byOrigem.set(label, (byOrigem.get(label) || 0) + 1);
    });
    const fmt = (m: Map<string, number>) =>
      Array.from(m.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k} ${v}`)
        .join(' · ');
    return { vendedores: fmt(byVendedor), origens: fmt(byOrigem) };
  }, [onlyExternas, sortedCards, origemOptions]);

  const totalPages = Math.ceil((displayCards?.length || 0) / itemsPerPage);
  const paginatedCards = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return displayCards.slice(startIndex, startIndex + itemsPerPage);
  }, [displayCards, currentPage, itemsPerPage]);

  // Só os cards efetivamente exibidos na página — evita varrer a tabela inteira.
  const { data: cardDealLinks } = useConsorcioCardDealLinks(
    useMemo(() => paginatedCards.map((c: any) => c.id), [paginatedCards]),
  );

  const uniqueGrupos = useMemo(() => {
    if (!cards) return [];
    // Reservas podem nascer sem grupo: nulos/vazios fora da lista de opções
    // (SelectItem com valor vazio quebra o filtro).
    const grupos = [...new Set(cards.map(c => c.grupo).filter((g): g is string => !!g && String(g).trim() !== ''))];
    return grupos.sort((a, b) => Number(a) - Number(b));
  }, [cards]);

  const uniqueVencimentos = useMemo(() => {
    if (!cards) return [];
    const dias = [...new Set(cards.map(c => c.dia_vencimento).filter((d): d is number => d != null))];
    return dias.sort((a, b) => a - b);
  }, [cards]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, tipoFilter, vendedorFilter, range?.startDate, range?.endDate, itemsPerPage, searchAplicado, vencimentoFilter, grupoFilter, origemFilter, objetivoFilter, field, dir]);

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

  /**
   * Duplicar carta: a linha da tabela é um objeto PARCIAL (sem RG, profissão,
   * renda, patrimônio, PIX e endereço), então buscamos a cota completa antes de
   * abrir o formulário. A nova carta herda tudo do original — só grupo, cota e
   * contrato Embracon nascem em branco (isso o formulário limpa).
   */
  const handleDuplicateCard = async (card: ConsorcioCard) => {
    const { data, error } = await supabase
      .from('consortium_cards')
      .select('*')
      .eq('id', card.id)
      .maybeSingle();
    if (error) {
      toast.error(`Não foi possível carregar a cota para duplicar: ${error.message}`);
      return;
    }
    const origem: any = { ...(data || card) };
    // Nada de identidade da cota original vai adiante.
    delete origem.id;
    delete origem.created_at;
    delete origem.updated_at;
    delete origem.grupo;
    delete origem.cota;
    delete origem.contrato_embracon;
    setDuplicatingCard(origem as Partial<ConsorcioCard>);
    setFormOpen(true);
  };


  const handleExportCSV = () => {
    if (!displayCards || displayCards.length === 0) return;

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
      // Conferência de origem
      'Origem no Funil', 'Criada Por', 'Criada Em',
    ];

    const rows = displayCards.map((card: any, index) => {
      const displayName = card.tipo_pessoa === 'pf' ? card.nome_completo : card.razao_social;
      const proximoVencimento = card.dia_vencimento ? calcularProximoVencimento(card.dia_vencimento) : null;

      return [
        index + 1,
        card.status,
        card.tipo_pessoa === 'pf' ? 'PF' : 'PJ',
        card.categoria === 'inside' ? 'Inside' : 'Life',
        resolveOrigemLabel(card.origem, origemOptions),
        card.origem_detalhe,
        card.tipo_produto,
        card.objetivo === 'auto' ? 'Auto' : card.objetivo === 'imovel' ? 'Imóvel' : '',
        card.grupo,
        card.cota,
        card.valor_credito,
        card.dia_vencimento ?? VENCIMENTO_A_DEFINIR,
        proximoVencimento ? format(proximoVencimento, 'dd/MM/yyyy') : VENCIMENTO_A_DEFINIR,
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
        funnelCardIds?.has(card.id) ? funnelCardIds.get(card.id) : 'sem vínculo',
        creators?.get(card.id) || '',
        card.created_at ? format(new Date(card.created_at), 'dd/MM/yyyy') : '',
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
            <Database className="h-4 w-4 mr-2" />
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
        {/*
          4 cards, 4 significados. Cada um diz seu eixo de data no subtítulo
          porque as janelas são diferentes (created_at, data_pagamento,
          data_contratacao) — somar "Cartas Novas + Cartas Subidas" é dupla
          contagem, a mesma carta pode aparecer nas duas.
        */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
            Comissão das cartas do período
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Cadastros sem cota aberta
                </CardTitle>
                <p className="text-[11px] text-muted-foreground">Crédito · por data do cadastro</p>
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
                  <TrendingUp className="h-4 w-4" />
                  Comissão a gerar (cadastros)
                </CardTitle>
                <p className="text-[11px] text-muted-foreground">
                  Estimativa dos cadastros sem cota · por data do cadastro
                </p>
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
                  <CreditCard className="h-4 w-4" />
                  Crédito com 1ª parcela baixada
                </CardTitle>
                <p className="text-[11px] text-muted-foreground">
                  Baixa manual da parcela 1 · por data de pagamento
                </p>
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
                  Comissão recebida
                </CardTitle>
                <p className="text-[11px] text-muted-foreground">
                  Parcelas pagas das cartas · por data de contratação
                </p>
              </CardHeader>
              <CardContent>
                {summaryLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(summary?.comissaoRecebida || 0)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      de {formatCurrency(summary?.comissaoTotal || 0)} · falta receber{' '}
                      <span className="text-orange-600 font-medium">
                        {formatCurrency(summary?.comissaoPendente || 0)}
                      </span>
                    </p>
                  </>
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
                <SortableTableHead field="nome" active={field} dir={dir} onSort={toggle}>Nome</SortableTableHead>
                <SortableTableHead field="grupo" active={field} dir={dir} onSort={toggle} className="text-center" align="center">Grupo</SortableTableHead>
                <SortableTableHead field="cota" active={field} dir={dir} onSort={toggle} className="text-center" align="center">Cota</SortableTableHead>
                <SortableTableHead field="valor_credito" active={field} dir={dir} onSort={toggle} className="text-right" align="right">Valor Crédito</SortableTableHead>
                <SortableTableHead field="data_reserva" active={field} dir={dir} onSort={toggle}>DT Reserva</SortableTableHead>
                <SortableTableHead field="data_contratacao" active={field} dir={dir} onSort={toggle}>DT Contratação</SortableTableHead>
                <SortableTableHead field="vencimento" active={field} dir={dir} onSort={toggle}>Vencimento</SortableTableHead>
                <SortableTableHead field="tipo_produto" active={field} dir={dir} onSort={toggle}>Tipo</SortableTableHead>
                <SortableTableHead field="objetivo" active={field} dir={dir} onSort={toggle}>Objetivo</SortableTableHead>
                <SortableTableHead field="origem" active={field} dir={dir} onSort={toggle}>Origem</SortableTableHead>
                <SortableTableHead field="status" active={field} dir={dir} onSort={toggle}>Status</SortableTableHead>
                <SortableTableHead field="responsavel" active={field} dir={dir} onSort={toggle}>Responsável</SortableTableHead>
                <SortableTableHead field="origem_funil" active={field} dir={dir} onSort={toggle}>Origem no funil</SortableTableHead>
                <SortableTableHead field="criada_por" active={field} dir={dir} onSort={toggle}>Criada por</SortableTableHead>
                <SortableTableHead field="criada_em" active={field} dir={dir} onSort={toggle}>Criada em</SortableTableHead>
                <SortableTableHead field="comissao" active={field} dir={dir} onSort={toggle} className="text-right" align="right">Comissão</SortableTableHead>
                {/* Ações fixas à direita: a tabela tem 17 colunas e rola na
                    horizontal — sem sticky, "Excluir carta" ficava fora da tela. */}
                <TableHead className="sticky right-0 z-20 w-24 border-l bg-background">Ações</TableHead>
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
                  const proximoVencimento = card.dia_vencimento ? calcularProximoVencimento(card.dia_vencimento) : null;
                  // Descending number: total - (page offset + index)
                  const orderNumber = displayCards.length - ((currentPage - 1) * itemsPerPage + index);

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
                        {proximoVencimento ? format(proximoVencimento, 'dd/MM/yyyy') : VENCIMENTO_A_DEFINIR}
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
                          const label = resolveOrigemLabel(card.origem, origemOptions);
                          return label ? (
                            <span className="text-sm">{label}</span>
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
                      <TableCell className="text-sm max-w-[180px]">
                        {funnelCardIds?.has(card.id) ? (
                          <span className="truncate block" title={funnelCardIds.get(card.id)}>
                            {funnelCardIds.get(card.id)}
                          </span>
                        ) : (
                          <Badge variant="outline" className="border-amber-500/50 text-amber-600">
                            sem vínculo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{creators?.get(card.id) || '—'}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {card.created_at ? format(new Date(card.created_at), 'dd/MM/yyyy') : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {card.valor_comissao_total ? formatCurrencyFull(card.valor_comissao_total) : '-'}
                      </TableCell>
                      <TableCell className="sticky right-0 z-10 border-l bg-background">
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
                            title={
                              comprovantesAtivos(card.id).length
                                ? 'Comprovante de cadastro emitido — ver/baixar'
                                : 'Gerar comprovante de cadastro'
                            }
                            className={
                              comprovantesAtivos(card.id).length ? 'text-emerald-600 hover:text-emerald-600' : ''
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              if ((comprovantesByCard[card.id] || []).length) setComprovantePanelCard(card);
                              else setComprovanteCard(card);
                            }}
                          >
                            <FileBadge className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={!cardDealLinks?.get(card.id)}
                            title={
                              cardDealLinks?.get(card.id)
                                ? 'Relatório do Lead'
                                : 'Cota externa — sem lead vinculado'
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              const dealId = cardDealLinks?.get(card.id);
                              if (dealId) window.open(`/consorcio/crm/relatorio-lead/${dealId}`, '_blank');
                            }}
                          >
                            <FileText className="h-4 w-4" />
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
                  <TableCell colSpan={18} className="text-center py-10 text-muted-foreground">
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
      {displayCards.length > 0 && (
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
              Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, displayCards.length)} de {displayCards.length} registros
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

      {comprovanteCard && (
        <GerarComprovanteModal
          open={!!comprovanteCard}
          onOpenChange={(o) => !o && setComprovanteCard(null)}
          cardId={comprovanteCard.id}
          onCompletarCota={() => {
            const c = comprovanteCard;
            setComprovanteCard(null);
            if (c) handleEditCard(c);
          }}
        />
      )}

      {comprovantePanelCard && (
        <TermoPanelDialog
          open={!!comprovantePanelCard}
          onOpenChange={(o) => !o && setComprovantePanelCard(null)}
          termos={comprovantesByCard[comprovantePanelCard.id] || []}
          clienteNome={(comprovantePanelCard.tipo_pessoa === 'pf' ? comprovantePanelCard.nome_completo : comprovantePanelCard.razao_social) || 'cliente'}
          tipo="comprovante_cadastro"
          onGerarNovo={() => {
            const c = comprovantePanelCard;
            setComprovantePanelCard(null);
            setComprovanteCard(c);
          }}
        />
      )}
    </div>
  );
}
