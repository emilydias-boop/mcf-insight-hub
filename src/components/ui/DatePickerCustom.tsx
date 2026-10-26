import * as React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerCustomProps {
  selected?: Date | DateRange;
  onSelect?: (date: Date | DateRange | undefined) => void;
  mode?: "single" | "range";
  placeholder?: string;
}

export function DatePickerCustom({ 
  selected, 
  onSelect, 
  mode = "single",
  placeholder = "Selecione uma data" 
}: DatePickerCustomProps) {
  const [open, setOpen] = React.useState(false);
  // true depois do 1º clique: o próximo clique define o fim do período.
  const awaitingEndRef = React.useRef(false);
  React.useEffect(() => {
    if (open) awaitingEndRef.current = false;
  }, [open]);

  const getDisplayText = () => {
    if (!selected) return placeholder;
    
    if (mode === "range" && selected && typeof selected === 'object' && 'from' in selected) {
      const range = selected as DateRange;
      if (range.from) {
        if (range.to && format(range.to, "yyyy-MM-dd") !== format(range.from, "yyyy-MM-dd")) {
          return `${format(range.from, "dd/MM/yyyy", { locale: ptBR })} — ${format(range.to, "dd/MM/yyyy", { locale: ptBR })}`;
        }
        return format(range.from, "dd/MM/yyyy", { locale: ptBR });
      }
      return placeholder;
    }
    
    if (mode === "single" && selected instanceof Date) {
      return format(selected, "dd/MM/yyyy", { locale: ptBR });
    }
    
    return placeholder;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !selected && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {getDisplayText()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
        {mode === "range" ? (
          <Calendar
            mode="range"
            selected={selected as DateRange}
            onSelect={(_range, day) => {
              // Seleção própria: o padrão do react-day-picker devolve to=undefined
              // no 1º clique e desmarca ao clicar de novo no mesmo dia.
              const current = selected as DateRange | undefined;
              let next: DateRange;
              if (awaitingEndRef.current && current?.from) {
                const from = current.from;
                if (day.getTime() < from.getTime()) {
                  next = { from: day, to: current.to ?? from };
                } else {
                  next = { from, to: day };
                }
                awaitingEndRef.current = false;
                onSelect?.(next);
                setOpen(false);
                return;
              }
              next = { from: day, to: day };
              awaitingEndRef.current = true;
              onSelect?.(next);
            }}
            numberOfMonths={2}
            locale={ptBR}
            className="pointer-events-auto"
          />
        ) : (
          <Calendar
            mode="single"
            selected={selected as Date}
            onSelect={(date) => {
              if (onSelect) onSelect(date);
              setOpen(false);
            }}
            locale={ptBR}
            className="pointer-events-auto"
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
