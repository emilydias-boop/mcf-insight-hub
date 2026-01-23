import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Filter, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PeriodType, ChairmanFilters as FilterType } from "@/hooks/useChairmanMetrics";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

interface ChairmanFiltersProps {
  filters: FilterType;
  onFiltersChange: (filters: FilterType) => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: 'week', label: 'Esta Semana' },
  { value: 'month', label: 'Este Mês' },
  { value: 'quarter', label: 'Este Trimestre' },
  { value: 'year', label: 'Este Ano' },
  { value: 'custom', label: 'Personalizado' },
];

export const ChairmanFiltersComponent = ({ 
  filters, 
  onFiltersChange, 
  onRefresh,
  isLoading 
}: ChairmanFiltersProps) => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    filters.startDate && filters.endDate 
      ? { from: filters.startDate, to: filters.endDate }
      : undefined
  );

  const handlePeriodChange = (value: PeriodType) => {
    onFiltersChange({
      ...filters,
      periodType: value,
      startDate: undefined,
      endDate: undefined,
    });
  };

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range);
    if (range?.from && range?.to) {
      onFiltersChange({
        ...filters,
        periodType: 'custom',
        startDate: range.from,
        endDate: range.to,
      });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Period selector */}
      <Select value={filters.periodType} onValueChange={handlePeriodChange}>
        <SelectTrigger className="w-[160px] bg-card/50 border-border/50">
          <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
          <SelectValue placeholder="Período" />
        </SelectTrigger>
        <SelectContent>
          {PERIOD_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Custom date range */}
      {filters.periodType === 'custom' && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "justify-start text-left font-normal bg-card/50 border-border/50",
                !dateRange && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "dd/MM/yy", { locale: ptBR })} -{" "}
                    {format(dateRange.to, "dd/MM/yy", { locale: ptBR })}
                  </>
                ) : (
                  format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
                )
              ) : (
                "Selecionar período"
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={handleDateRangeChange}
              numberOfMonths={2}
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>
      )}

      {/* Refresh button */}
      <Button
        variant="outline"
        size="icon"
        onClick={onRefresh}
        disabled={isLoading}
        className="bg-card/50 border-border/50"
      >
        <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
      </Button>
    </div>
  );
};
