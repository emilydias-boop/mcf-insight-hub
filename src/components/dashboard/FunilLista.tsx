import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface FunilEtapa {
  etapa: string;
  leads: number;
  conversao: number;
  meta: number;
}

interface FunilListaProps {
  titulo: string;
  etapas: FunilEtapa[];
}

export function FunilLista({ titulo, etapas }: FunilListaProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold text-foreground">{titulo}</h3>
        <span className="text-sm text-muted-foreground">
          • Etapas {etapas.map((e) => e.etapa.split(' ')[1]).join(' / ')}
        </span>
      </div>
      
      <div className="space-y-3">
        {etapas.map((etapa) => {
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
