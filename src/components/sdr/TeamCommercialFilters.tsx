import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePickerCustom } from "@/components/ui/DatePickerCustom";
import { PipelineSelector } from "@/components/crm/PipelineSelector";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type TeamCommercialDatePreset = "today" | "week" | "month" | "custom";

interface TeamCommercialFiltersProps {
  datePreset: TeamCommercialDatePreset;
  selectedMonth: Date;
  start: Date;
  end: Date;
  customStartDate: Date | null;
  customEndDate: Date | null;
  selectedPipelineId: string | null;
  allowedGroupIds: string[];
  sdrFilter: string;
  sdrOptions: Array<{ value: string; label: string }>;
  isLoading?: boolean;
  onPresetChange: (preset: TeamCommercialDatePreset) => void;
  onMonthChange: (increment: number) => void;
  onCustomStartChange: (date: Date | null) => void;
  onCustomEndChange: (date: Date | null) => void;
  onSelectPipeline: (id: string | null) => void;
  onSdrFilterChange: (value: string) => void;
  onExport: () => void;
}

export function TeamCommercialFilters({
  datePreset,
  selectedMonth,
  start,
  end,
  customStartDate,
  customEndDate,
  selectedPipelineId,
  allowedGroupIds,
  sdrFilter,
  sdrOptions,
  isLoading,
  onPresetChange,
  onMonthChange,
  onCustomStartChange,
  onCustomEndChange,
  onSelectPipeline,
  onSdrFilterChange,
  onExport,
}: TeamCommercialFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 sm:gap-4">
      <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-full sm:w-auto">
        <Button variant={datePreset === "today" ? "secondary" : "ghost"} size="sm" onClick={() => onPresetChange("today")} className="flex-1 sm:flex-initial text-xs sm:text-sm">Hoje</Button>
        <Button variant={datePreset === "week" ? "secondary" : "ghost"} size="sm" onClick={() => onPresetChange("week")} className="flex-1 sm:flex-initial text-xs sm:text-sm">Semana</Button>
        <Button variant={datePreset === "month" ? "secondary" : "ghost"} size="sm" onClick={() => onPresetChange("month")} className="flex-1 sm:flex-initial text-xs sm:text-sm">Mês</Button>
        <Button variant={datePreset === "custom" ? "secondary" : "ghost"} size="sm" onClick={() => onPresetChange("custom")} className="flex-1 sm:flex-initial text-xs sm:text-sm">Custom</Button>
      </div>

      {datePreset === "month" && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => onMonthChange(-1)} aria-label="Mês anterior">
            <Calendar className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[120px] text-center">
            {format(selectedMonth, "MMMM yyyy", { locale: ptBR })}
          </span>
          <Button variant="outline" size="icon" onClick={() => onMonthChange(1)} aria-label="Próximo mês">
            <Calendar className="h-4 w-4" />
          </Button>
        </div>
      )}

      {datePreset === "custom" && (
        <div className="flex items-center gap-2">
          <DatePickerCustom selected={customStartDate || undefined} onSelect={(date) => onCustomStartChange(date as Date | null)} placeholder="Data início" />
          <span className="text-muted-foreground">até</span>
          <DatePickerCustom selected={customEndDate || undefined} onSelect={(date) => onCustomEndChange(date as Date | null)} placeholder="Data fim" />
        </div>
      )}

      <PipelineSelector
        selectedPipelineId={selectedPipelineId}
        onSelectPipeline={onSelectPipeline}
        allowedGroupIds={allowedGroupIds}
      />

      <Select value={sdrFilter} onValueChange={onSdrFilterChange}>
        <SelectTrigger className="w-full sm:w-[200px]">
          <SelectValue placeholder="Filtrar por SDR" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os SDRs</SelectItem>
          {sdrOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button variant="outline" size="sm" onClick={onExport} disabled={isLoading} className="w-full sm:w-auto">
        <Download className="h-4 w-4 mr-1" />
        <span className="sm:inline">Exportar</span>
      </Button>

      <div className="basis-full text-xs text-muted-foreground">
        Período: {format(start, "dd/MM/yyyy")} - {format(end, "dd/MM/yyyy")}
      </div>
    </div>
  );
}