import { useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Filter, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// Etapas fixas que devem sempre aparecer por padrão
const DEFAULT_STAGES = [
  'cf4a369c-c4a6-4299-933d-5ae3dcc39d4b', // Novo Lead
  'a8365215-fd31-4bdc-bbe7-77100fa39e53', // Reunião 01 Agendada
  '34995d75-933e-4d67-b7fc-19fcb8b81680', // Reunião 01 Realizada
  '062927f5-b7a3-496a-9d47-eb03b3d69b10', // Contrato Pago
  '3a2776e2-a536-4a2a-bb7b-a2f53c8941df', // Venda realizada
];

interface FunilEtapa {
  etapa: string;
  leads: number;
  conversao: number;
  meta: number;
  stage_id?: string;
}

interface FunilListaProps {
  titulo: string;
  etapas: FunilEtapa[];
  selectedStages?: string[];
  isLoading?: boolean;
  hideFilter?: boolean;
}

export function FunilLista({ 
  titulo, 
  etapas, 
  selectedStages: externalSelectedStages,
  isLoading = false,
  hideFilter = false 
}: FunilListaProps) {
  const [internalSelectedStages, setInternalSelectedStages] = useState<string[]>(DEFAULT_STAGES);
  
  const selectedStages = externalSelectedStages ?? internalSelectedStages;
  const setSelectedStages = externalSelectedStages ? undefined : setInternalSelectedStages;

  const visibleEtapas = etapas.filter(e => 
    selectedStages.includes(e.stage_id || e.etapa)
  );

  const handleToggleStage = (stageId: string) => {
    if (setSelectedStages) {
      setSelectedStages(prev =>
        prev.includes(stageId)
          ? prev.filter(id => id !== stageId)
          : [...prev, stageId]
      );
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">{titulo}</h3>
        <div className="text-sm text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-foreground">{titulo}</h3>
          <span className="text-sm text-muted-foreground">
            • {visibleEtapas.length} de {etapas.length} etapas
          </span>
        </div>
        
        {!hideFilter && <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filtrar Etapas
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-4">
              <h4 className="font-semibold text-sm">Selecionar Etapas</h4>
              <div className="space-y-2">
                {etapas.map((etapa) => (
                  <div key={etapa.stage_id || etapa.etapa} className="flex items-center space-x-2">
                    <Checkbox
                      id={etapa.stage_id || etapa.etapa}
                      checked={selectedStages.includes(etapa.stage_id || etapa.etapa)}
                      onCheckedChange={() => handleToggleStage(etapa.stage_id || etapa.etapa)}
                    />
                    <label
                      htmlFor={etapa.stage_id || etapa.etapa}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {etapa.etapa}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>}
      </div>
      
      <div className="space-y-3">
        {visibleEtapas.map((etapa) => {
          const semMeta = etapa.meta === 0;
          
          // Calcular porcentagem baseada em leads/meta (quantidade de leads)
          const progressPercent = etapa.meta > 0 ? (etapa.leads / etapa.meta) * 100 : 0;
          
          // Definir cor baseada na porcentagem
          let progressColorClass = "[&>div]:bg-muted"; // cinza se sem meta
          let textColorClass = "text-muted-foreground";
          
          if (!semMeta) {
            if (progressPercent >= 80) {
              progressColorClass = "[&>div]:bg-success"; // verde >= 80%
              textColorClass = "text-success";
            } else if (progressPercent >= 35) {
              progressColorClass = "[&>div]:bg-warning"; // amarelo 35-79%
              textColorClass = "text-warning";
            } else {
              progressColorClass = "[&>div]:bg-destructive"; // vermelho < 35%
              textColorClass = "text-destructive";
            }
          }
          
          return (
            <div key={etapa.etapa} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{etapa.etapa}</span>
                  {semMeta && (
                    <Badge variant="outline" className="gap-1 text-xs">
                      <AlertCircle className="h-3 w-3" />
                      Sem meta
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 text-muted-foreground">
                  {semMeta ? (
                    <span>{etapa.leads} leads</span>
                  ) : (
                    <>
                      <span>{etapa.leads}/{etapa.meta} leads</span>
                      <span className={cn("font-semibold", textColorClass)}>
                        {progressPercent.toFixed(1)}%
                      </span>
                    </>
                  )}
                </div>
              </div>
              <Progress 
                value={semMeta ? 0 : Math.min(progressPercent, 100)} 
                className={cn("h-2", progressColorClass)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
