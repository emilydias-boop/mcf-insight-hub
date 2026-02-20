import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Trash2, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CarrinhoWeekOverride } from '@/hooks/useCarrinhoWeekOverride';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentOverride: { start: Date; end: Date; label: string } | null | undefined;
  onSave: (data: CarrinhoWeekOverride) => void;
  onRemove: () => void;
  isSaving: boolean;
}

export function CarrinhoWeekOverrideDialog({ open, onOpenChange, currentOverride, onSave, onRemove, isSaving }: Props) {
  const [startDate, setStartDate] = useState<Date | undefined>(currentOverride?.start);
  const [endDate, setEndDate] = useState<Date | undefined>(currentOverride?.end);
  const [label, setLabel] = useState(currentOverride?.label || '');

  useEffect(() => {
    if (open) {
      setStartDate(currentOverride?.start);
      setEndDate(currentOverride?.end);
      setLabel(currentOverride?.label || '');
    }
  }, [open, currentOverride]);

  const handleSave = () => {
    if (!startDate || !endDate) return;
    onSave({
      start: format(startDate, 'yyyy-MM-dd'),
      end: format(endDate, 'yyyy-MM-dd'),
      label: label || undefined,
    });
    onOpenChange(false);
  };

  const handleRemove = () => {
    onRemove();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar Semana do Carrinho</DialogTitle>
          <DialogDescription>
            Defina datas customizadas para situações excepcionais (feriados, etc.)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Start Date */}
          <div className="space-y-2">
            <Label>Início da semana</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          {/* End Date */}
          <div className="space-y-2">
            <Label>Fim da semana</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          {/* Label */}
          <div className="space-y-2">
            <Label>Motivo (opcional)</Label>
            <Input placeholder="Ex: Feriado de Carnaval" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            {currentOverride ? (
              <Button variant="destructive" size="sm" onClick={handleRemove}>
                <Trash2 className="h-4 w-4 mr-1" />
                Remover Exceção
              </Button>
            ) : (
              <div />
            )}
            <Button onClick={handleSave} disabled={!startDate || !endDate || isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Salvar Exceção
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
