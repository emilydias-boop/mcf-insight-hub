import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { PagamentoRow, useCardInstallments, StatusParcela } from '@/hooks/useConsorcioPagamentos';
import { useBoletosByCard } from '@/hooks/useConsorcioBoletos';
import { BoletoSection } from './BoletoSection';

interface Props {
  row: PagamentoRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function calcStatus(inst: any): StatusParcela {
  if (inst.status === 'pago' || inst.data_pagamento) return 'paga';
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const venc = new Date(inst.data_vencimento + 'T00:00:00');
  const diff = (venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 0) return 'atrasada';
  if (diff <= 7) return 'vencendo';
  return 'pendente';
}

const statusColors: Record<StatusParcela, string> = {
  paga: 'bg-green-100 text-green-800',
  vencendo: 'bg-yellow-100 text-yellow-800',
  atrasada: 'bg-red-100 text-red-800',
  pendente: 'bg-blue-100 text-blue-800',
};

const statusLabels: Record<StatusParcela, string> = {
  paga: 'Paga',
  vencendo: 'Vencendo',
  atrasada: 'Atrasada',
  pendente: 'Pendente',
};

export function PagamentoDetailDrawer({ row, open, onOpenChange }: Props) {
  const { data: installments, isLoading } = useCardInstallments(row?.card_id ?? null);
  const { data: boletos } = useBoletosByCard(row?.card_id ?? null);

  if (!row) return null;

  const pagas = installments?.filter(i => calcStatus(i) === 'paga').length ?? 0;
  const atrasadas = installments?.filter(i => calcStatus(i) === 'atrasada').length ?? 0;
  const pendentes = installments?.filter(i => calcStatus(i) === 'pendente' || calcStatus(i) === 'vencendo').length ?? 0;

  // Map boletos by installment_id for quick lookup
  const boletoByInstallment = new Map(
    (boletos || []).filter(b => b.installment_id).map(b => [b.installment_id, b])
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-lg">{row.cliente_nome}</SheetTitle>
          <p className="text-sm text-muted-foreground">Grupo {row.grupo} · Cota {row.cota}</p>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-3 text-center">
              <p className="text-xs text-muted-foreground">Pagas</p>
              <p className="text-lg font-bold text-green-700 dark:text-green-400">{pagas}</p>
            </div>
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-3 text-center">
              <p className="text-xs text-muted-foreground">Atrasadas</p>
              <p className="text-lg font-bold text-red-700 dark:text-red-400">{atrasadas}</p>
            </div>
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3 text-center">
              <p className="text-xs text-muted-foreground">Pendentes</p>
              <p className="text-lg font-bold text-blue-700 dark:text-blue-400">{pendentes}</p>
            </div>
          </div>

          {/* Info */}
          <div className="text-sm space-y-1">
            <p><span className="text-muted-foreground">Responsável:</span> {row.vendedor_name || '-'}</p>
            <p><span className="text-muted-foreground">Origem:</span> {row.origem || '-'}</p>
            <p><span className="text-muted-foreground">Produto:</span> {row.tipo_produto || '-'}</p>
          </div>

          {/* Installment list */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Histórico de Parcelas</h4>
            {isLoading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {installments?.map(inst => {
                  const st = calcStatus(inst);
                  const boleto = boletoByInstallment.get(inst.id);
                  return (
                    <div key={inst.id} className="space-y-1">
                      <div className={`flex items-center justify-between rounded px-3 py-2 text-sm ${st === 'atrasada' ? 'bg-destructive/5' : 'bg-muted/30'}`}>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs w-6 text-center">{inst.numero_parcela}</span>
                          <span>{formatDate(inst.data_vencimento)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{formatCurrency(Number(inst.valor_parcela))}</span>
                          <Badge variant="outline" className={`text-[10px] ${statusColors[st]}`}>{statusLabels[st]}</Badge>
                        </div>
                      </div>
                      {boleto && <BoletoSection boleto={boleto} />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
