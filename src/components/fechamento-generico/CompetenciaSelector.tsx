import { useMemo } from "react";
import { format, parse, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CompetenciaSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function CompetenciaSelector({ value, onChange }: CompetenciaSelectorProps) {
  // Generate list of months (6 months back, 6 months forward)
  const months = useMemo(() => {
    const today = new Date();
    const list: { value: string; label: string }[] = [];
    
    for (let i = -6; i <= 6; i++) {
      const date = i < 0 ? subMonths(today, Math.abs(i)) : addMonths(today, i);
      const value = format(date, "yyyy-MM");
      const label = format(date, "MMMM yyyy", { locale: ptBR });
      list.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
    }
    
    return list;
  }, []);

  const currentDate = useMemo(() => {
    if (!value) return new Date();
    return parse(value, "yyyy-MM", new Date());
  }, [value]);

  const goToPrevious = () => {
    const prevMonth = subMonths(currentDate, 1);
    onChange(format(prevMonth, "yyyy-MM"));
  };

  const goToNext = () => {
    const nextMonth = addMonths(currentDate, 1);
    onChange(format(nextMonth, "yyyy-MM"));
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={goToPrevious}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Selecione o mês" />
        </SelectTrigger>
        <SelectContent>
          {months.map((month) => (
            <SelectItem key={month.value} value={month.value}>
              {month.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={goToNext}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
