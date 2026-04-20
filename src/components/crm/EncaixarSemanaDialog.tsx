import { useState, useMemo, useEffect } from 'react';
import { format, addWeeks, subWeeks, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, PackagePlus, PackageX, Sparkles, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getCartWeekStart, getCartWeekEnd } from '@/lib/carrinhoWeekBoundaries';
import { useEncaixarNoCarrinho, useDesencaixarDoCarrinho } from '@/hooks/useEncaixarNoCarrinho';

export interface EncaixarSemanaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attendeeId: string | null;
  attendeeName?: string | null;
  /** Data atualmente exibida no painel (âncora para as 4 semanas). */
  anchorWeekStart: Date;
  /** Data string 'yyyy-MM-dd' do carrinho_week_start atual, se houver. */
  currentCarrinhoWeekStart?: string | null;
  /** Contexto extra para mostrar no header. */
  contractPaidAt?: string | null;
  r2Date?: string | null;
  /** Semana sugerida/recomendada (padrão = anchorWeekStart). */
  suggestedWeekStart?: Date;
}

interface WeekOption {
  key: string;
  label: string;
  start: Date;
  end: Date;
  isSuggested?: boolean;
}

function buildWeekOptions(anchor: Date, suggested?: Date): WeekOption[] {
  const base = getCartWeekStart(anchor);
  const weeks = [
    { key: 'prev', label: 'Semana anterior', start: subWeeks(base, 1) },
    { key: 'current', label: 'Semana atual', start: base },
    { key: 'next', label: 'Próxima semana', start: addWeeks(base, 1) },
    { key: 'next2', label: 'Semana seguinte', start: addWeeks(base, 2) },
  ];
  const suggestedKey = suggested
    ? format(getCartWeekStart(suggested), 'yyyy-MM-dd')
    : format(base, 'yyyy-MM-dd');
  return weeks.map(w => ({
    ...w,
    end: getCartWeekEnd(w.start),
    isSuggested: format(w.start, 'yyyy-MM-dd') === suggestedKey,
  }));
}

function formatRange(start: Date, end: Date) {
  return `Qui ${format(start, 'dd/MM', { locale: ptBR })} → Qua ${format(end, 'dd/MM', { locale: ptBR })}`;
}

export function EncaixarSemanaDialog({
  open,
  onOpenChange,
  attendeeId,
  attendeeName,
  anchorWeekStart,
  currentCarrinhoWeekStart,
  contractPaidAt,
  r2Date,
  suggestedWeekStart,
}: EncaixarSemanaDialogProps) {
  const encaixar = useEncaixarNoCarrinho();
  const desencaixar = useDesencaixarDoCarrinho();

  const weekOptions = useMemo(
    () => buildWeekOptions(anchorWeekStart, suggestedWeekStart),
    [anchorWeekStart, suggestedWeekStart],
  );

  const currentKey = currentCarrinhoWeekStart || null;

  const defaultSelected = useMemo(() => {
    const sug = weekOptions.find(w => w.isSuggested);
    return sug ? format(sug.start, 'yyyy-MM-dd') : format(weekOptions[1].start, 'yyyy-MM-dd');
  }, [weekOptions]);

  const [selectedKey, setSelectedKey] = useState<string>(defaultSelected);

  useEffect(() => {
    if (open) setSelectedKey(defaultSelected);
  }, [open, defaultSelected]);

  const isPending = encaixar.isPending || desencaixar.isPending;

  const selectedOption = weekOptions.find(w => format(w.start, 'yyyy-MM-dd') === selectedKey);
  const isSameAsCurrent = !!currentKey && selectedKey === currentKey;

  const currentOption = useMemo(() => {
    if (!currentKey) return null;
    try {
      const d = parseISO(currentKey);
      return {
        start: d,
        end: getCartWeekEnd(d),
      };
    } catch {
      return null;
    }
  }, [currentKey]);

  const handleConfirm = () => {
    if (!attendeeId || !selectedOption || isSameAsCurrent) return;
    encaixar.mutate(
      { attendeeId, weekStart: selectedOption.start },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  const handleRemove = () => {
    if (!attendeeId) return;
    desencaixar.mutate(
      { attendeeId },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5 text-amber-500" />
            Encaixar no Carrinho
          </DialogTitle>
          <DialogDescription>
            {attendeeName ? (
              <span className="font-medium text-foreground">{attendeeName}</span>
            ) : (
              'Selecione a semana do carrinho onde o lead deve aparecer.'
            )}
            {(contractPaidAt || r2Date) && (
              <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                {contractPaidAt && (
                  <span>Contrato pago: <strong>{format(new Date(contractPaidAt), 'dd/MM/yy', { locale: ptBR })}</strong></span>
                )}
                {r2Date && (
                  <span>R2: <strong>{format(new Date(r2Date), 'dd/MM/yy', { locale: ptBR })}</strong></span>
                )}
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-sm font-medium">Selecione a semana:</p>
          <div className="space-y-2">
            {weekOptions.map(opt => {
              const key = format(opt.start, 'yyyy-MM-dd');
              const isSelected = selectedKey === key;
              const isCurrent = currentKey === key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setSelectedKey(key)}
                  disabled={isPending}
                  className={cn(
                    'w-full flex items-center justify-between gap-2 rounded-md border p-3 text-left transition-colors',
                    isSelected
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/40'
                      : 'border-border hover:bg-muted/50',
                    isPending && 'opacity-60 cursor-not-allowed',
                  )}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium flex items-center gap-1.5">
                      {opt.label}
                      {opt.isSuggested && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-500/40 text-amber-600 bg-amber-500/10">
                          <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                          sugerida
                        </Badge>
                      )}
                      {isCurrent && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-emerald-500/40 text-emerald-600 bg-emerald-500/10">
                          <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                          atual
                        </Badge>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatRange(opt.start, opt.end)}</span>
                  </div>
                  <div
                    className={cn(
                      'h-4 w-4 rounded-full border-2 flex-shrink-0',
                      isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/40',
                    )}
                  />
                </button>
              );
            })}
          </div>

          {currentOption && (
            <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
              <p className="text-xs text-amber-700 dark:text-amber-300">
                ⚠️ Encaixado atualmente em <strong>{formatRange(currentOption.start, currentOption.end)}</strong>
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full border-amber-500/40 text-amber-700 hover:bg-amber-500/10"
                onClick={handleRemove}
                disabled={isPending}
              >
                {desencaixar.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <PackageX className="h-4 w-4 mr-2" />
                )}
                Remover encaixe (voltar ao bucket natural)
              </Button>
            </div>
          )}

          {selectedOption && !isSameAsCurrent && (
            <p className="text-xs text-muted-foreground mt-2">
              O lead aparecerá em <strong>Aprovados</strong> da semana{' '}
              <strong>{formatRange(selectedOption.start, selectedOption.end)}</strong>.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isPending || isSameAsCurrent || !attendeeId}
          >
            {encaixar.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <PackagePlus className="h-4 w-4 mr-2" />
            )}
            {isSameAsCurrent ? 'Já está nesta semana' : 'Confirmar Encaixe'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}