import { History, ArrowRight, UserPlus, DollarSign, Users, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyEmployeeEvents } from "@/hooks/useMyEmployee";
import type { Employee } from "@/types/hr";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MeuRHHistoricoSectionProps {
  employee: Employee;
}

const EVENT_ICONS: Record<string, React.ElementType> = {
  admissao: UserPlus,
  promocao: Star,
  mudanca_cargo: Users,
  mudanca_equipe: Users,
  ajuste_salarial: DollarSign,
  default: ArrowRight,
};

export function MeuRHHistoricoSection({ employee }: MeuRHHistoricoSectionProps) {
  const { data: events, isLoading } = useMyEmployeeEvents(employee.id);

  // Only show first 10 events
  const visibleEvents = events?.slice(0, 10) || [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <History className="h-4 w-4" />
          Histórico de vínculo
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : visibleEvents.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            Nenhum evento registrado
          </p>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />
            
            <div className="space-y-4">
              {visibleEvents.map((event, index) => {
                const Icon = EVENT_ICONS[event.tipo_evento] || EVENT_ICONS.default;
                return (
                  <div key={event.id} className="relative pl-8">
                    {/* Timeline dot */}
                    <div className="absolute left-0 top-1 h-6 w-6 rounded-full bg-background border-2 border-primary flex items-center justify-center">
                      <Icon className="h-3 w-3 text-primary" />
                    </div>
                    
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">
                          {format(new Date(event.data_evento), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </span>
                        <span className="text-[10px] text-muted-foreground capitalize">
                          - {event.tipo_evento.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-sm">{event.titulo}</p>
                      {event.descricao && (
                        <p className="text-xs text-muted-foreground">{event.descricao}</p>
                      )}
                      {event.valor_anterior && event.valor_novo && (
                        <p className="text-xs text-muted-foreground">
                          {event.valor_anterior} → {event.valor_novo}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
