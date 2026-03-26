import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ComparisonMode, MetaMode } from "@/hooks/useSdrPerformanceData";

type PeriodPreset = "today" | "yesterday" | "last7" | "last30" | "this_month" | "custom";

interface SdrPerformanceFiltersProps {
  onFiltersChange: (filters: {
    startDate: Date;
    endDate: Date;
    comparisonMode: ComparisonMode;
    metaMode: MetaMode;
    customMeta?: number;
  }) => void;
  startDate: Date;
  endDate: Date;
  comparisonMode: ComparisonMode;
  metaMode: MetaMode;
  customMeta?: number;
}

export function SdrPerformanceFilters({
  onFiltersChange,
  startDate,
  endDate,
  comparisonMode,
  metaMode,
  customMeta,
}: SdrPerformanceFiltersProps) {
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("this_month");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: startDate,
    to: endDate,
  });

  const handlePeriodChange = (value: PeriodPreset) => {
    setPeriodPreset(value);
    const today = new Date();
    let start: Date;
    let end: Date;

    switch (value) {
      case "today":
        start = today;
        end = today;
        break;
      case "yesterday":
        start = new Date(today.getTime() - 86400000);
        end = new Date(today.getTime() - 86400000);
        break;
      case "last7":
        start = new Date(today.getTime() - 6 * 86400000);
        end = today;
        break;
      case "last30":
        start = new Date(today.getTime() - 29 * 86400000);
        end = today;
        break;
      case "this_month":
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      default:
        return;
    }
    setDateRange({ from: start, to: end });
    onFiltersChange({ startDate: start, endDate: end, comparisonMode, metaMode, customMeta });
  };

  const handleComparisonChange = (value: ComparisonMode) => {
    onFiltersChange({ startDate, endDate, comparisonMode: value, metaMode, customMeta });
  };

  const handleMetaModeChange = (value: MetaMode) => {
    onFiltersChange({ startDate, endDate, comparisonMode, metaMode: value, customMeta });
  };

  const handleCustomMetaChange = (value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      onFiltersChange({ startDate, endDate, comparisonMode, metaMode, customMeta: num });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-card rounded-xl border border-border">
      {/* Period */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Período</span>
        <Select value={periodPreset} onValueChange={(v) => handlePeriodChange(v as PeriodPreset)}>
          <SelectTrigger className="w-[150px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="yesterday">Ontem</SelectItem>
            <SelectItem value="last7">Últimos 7 dias</SelectItem>
            <SelectItem value="last30">Últimos 30 dias</SelectItem>
            <SelectItem value="this_month">Este mês</SelectItem>
            <SelectItem value="custom">Personalizado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {periodPreset === "custom" && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
              <CalendarIcon className="h-3 w-3" />
              {dateRange.from
                ? `${format(dateRange.from, "dd/MM", { locale: ptBR })} - ${dateRange.to ? format(dateRange.to, "dd/MM", { locale: ptBR }) : "..."}`
                : "Selecionar"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={(range) => {
                setDateRange({ from: range?.from, to: range?.to });
                if (range?.from && range?.to) {
                  onFiltersChange({
                    startDate: range.from,
                    endDate: range.to,
                    comparisonMode,
                    metaMode,
                    customMeta,
                  });
                }
              }}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      )}

      <div className="w-px h-6 bg-border" />

      {/* Comparison */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Comparação</span>
        <Select value={comparisonMode} onValueChange={(v) => handleComparisonChange(v as ComparisonMode)}>
          <SelectTrigger className="w-[200px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem comparação</SelectItem>
            <SelectItem value="prev_month">Mesmo período mês anterior</SelectItem>
            <SelectItem value="prev_period">Período anterior imediato</SelectItem>
            <SelectItem value="prev_year">Mesmo período ano anterior</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="w-px h-6 bg-border" />

      {/* Meta Mode */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Meta</span>
        <Select value={metaMode} onValueChange={(v) => handleMetaModeChange(v as MetaMode)}>
          <SelectTrigger className="w-[170px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="monthly_prorated">Mensal rateada</SelectItem>
            <SelectItem value="weekly">Semanal</SelectItem>
            <SelectItem value="per_business_day">Por dia útil</SelectItem>
            <SelectItem value="custom">Personalizada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {metaMode === "custom" && (
        <Input
          type="number"
          placeholder="Meta"
          className="w-[80px] h-8 text-xs"
          defaultValue={customMeta}
          onChange={(e) => handleCustomMetaChange(e.target.value)}
        />
      )}

      {/* Period display */}
      <div className="ml-auto text-xs text-muted-foreground">
        {format(startDate, "dd/MM/yyyy", { locale: ptBR })} — {format(endDate, "dd/MM/yyyy", { locale: ptBR })}
      </div>
    </div>
  );
}
