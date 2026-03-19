import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BillingSubscription, SUBSCRIPTION_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '@/types/billing';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CobrancaTableProps {
  subscriptions: BillingSubscription[];
  isLoading: boolean;
  onSelect: (sub: BillingSubscription) => void;
}

const statusColors: Record<string, string> = {
  em_dia: 'bg-green-100 text-green-800 border-green-200',
  atrasada: 'bg-red-100 text-red-800 border-red-200',
  cancelada: 'bg-gray-100 text-gray-800 border-gray-200',
  finalizada: 'bg-blue-100 text-blue-800 border-blue-200',
  quitada: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

export const CobrancaTable = ({ subscriptions, isLoading, onSelect }: CobrancaTableProps) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Reset to page 1 when data changes (filters applied)
  useEffect(() => {
    setPage(1);
  }, [subscriptions]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (subscriptions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhuma assinatura encontrada
      </div>
    );
  }

  const totalItems = subscriptions.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedSubs = subscriptions.slice(startIndex, endIndex);

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
           <TableHead>Cliente</TableHead>
69:             <TableHead>Produto</TableHead>
70:             <TableHead>Status</TableHead>
71:             <TableHead className="text-right">Valor Total</TableHead>
72:             <TableHead className="text-right">Valor Pago</TableHead>
73:             <TableHead>Parcelas</TableHead>
74:             <TableHead>Pagamento</TableHead>
75:             <TableHead>Responsável</TableHead>
76:             <TableHead>Início</TableHead>
77:             <TableHead>Previsão Final</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedSubs.map((sub) => (
            <TableRow
              key={sub.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onSelect(sub)}
            >
              <TableCell>
                <div>
                  <div className="font-medium text-foreground">{sub.customer_name}</div>
                  <div className="text-xs text-muted-foreground">{sub.customer_email}</div>
                </div>
              </TableCell>
              <TableCell className="text-sm">{sub.product_name}</TableCell>
              <TableCell>
                <Badge className={`text-xs ${statusColors[sub.status] || ''}`} variant="outline">
                  {SUBSCRIPTION_STATUS_LABELS[sub.status]}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge className={`text-xs ${quitacaoColors[sub.status_quitacao] || ''}`} variant="outline">
                  {QUITACAO_STATUS_LABELS[sub.status_quitacao]}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-medium">{formatCurrency(sub.valor_total_contrato)}</TableCell>
              <TableCell className="text-sm">{sub.total_parcelas}x</TableCell>
              <TableCell className="text-sm">{PAYMENT_METHOD_LABELS[sub.forma_pagamento]}</TableCell>
              <TableCell className="text-sm">{sub.responsavel_financeiro || '-'}</TableCell>
              <TableCell className="text-sm">{sub.data_inicio ? formatDate(sub.data_inicio) : '-'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Pagination footer */}
      <div className="flex items-center justify-between border-t px-4 py-3">
        <span className="text-sm text-muted-foreground">
          Mostrando {startIndex + 1}–{endIndex} de {totalItems} assinaturas
        </span>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Itens por página</span>
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground px-2">{page} / {totalPages}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};