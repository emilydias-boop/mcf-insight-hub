import { useState } from 'react';
import { format, startOfMonth, endOfMonth, subMonths, subWeeks, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CONSORCIO_WEEK_STARTS_ON } from '@/lib/businessDays';
import { addWeeks } from 'date-fns';

export interface DateRangeFilter {
  startDate: Date | undefined;
  endDate: Date | undefined;
  label: string;
}

interface ConsorcioPeriodFilterProps {
  value: DateRangeFilter;
  onChange: (value: DateRangeFilter) => void;
}

const PERIOD_OPTIONS = [
  { id: 'this-week', label: 'Esta Semana' },
  { id: 'last-week', label: 'Semana Ant.' },
  { id: 'this-month', label: 'Este Mês' },
  { id: 'last-month', label: 'Mês Ant.' },
  { id: 'all', label: 'Todo Período' },
] as const;

export function ConsorcioPeriodFilter({ value, onChange }: ConsorcioPeriodFilterProps) {
  const [open, setOpen] = useState(false);
  const [tempStart, setTempStart] = useState<Date | undefined>(value.startDate);
  const [tempEnd, setTempEnd] = useState<Date | undefined>(value.endDate);

  const now = new Date();

  const handlePeriodSelect = (periodId: string) => {
    let startDate: Date | undefined;
    let endDate: Date | undefined;
    let label: string;

    switch (periodId) {
      case 'this-week':
        startDate = startOfWeek(now, { weekStartsOn: CONSORCIO_WEEK_STARTS_ON });
        endDate = endOfWeek(now, { weekStartsOn: CONSORCIO_WEEK_STARTS_ON });
        endDate = endOfWeek(now, { weekStartsOn: CONSORCIO_WEEK_STARTS_ON });
        label = `${format(startDate, 'dd/MM')} - ${format(endDate, 'dd/MM')}`;
        break;
      case 'last-week':
        const lastWeek = addWeeks(now, -1);
        startDate = startOfWeek(lastWeek, { weekStartsOn: CONSORCIO_WEEK_STARTS_ON });
        endDate = endOfWeek(lastWeek, { weekStartsOn: CONSORCIO_WEEK_STARTS_ON });
        label = `${format(startDate, 'dd/MM')} - ${format(endDate, 'dd/MM')}`;
        break;
      case 'this-month':
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        label = format(now, 'MMMM', { locale: ptBR });
        break;
      case 'last-month':
        const lastMonth = subMonths(now, 1);
        startDate = startOfMonth(lastMonth);
        endDate = endOfMonth(lastMonth);
        label = format(lastMonth, 'MMMM', { locale: ptBR });
        break;
      case 'all':
        startDate = undefined;
        endDate = undefined;
        label = 'Todo Período';
        break;
      default:
        return;
    }

    onChange({ startDate, endDate, label });
    setTempStart(startDate);
    setTempEnd(endDate);
    setOpen(false);
  };

  const handleApplyCustom = () => {
    if (tempStart && tempEnd) {
      const label = `${format(tempStart, 'dd/MM')} - ${format(tempEnd, 'dd/MM')}`;
      onChange({ startDate: tempStart, endDate: tempEnd, label });
    } else if (tempStart) {
      const label = `A partir de ${format(tempStart, 'dd/MM')}`;
      onChange({ startDate: tempStart, endDate: undefined, label });
    } else if (tempEnd) {
      const label = `Até ${format(tempEnd, 'dd/MM')}`;
      onChange({ startDate: undefined, endDate: tempEnd, label });
    }
    setOpen(false);
  };

  const handleClear = () => {
    onChange({ startDate: undefined, endDate: undefined, label: 'Período' });
    setTempStart(undefined);
    setTempEnd(undefined);
  };

  const displayText = value.label || 'Período';
  const hasFilter = value.startDate || value.endDate;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          className={cn(
            "w-44 justify-start text-left font-normal",
            hasFilter && "border-primary"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          <span className="truncate flex-1">{displayText}</span>
          {hasFilter && (
            <X 
              className="h-4 w-4 ml-1 hover:text-destructive" 
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3 space-y-3">
          {/* Period shortcuts */}
          <div className="flex flex-wrap gap-2">
            {PERIOD_OPTIONS.map(opt => (
              <Button
                key={opt.id}
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => handlePeriodSelect(opt.id)}
              >
                {opt.label}
              </Button>
            ))}
          </div>

          {/* Custom date range */}
          <div className="border-t pt-3 space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Período customizado</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-muted-foreground mb-1">De:</p>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full justify-start text-left"
                    >
                      <CalendarIcon className="mr-2 h-3 w-3" />
                      {tempStart ? format(tempStart, 'dd/MM/yy') : 'Início'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={tempStart}
                      onSelect={setTempStart}
                      locale={ptBR}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Até:</p>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full justify-start text-left"
                    >
                      <CalendarIcon className="mr-2 h-3 w-3" />
                      {tempEnd ? format(tempEnd, 'dd/MM/yy') : 'Fim'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={tempEnd}
                      onSelect={setTempEnd}
                      locale={ptBR}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 border-t pt-3">
            <Button 
              variant="ghost" 
              size="sm" 
              className="flex-1" 
              onClick={handleClear}
            >
              Limpar
            </Button>
            <Button 
              size="sm" 
              className="flex-1" 
              onClick={handleApplyCustom}
              disabled={!tempStart && !tempEnd}
            >
              Aplicar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
