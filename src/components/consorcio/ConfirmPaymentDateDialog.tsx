import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { parseDateWithoutTimezone, formatDateForDB } from '@/lib/dateHelpers';

interface ConfirmPaymentDateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Reference info to help the user pick the right date */
  numeroParcela?: number;
  dataVencimento?: string | null;
  cliente?: string | null;
  isSaving?: boolean;
  /** Called with the date the user confirmed (YYYY-MM-DD) */
  onConfirm: (dataPagamento: string) => Promise<void> | void;
}

/**
 * Diálogo obrigatório antes de marcar uma parcela como paga.
 * Pede explicitamente a data em que o pagamento ocorreu — evita carregar
 * `data_pagamento = hoje` por engano e inflar a previsão de comissões.
 */
export function ConfirmPaymentDateDialog({
  open,
  onOpenChange,
  numeroParcela,
  dataVencimento,
  cliente,
  isSaving,
  onConfirm,
}: ConfirmPaymentDateDialogProps) {
  const [dataPagamento, setDataPagamento] = useState<Date | undefined>(undefined);

  useEffect(() => {
    if (open) {
      // Default: vencimento se existir, senão hoje
      setDataPagamento(
        dataVencimento ? parseDateWithoutTimezone(dataVencimento) : new Date(),
      );
    }
  }, [open, dataVencimento]);

  const handleConfirm = async () => {
    if (!dataPagamento) return;
    await onConfirm(formatDateForDB(dataPagamento));
  };

  const isFuture = dataPagamento ? dataPagamento > new Date() : false;
  const venc = dataVencimento ? parseDateWithoutTimezone(dataVencimento) : null;
  const diasDelta =
    dataPagamento && venc
      ? Math.round((dataPagamento.getTime() - venc.getTime()) / 86400000)
      : null;
  const muitoLonge = diasDelta !== null && Math.abs(diasDelta) > 60;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Confirmar data do pagamento</DialogTitle>
          <DialogDescription>
            Informe a data <strong>real</strong> em que esta parcela foi paga. Este
            valor é usado para calcular a previsão semanal e mensal de comissões.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {(cliente || numeroParcela || dataVencimento) && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
              {cliente && (
                <div>
                  <span className="text-muted-foreground">Cliente: </span>
                  <span className="font-medium">{cliente}</span>
                </div>
              )}
              {numeroParcela !== undefined && (
                <div>
                  <span className="text-muted-foreground">Parcela: </span>
                  <span className="font-medium">#{numeroParcela}</span>
                </div>
              )}
              {dataVencimento && (
                <div>
                  <span className="text-muted-foreground">Vencimento: </span>
                  <span className="font-medium">
                    {format(parseDateWithoutTimezone(dataVencimento), 'dd/MM/yyyy')}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Data do pagamento</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !dataPagamento && 'text-muted-foreground',
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataPagamento ? format(dataPagamento, 'dd/MM/yyyy') : 'Selecione'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataPagamento}
                  onSelect={setDataPagamento}
                  locale={ptBR}
                  disabled={(d) => d > new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {isFuture && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>A data do pagamento não pode ser no futuro.</span>
            </div>
          )}

          {!isFuture && muitoLonge && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Atenção: a data informada está a {Math.abs(diasDelta!)} dias do
                vencimento. Confirme se está correta antes de salvar.
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isSaving || !dataPagamento || isFuture}
          >
            {isSaving ? 'Salvando...' : 'Confirmar pagamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
