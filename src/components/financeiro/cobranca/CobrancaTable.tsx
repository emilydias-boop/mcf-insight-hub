import { useState, useEffect, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { BillingSubscription, SUBSCRIPTION_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '@/types/billing';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Users } from 'lucide-react';

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

const STATUS_PRIORITY: Record<string, number> = {
  atrasada: 0,
  em_dia: 1,
  cancelada: 2,
  finalizada: 3,
  quitada: 4,
};

interface CustomerGroup {
  key: string;
  customerName: string;
  customerEmail: string;
  subscriptions: BillingSubscription[];
  totalContrato: number;
  totalPago: number;
  parcelasPagas: number;
  parcelasTotais: number;
  worstStatus: string;
}

function groupByCustomer(subs: BillingSubscription[]): CustomerGroup[] {
  const map = new Map<string, BillingSubscription[]>();
  for (const s of subs) {
    const key = (s.customer_email || s.customer_name).toLowerCase();
    const arr = map.get(key) || [];
    arr.push(s);
    map.set(key, arr);
  }

  return Array.from(map.entries()).map(([key, items]) => {
    let worstStatus = 'quitada';
    let worstPriority = 999;
    for (const s of items) {
      const p = STATUS_PRIORITY[s.status] ?? 5;
      if (p < worstPriority) {
        worstPriority = p;
        worstStatus = s.status;
      }
    }

    return {
      key,
      customerName: items[0].customer_name,
      customerEmail: items[0].customer_email || '',
      subscriptions: items,
      totalContrato: items.reduce((sum, s) => sum + (s.valor_total_contrato || 0), 0),
      totalPago: items.reduce((sum, s) => sum + (s.valor_pago_total ?? 0), 0),
      parcelasPagas: items.reduce((sum, s) => sum + (s.parcelas_pagas ?? 0), 0),
      parcelasTotais: items.reduce((sum, s) => sum + (s.total_parcelas || 0), 0),
      worstStatus,
    };
  });
}

export const CobrancaTable = ({ subscriptions, isLoading, onSelect }: CobrancaTableProps) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [grouped, setGrouped] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    setPage(1);
    setExpandedKeys(new Set());
  }, [subscriptions, grouped]);

  const groups = useMemo(() => grouped ? groupByCustomer(subscriptions) : [], [subscriptions, grouped]);

  const toggleExpand = (key: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

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

  // Pagination
  const items = grouped ? groups : subscriptions;
  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedItems = items.slice(startIndex, endIndex);

  return (
    <div>
      {/* Toggle */}
      <div className="flex items-center gap-2 px-4 py-2 border-b">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Agrupar por cliente</span>
        <Switch checked={grouped} onCheckedChange={setGrouped} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Produto</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Valor Total</TableHead>
            <TableHead className="text-right">Valor Pago</TableHead>
            <TableHead>Parcelas</TableHead>
            <TableHead>Pagamento</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead>Início</TableHead>
            <TableHead>Previsão Final</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {grouped
            ? (paginatedItems as CustomerGroup[]).map((group) => {
                const isExpanded = expandedKeys.has(group.key);
                return (
                  <>
                    {/* Group header row */}
                    <TableRow
                      key={group.key}
                      className="cursor-pointer hover:bg-muted/50 bg-muted/20 font-medium"
                      onClick={() => toggleExpand(group.key)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {isExpanded
                            ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                            : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                          }
                          <div>
                            <div className="font-medium text-foreground">{group.customerName}</div>
                            <div className="text-xs text-muted-foreground">{group.customerEmail}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {group.subscriptions.length} {group.subscriptions.length === 1 ? 'produto' : 'produtos'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${statusColors[group.worstStatus] || ''}`} variant="outline">
                          {SUBSCRIPTION_STATUS_LABELS[group.worstStatus] || group.worstStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(group.totalContrato)}</TableCell>
                      <TableCell className={`text-right font-medium ${
                        group.totalPago < group.totalContrato * 0.3 && group.worstStatus !== 'quitada'
                          ? 'text-red-600' : ''
                      }`}>
                        {formatCurrency(group.totalPago)}
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="font-medium">{group.parcelasPagas}</span>
                        <span className="text-muted-foreground">/{group.parcelasTotais} pagas</span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">—</TableCell>
                      <TableCell className="text-sm text-muted-foreground">—</TableCell>
                      <TableCell className="text-sm text-muted-foreground">—</TableCell>
                      <TableCell className="text-sm text-muted-foreground">—</TableCell>
                    </TableRow>

                    {/* Expanded sub-rows */}
                    {isExpanded && group.subscriptions.map((sub) => (
                      <TableRow
                        key={sub.id}
                        className="cursor-pointer hover:bg-muted/50 bg-background"
                        onClick={(e) => { e.stopPropagation(); onSelect(sub); }}
                      >
                        <TableCell className="pl-12">
                          <div className="text-xs text-muted-foreground">↳</div>
                        </TableCell>
                        <TableCell className="text-sm">{sub.product_name}</TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${statusColors[sub.status] || ''}`} variant="outline">
                            {SUBSCRIPTION_STATUS_LABELS[sub.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(sub.valor_total_contrato)}</TableCell>
                        <TableCell className={`text-right font-medium ${
                          (sub.valor_pago_total ?? 0) < sub.valor_total_contrato * 0.3 && sub.status !== 'quitada'
                            ? 'text-red-600' : ''
                        }`}>
                          {formatCurrency(sub.valor_pago_total ?? 0)}
                        </TableCell>
                        <TableCell className="text-sm">
                          <span className="font-medium">{sub.parcelas_pagas ?? 0}</span>
                          <span className="text-muted-foreground">/{sub.total_parcelas} pagas</span>
                        </TableCell>
                        <TableCell className="text-sm">{PAYMENT_METHOD_LABELS[sub.forma_pagamento]}</TableCell>
                        <TableCell className="text-sm">{sub.responsavel_financeiro || '-'}</TableCell>
                        <TableCell className="text-sm">{sub.data_inicio ? formatDate(sub.data_inicio) : '-'}</TableCell>
                        <TableCell className="text-sm">{sub.data_fim_prevista ? formatDate(sub.data_fim_prevista) : '-'}</TableCell>
                      </TableRow>
                    ))}
                  </>
                );
              })
            : (paginatedItems as BillingSubscription[]).map((sub) => (
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
                  <TableCell className="text-right font-medium">{formatCurrency(sub.valor_total_contrato)}</TableCell>
                  <TableCell className={`text-right font-medium ${
                    (sub.valor_pago_total ?? 0) < sub.valor_total_contrato * 0.3 && sub.status !== 'quitada'
                      ? 'text-red-600' : ''
                  }`}>
                    {formatCurrency(sub.valor_pago_total ?? 0)}
                  </TableCell>
                  <TableCell className="text-sm">
                    <span className="font-medium">{sub.parcelas_pagas ?? 0}</span>
                    <span className="text-muted-foreground">/{sub.total_parcelas} pagas</span>
                  </TableCell>
                  <TableCell className="text-sm">{PAYMENT_METHOD_LABELS[sub.forma_pagamento]}</TableCell>
                  <TableCell className="text-sm">{sub.responsavel_financeiro || '-'}</TableCell>
                  <TableCell className="text-sm">{sub.data_inicio ? formatDate(sub.data_inicio) : '-'}</TableCell>
                  <TableCell className="text-sm">{sub.data_fim_prevista ? formatDate(sub.data_fim_prevista) : '-'}</TableCell>
                </TableRow>
              ))
          }
        </TableBody>
      </Table>

      {/* Pagination footer */}
      <div className="flex items-center justify-between border-t px-4 py-3">
        <span className="text-sm text-muted-foreground">
          Mostrando {startIndex + 1}–{endIndex} de {totalItems} {grouped ? 'clientes' : 'assinaturas'}
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
