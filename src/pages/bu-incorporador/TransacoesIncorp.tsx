import { useState, useMemo } from 'react';
import { format, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { RefreshCw, Download, Search, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePickerCustom } from '@/components/ui/DatePickerCustom';

import { useAllHublaTransactions, TransactionFilters } from '@/hooks/useAllHublaTransactions';
import { formatCurrency } from '@/lib/formatters';

const ITEMS_PER_PAGE = 20;

// Produtos excluídos da listagem de Vendas Incorporador
const EXCLUDED_PRODUCTS = [
  'efeito alavanca + assessoria',
  'construir para alugar',
  'a006 - renovação parceiro mcf',
  'mcf projetos',
  'sócio mcf',
  'viver de aluguel',
  'contrato - efeito alavanca',
  'como arrematar imóveis de leilão da caixa',
  'clube do arremate',
];

// Preços brutos fixos por produto (match parcial, case-insensitive)
const FIXED_GROSS_PRICES: { pattern: string; price: number }[] = [
  { pattern: 'a005 - mcf p2', price: 0 },
  { pattern: 'a009 - mcf incorporador completo + the club', price: 19500 },
  { pattern: 'a001 - mcf incorporador completo', price: 14500 },
  { pattern: 'a000 - contrato', price: 497 },
  { pattern: 'a010', price: 47 },
  { pattern: 'plano construtor básico', price: 997 },
  { pattern: 'a004 - mcf plano anticrise básico', price: 5500 },
  { pattern: 'a003 - mcf plano anticrise completo', price: 7500 },
];

// Função para obter preço bruto fixo ou original
const getFixedGrossPrice = (productName: string | null, originalPrice: number): number => {
  if (!productName) return originalPrice;
  const normalizedName = productName.toLowerCase().trim();
  
  for (const { pattern, price } of FIXED_GROSS_PRICES) {
    if (normalizedName.includes(pattern)) {
      return price;
    }
  }
  return originalPrice;
};

// Normaliza o nome do produto para chave de deduplicação
const normalizeProductKey = (productName: string | null): string => {
  if (!productName) return 'unknown';
  const upper = productName.toUpperCase().trim();
  
  if (upper.includes('A009')) return 'A009';
  if (upper.includes('A005')) return 'A005';
  if (upper.includes('A004')) return 'A004';
  if (upper.includes('A003')) return 'A003';
  if (upper.includes('A001')) return 'A001';
  if (upper.includes('A010')) return 'A010';
  if (upper.includes('A000') || upper.includes('CONTRATO')) return 'A000';
  if (upper.includes('PLANO CONSTRUTOR')) return 'PLANO_CONSTRUTOR';
  
  // Fallback: primeiros 40 chars
  return upper.substring(0, 40);
};

export default function TransacoesIncorp() {
  // Filtros - inicia com o mês atual para evitar carregar toda a base
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [currentPage, setCurrentPage] = useState(1);

  // Query com filtros
  const filters: TransactionFilters = {
    search: searchTerm || undefined,
    startDate,
    endDate,
  };

  const { data: allTransactions = [], isLoading, refetch, isFetching } = useAllHublaTransactions(filters);

  // Filtrar produtos excluídos
  const filteredTransactions = useMemo(() => {
    return allTransactions.filter(t => {
      const productName = (t.product_name || '').toLowerCase().trim();
      return !EXCLUDED_PRODUCTS.some(excluded => productName.includes(excluded));
    });
  }, [allTransactions]);

  // Deduplicação: combina regra de parcela + email+produto
  // 1. Se installment_number > 1 => bruto = 0
  // 2. Para primeira parcela: apenas 1 transação por email+produto tem bruto
  const idsWithGross = useMemo(() => {
    const firstInstallmentOnly = filteredTransactions.filter(t => {
      const installment = t.installment_number || 1;
      return installment === 1;
    });

    // Agrupa por email+produto normalizado e seleciona a mais antiga
    const keyToWinner = new Map<string, { id: string; date: string }>();
    
    for (const t of firstInstallmentOnly) {
      const email = (t.customer_email || '').toLowerCase().trim();
      const productKey = normalizeProductKey(t.product_name);
      const key = `${email}|${productKey}`;
      const currentDate = t.sale_date || '';
      
      const existing = keyToWinner.get(key);
      if (!existing) {
        keyToWinner.set(key, { id: t.id, date: currentDate });
      } else {
        // Mantém a transação mais antiga
        if (currentDate < existing.date) {
          keyToWinner.set(key, { id: t.id, date: currentDate });
        }
      }
    }

    return new Set(Array.from(keyToWinner.values()).map(v => v.id));
  }, [filteredTransactions]);

  // Função para obter bruto considerando parcela + deduplicação email+produto
  const getDeduplicatedGross = (transaction: typeof filteredTransactions[0]): number => {
    const installment = transaction.installment_number || 1;
    
    // Regra 1: Parcela > 1 sempre tem bruto zerado
    if (installment > 1) {
      return 0;
    }
    
    // Regra 2: Apenas a transação "vencedora" por email+produto tem bruto
    if (!idsWithGross.has(transaction.id)) {
      return 0;
    }
    
    return getFixedGrossPrice(transaction.product_name, transaction.product_price || 0);
  };

  // Transações com bruto ajustado (para uso em totais e exibição)
  const transactions = filteredTransactions;

  // Paginação
  const totalPages = Math.ceil(transactions.length / ITEMS_PER_PAGE);
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return transactions.slice(start, start + ITEMS_PER_PAGE);
  }, [transactions, currentPage]);

  // Totais
  const totals = useMemo(() => {
    const bruto = transactions.reduce((sum, t) => sum + getDeduplicatedGross(t), 0);
    const liquido = transactions.reduce((sum, t) => sum + (t.net_value || 0), 0);
    return { count: transactions.length, bruto, liquido };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, idsWithGross]);

  // Handlers
  const handleRefresh = async () => {
    await refetch();
    toast.success('Dados atualizados!');
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setStartDate(undefined);
    setEndDate(undefined);
    setCurrentPage(1);
  };

  const handleExport = () => {
    if (transactions.length === 0) {
      toast.error('Nenhuma transação para exportar');
      return;
    }

    const headers = ['Data', 'Produto', 'Cliente', 'Email', 'Telefone', 'Parcela', 'Bruto', 'Líquido', 'Fonte'];
    const rows = transactions.map(t => [
      t.sale_date ? format(new Date(t.sale_date), 'dd/MM/yyyy HH:mm') : '',
      t.product_name || '',
      t.customer_name || '',
      t.customer_email || '',
      t.customer_phone || '',
      t.installment_number && t.total_installments ? `${t.installment_number}/${t.total_installments}` : '1/1',
      getDeduplicatedGross(t).toFixed(2),
      t.net_value?.toFixed(2) || '0',
      t.source || '',
    ]);

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

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Vendas MCF INCORPORADOR</h1>
            <p className="text-muted-foreground">Todas as vendas da plataforma Hubla</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
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
              <div className="text-2xl font-bold text-green-600">{formatCurrency(totals.liquido)}</div>
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
                      </TableRow>
                    ))
                  ) : paginatedTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                        Nenhuma transação encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedTransactions.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">
                          {t.sale_date ? format(new Date(t.sale_date), 'dd/MM/yy HH:mm', { locale: ptBR }) : '-'}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate" title={t.product_name || ''}>
                          {t.product_name || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[180px]">
                            <div className="truncate font-medium" title={t.customer_name || ''}>
                              {t.customer_name || '-'}
                            </div>
                            <div className="truncate text-xs text-muted-foreground" title={t.customer_email || ''}>
                              {t.customer_email || '-'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {t.installment_number && t.total_installments 
                            ? `${t.installment_number}/${t.total_installments}` 
                            : '1/1'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(getDeduplicatedGross(t))}
                        </TableCell>
                        <TableCell className="text-right text-green-600 font-medium">
                          {formatCurrency(t.net_value || 0)}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-muted">
                            {t.source || 'hubla'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <div className="text-sm text-muted-foreground">
                  Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, transactions.length)} de {transactions.length.toLocaleString('pt-BR')}
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
              </div>
            )}
          </CardContent>
        </Card>
    </div>
  );
}
