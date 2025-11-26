import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Filter } from "lucide-react";
import { FunilLista } from "./FunilLista";
import { useClintFunnelByLeadType } from "@/hooks/useClintFunnelByLeadType";

// Etapas fixas que devem sempre aparecer por padrão
const DEFAULT_STAGES = [
  'cf4a369c-c4a6-4299-933d-5ae3dcc39d4b', // Novo Lead
  'a8365215-fd31-4bdc-bbe7-77100fa39e53', // Reunião 01 Agendada
  '34995d75-933e-4d67-b7fc-19fcb8b81680', // Reunião 01 Realizada
  '062927f5-b7a3-496a-9d47-eb03b3d69b10', // Contrato Pago
  '3a2776e2-a536-4a2a-bb7b-a2f53c8941df', // Venda realizada
];

interface FunilDuploProps {
  originId: string;
  weekStart?: Date;
  weekEnd?: Date;
  showCurrentState: boolean;
}

export function FunilDuplo({ originId, weekStart, weekEnd, showCurrentState }: FunilDuploProps) {
  const [selectedStages, setSelectedStages] = useState<string[]>(DEFAULT_STAGES);

  const { data: etapasLeadA = [], isLoading: isLoadingA } = useClintFunnelByLeadType(
    originId,
    'A',
    weekStart,
    weekEnd,
    showCurrentState
  );

  const { data: etapasLeadB = [], isLoading: isLoadingB } = useClintFunnelByLeadType(
    originId,
    'B',
    weekStart,
    weekEnd,
    showCurrentState
  );

  const isLoading = isLoadingA || isLoadingB;

  // Combinar todas as etapas únicas para o filtro
  const allStages = Array.from(
    new Set([
      ...etapasLeadA.map(e => e.stage_id || e.etapa),
      ...etapasLeadB.map(e => e.stage_id || e.etapa)
    ])
  );

  // Mapear nomes das etapas
  const stageNames: Record<string, string> = {};
  [...etapasLeadA, ...etapasLeadB].forEach(etapa => {
    if (etapa.stage_id) {
      stageNames[etapa.stage_id] = etapa.etapa;
    }
  });

  const handleToggleStage = (stageId: string) => {
    setSelectedStages(prev =>
      prev.includes(stageId)
        ? prev.filter(id => id !== stageId)
        : [...prev, stageId]
    );
  };

  const visibleCount = selectedStages.length;

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-foreground">Funil Pipeline Inside Sales</CardTitle>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filtrar Etapas ({visibleCount}/{allStages.length})
              </Button>
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
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <FunilLista
              titulo="Leads A (A010)"
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
