import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronLeft, ChevronRight, CheckCircle, FileText, Copy } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { PagamentoRow, StatusParcela, SituacaoCota } from '@/hooks/useConsorcioPagamentos';
import { usePayInstallment } from '@/hooks/useConsorcio';
import { useBoletosByInstallments } from '@/hooks/useConsorcioBoletos';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';

const statusBadgeConfig: Record<StatusParcela, { label: string; className: string }> = {
  paga: { label: 'Paga', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  vencendo: { label: 'Vencendo', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  atrasada: { label: 'Atrasada', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  pendente: { label: 'Pendente', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
};

const situacaoBadgeConfig: Record<SituacaoCota, { label: string; className: string }> = {
  quitada: { label: 'Quitada', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  pendente: { label: 'Pendente', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  em_atraso: { label: 'Em Atraso', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  cancelada: { label: 'Cancelada', className: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' },
};

interface Props {
  data: PagamentoRow[];
  isLoading: boolean;
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (size: number) => void;
  onViewDetail: (row: PagamentoRow) => void;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  bulkMode: boolean;
  filtroBoleto: string;
  tipoFilter?: 'cliente' | 'empresa';
}

export function PagamentosTable({ data, isLoading, page, pageSize, totalPages, totalItems, onPageChange, onPageSizeChange, onViewDetail, selectedIds, onSelectionChange, bulkMode, filtroBoleto, tipoFilter }: Props) {
  const payInstallment = usePayInstallment();
  const installmentIds = data.map(r => r.id);
  const { data: boletos } = useBoletosByInstallments(installmentIds);
  const isEmpresa = tipoFilter === 'empresa';

  const boletoMap = new Map<string, { storage_path: string | null; id: string; linha_digitavel: string | null }>();
  (boletos || []).forEach(b => {
    if (b.installment_id) {
      boletoMap.set(b.installment_id, { storage_path: b.storage_path, id: b.id, linha_digitavel: b.linha_digitavel });
    }
  });

  // Apply boleto filter
  const filteredData = filtroBoleto === 'todos' ? data
    : filtroBoleto === 'com_boleto' ? data.filter(r => boletoMap.has(r.id))
    : data.filter(r => !boletoMap.has(r.id));

  // Rows eligible for bulk WhatsApp (has boleto)
  const selectableIds = filteredData.filter(r => boletoMap.has(r.id)).map(r => r.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every(id => selectedIds.has(id));

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const newSet = new Set(selectedIds);
      selectableIds.forEach(id => newSet.add(id));
      onSelectionChange(newSet);
    } else {
      const newSet = new Set(selectedIds);
      selectableIds.forEach(id => newSet.delete(id));
      onSelectionChange(newSet);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) newSet.add(id);
    else newSet.delete(id);
    onSelectionChange(newSet);
  };

  const handleMarkAsPaid = (e: React.MouseEvent, row: PagamentoRow) => {
    e.stopPropagation();
    payInstallment.mutate({
      installmentId: row.id,
      dataPagamento: format(new Date(), 'yyyy-MM-dd'),
    });
  };

  const handleOpenBoleto = async (e: React.MouseEvent, storagePath: string | null) => {
    e.stopPropagation();
    if (!storagePath) {
      toast.error('Caminho do boleto não encontrado');
      return;
    }
    const { data, error } = await supabase.storage.from('consorcio-boletos').createSignedUrl(storagePath, 300);
    if (error || !data?.signedUrl) {
      toast.error('Erro ao gerar link do boleto');
      return;
    }
    window.open(data.signedUrl, '_blank');
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
           <TableRow>
            {bulkMode && (
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(checked) => handleSelectAll(!!checked)}
                  aria-label="Selecionar todos"
                />
              </TableHead>
            )}
             <TableHead>Cliente</TableHead>
            <TableHead>Grupo</TableHead>
            <TableHead>Cota</TableHead>
            <TableHead className="text-center">Nº</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead>Pagamento</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Situação Cota</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead className="text-center">Boleto</TableHead>
            <TableHead className="text-center">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredData.length === 0 ? (
            <TableRow>
              <TableCell colSpan={bulkMode ? 14 : 13} className="text-center text-muted-foreground py-8">
                Nenhuma parcela encontrada
              </TableCell>
            </TableRow>
          ) : (
            filteredData.map(row => {
              const statusCfg = statusBadgeConfig[row.status_calculado];
              const situacaoCfg = situacaoBadgeConfig[row.situacao_cota];
              const isPaid = row.status_calculado === 'paga';
              const boleto = boletoMap.get(row.id);
              const isSelectable = !!boleto;
              return (
                <TableRow
                  key={row.id}
                  className={`cursor-pointer hover:bg-muted/50 ${row.status_calculado === 'atrasada' ? 'bg-destructive/5' : ''} ${selectedIds.has(row.id) ? 'bg-primary/5' : ''}`}
                  onClick={() => onViewDetail(row)}
                >
                  {bulkMode && (
                    <TableCell onClick={e => e.stopPropagation()}>
                      {isSelectable ? (
                        <Checkbox
                          checked={selectedIds.has(row.id)}
                          onCheckedChange={(checked) => handleSelectRow(row.id, !!checked)}
                          aria-label={`Selecionar ${row.cliente_nome}`}
                        />
                      ) : (
                        <span className="block w-4" />
                      )}
                    </TableCell>
                  )}
                  <TableCell className="font-medium max-w-[160px] truncate">{row.cliente_nome}</TableCell>
                  <TableCell>{row.grupo}</TableCell>
                  <TableCell>{row.cota}</TableCell>
                  <TableCell className="text-center">{row.numero_parcela}</TableCell>
                  <TableCell className="capitalize">{row.tipo}</TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(row.valor_parcela))}</TableCell>
                  <TableCell>{formatDate(row.data_vencimento)}</TableCell>
                  <TableCell>{row.data_pagamento ? formatDate(row.data_pagamento) : '-'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusCfg.className}>{statusCfg.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={situacaoCfg.className}>{situacaoCfg.label}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[120px] truncate">{row.vendedor_name || '-'}</TableCell>
                  <TableCell className="text-center">
                    {boleto ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                              onClick={(e) => handleOpenBoleto(e, boleto.storage_path)}
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Abrir boleto PDF</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {!isPaid && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                              onClick={(e) => handleMarkAsPaid(e, row)}
                              disabled={payInstallment.isPending}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Marcar como paga</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {totalItems.toLocaleString('pt-BR')} parcelas encontradas
        </span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs">Itens por página:</span>
            <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
              <SelectTrigger className="h-8 w-[80px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="200">200</SelectItem>
                <SelectItem value="9999">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>Página {page} de {totalPages || 1}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
