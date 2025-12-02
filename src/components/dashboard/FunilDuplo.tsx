import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter } from "lucide-react";
import { FunilLista } from "./FunilLista";
import { useClintFunnelByLeadType } from "@/hooks/useClintFunnelByLeadType";
import { startOfDay, endOfDay, startOfMonth, endOfMonth, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getCustomWeekStart, getCustomWeekEnd, getCustomWeekNumber, formatCustomWeekRange } from "@/lib/dateHelpers";

const DEFAULT_STAGES = [
  "cf4a369c-c4a6-4299-933d-5ae3dcc39d4b", // Novo Lead
  "a8365215-fd31-4bdc-bbe7-77100fa39e53", // Reunião 01 Agendada
  "34995d75-933e-4d67-b7fc-19fcb8b81680", // Reunião 01 Realizada
  "062927f5-b7a3-496a-9d47-eb03b3d69b10", // Contrato Pago
  "3a2776e2-a536-4a2a-bb7b-a2f53c8941df", // Venda realizada
];

interface FunilDuploProps {
  originId: string;
  weekStart?: Date;
  weekEnd?: Date;
  showCurrentState: boolean;
}

type PeriodType = "hoje" | "semana" | "mes";

export function FunilDuplo({ originId, weekStart, weekEnd, showCurrentState }: FunilDuploProps) {
  const [selectedStages, setSelectedStages] = useState<string[]>(DEFAULT_STAGES);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("hoje");

  // Calcular datas baseado no período selecionado
  const { periodStart, periodEnd } = useMemo(() => {
    const referenceDate = weekStart || new Date();

    switch (selectedPeriod) {
      case "hoje":
        return {
          periodStart: startOfDay(new Date()),
          periodEnd: endOfDay(new Date()),
        };
      case "semana":
        return {
          periodStart: getCustomWeekStart(referenceDate),
          periodEnd: getCustomWeekEnd(referenceDate),
        };
      case "mes":
        return {
          periodStart: startOfMonth(referenceDate),
          periodEnd: endOfMonth(referenceDate),
        };
      default:
        return {
          periodStart: startOfDay(new Date()),
          periodEnd: endOfDay(new Date()),
        };
    }
  }, [selectedPeriod, weekStart]);

  const { data: etapasLeadA = [], isLoading: isLoadingA } = useClintFunnelByLeadType(
    originId,
    "A",
    periodStart,
    periodEnd,
    false, // Sempre usar período histórico com os botões
    selectedPeriod, // Passar o tipo de período para calcular meta correta
  );

  const { data: etapasLeadB = [], isLoading: isLoadingB } = useClintFunnelByLeadType(
    originId,
    "B",
    periodStart,
    periodEnd,
    false, // Sempre usar período histórico com os botões
    selectedPeriod, // Passar o tipo de período para calcular meta correta
  );

  const isLoading = isLoadingA || isLoadingB;

  // Combinar todas as etapas únicas para o filtro
  const allStages = Array.from(
    new Set([...etapasLeadA.map((e) => e.stage_id || e.etapa), ...etapasLeadB.map((e) => e.stage_id || e.etapa)]),
  );

  // Mapear nomes das etapas
  const stageNames: Record<string, string> = {};
  [...etapasLeadA, ...etapasLeadB].forEach((etapa) => {
    if (etapa.stage_id) {
      stageNames[etapa.stage_id] = etapa.etapa;
    }
  });

  // Calcular labels para o dropdown
  const getWeekLabel = () => {
    const referenceDate = weekStart || new Date();
    const weekNum = getCustomWeekNumber(referenceDate);
    const weekNumber = weekNum.split("-W")[1];
    const range = formatCustomWeekRange(referenceDate);
    return `Semana ${weekNumber} (${range})`;
  };

  const getMonthLabel = () => {
    const referenceDate = weekStart || new Date();
    return format(referenceDate, "MMMM yyyy", { locale: ptBR });
  };

  const handleToggleStage = (stageId: string) => {
    setSelectedStages((prev) => (prev.includes(stageId) ? prev.filter((id) => id !== stageId) : [...prev, stageId]));
  };

  const visibleCount = selectedStages.length;

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-foreground">Funil Pipeline Inside Sales</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={selectedPeriod} onValueChange={(value) => setSelectedPeriod(value as PeriodType)}>
              <SelectTrigger className="w-auto h-8 min-w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hoje">Hoje ({format(new Date(), "dd/MM/yyyy", { locale: ptBR })})</SelectItem>
                <SelectItem value="semana">{getWeekLabel()}</SelectItem>
                <SelectItem value="mes">{getMonthLabel()}</SelectItem>
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <button className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3">
                  <Filter className="h-4 w-4" />
                  Filtrar Etapas ({visibleCount}/{allStages.length})
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm">Selecionar Etapas</h4>
                  <div className="space-y-2">
                    {allStages.map((stageId) => (
                      <div key={stageId} className="flex items-center space-x-2">
                        <Checkbox
                          id={stageId}
                          checked={selectedStages.includes(stageId)}
                          onCheckedChange={() => handleToggleStage(stageId)}
                        />
                        <label
                          htmlFor={stageId}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {stageNames[stageId] || stageId}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <FunilLista
              titulo="Leads A"
              etapas={etapasLeadA}
              selectedStages={selectedStages}
              isLoading={isLoading}
              hideFilter
            />
          </div>
          <div className="space-y-4">
            <FunilLista
              titulo="Leads B (Instagram)"
              etapas={etapasLeadB}
              selectedStages={selectedStages}
              isLoading={isLoading}
              hideFilter
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
