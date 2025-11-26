import { useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Filter } from "lucide-react";
import { cn } from "@/lib/utils";

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
}

export function FunilLista({ titulo, etapas }: FunilListaProps) {
  const [selectedStages, setSelectedStages] = useState<string[]>(
    etapas.map(e => e.stage_id || e.etapa)
  );

  const visibleEtapas = etapas.filter(e => 
    selectedStages.includes(e.stage_id || e.etapa)
  );

  const handleToggleStage = (stageId: string) => {
    setSelectedStages(prev =>
      prev.includes(stageId)
        ? prev.filter(id => id !== stageId)
        : [...prev, stageId]
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-foreground">{titulo}</h3>
          <span className="text-sm text-muted-foreground">
            • {visibleEtapas.length} de {etapas.length} etapas
          </span>
        </div>
        
        <Popover>
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
        </Popover>
      </div>
      
      <div className="space-y-3">
        {visibleEtapas.map((etapa) => {
          const isAboveMeta = etapa.conversao >= etapa.meta;
          const progressValue = (etapa.conversao / etapa.meta) * 100;
          
          return (
            <div key={etapa.etapa} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">{etapa.etapa}</span>
                <div className="flex items-center gap-4 text-muted-foreground">
                  <span>{etapa.leads}</span>
                  <span>Meta {etapa.meta}</span>
                  <span className={cn(
                    "font-semibold",
                    isAboveMeta ? "text-success" : "text-destructive"
                  )}>
                    {etapa.conversao.toFixed(1)}%
                  </span>
                </div>
              </div>
              <Progress 
                value={Math.min(progressValue, 100)} 
                className={cn(
                  "h-2",
                  isAboveMeta ? "[&>div]:bg-success" : "[&>div]:bg-destructive"
                )}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
