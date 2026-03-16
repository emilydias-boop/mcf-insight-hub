import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { PagamentoRow, StatusParcela, SituacaoCota } from '@/hooks/useConsorcioPagamentos';

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
  totalPages: number;
  totalItems: number;
  onPageChange: (p: number) => void;
  onViewDetail: (row: PagamentoRow) => void;
}

export function PagamentosTable({ data, isLoading, page, totalPages, totalItems, onPageChange, onViewDetail }: Props) {
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
            <TableHead className="text-center">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                Nenhuma parcela encontrada
              </TableCell>
            </TableRow>
          ) : (
            data.map(row => {
              const statusCfg = statusBadgeConfig[row.status_calculado];
              const situacaoCfg = situacaoBadgeConfig[row.situacao_cota];
              return (
                <TableRow key={row.id} className={row.status_calculado === 'atrasada' ? 'bg-destructive/5' : ''}>
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
                    <Button variant="ghost" size="icon" onClick={() => onViewDetail(row)}>
                      <Eye className="h-4 w-4" />
                    </Button>
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
  );
}
