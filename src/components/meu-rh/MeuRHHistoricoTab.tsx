import { History, UserPlus, TrendingUp, DollarSign, MessageSquare, Award, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyEmployeeEvents } from "@/hooks/useMyEmployee";
import type { Employee } from "@/types/hr";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MeuRHHistoricoTabProps {
  employee: Employee;
}

const EVENT_ICONS: Record<string, any> = {
  admissao: UserPlus,
  promocao: TrendingUp,
  ajuste_salarial: DollarSign,
  feedback: MessageSquare,
  elogio: Award,
  advertencia: AlertTriangle,
  mudanca_cargo: TrendingUp,
  default: History,
};

const EVENT_COLORS: Record<string, string> = {
  admissao: 'bg-green-500/20 text-green-500',
  promocao: 'bg-blue-500/20 text-blue-500',
  ajuste_salarial: 'bg-purple-500/20 text-purple-500',
  feedback: 'bg-gray-500/20 text-gray-400',
  elogio: 'bg-yellow-500/20 text-yellow-500',
  advertencia: 'bg-red-500/20 text-red-500',
  mudanca_cargo: 'bg-blue-500/20 text-blue-500',
  default: 'bg-muted text-muted-foreground',
};

export function MeuRHHistoricoTab({ employee }: MeuRHHistoricoTabProps) {
  const { data: events, isLoading } = useMyEmployeeEvents(employee.id);

  const getIcon = (tipo: string) => {
    const Icon = EVENT_ICONS[tipo] || EVENT_ICONS.default;
    return Icon;
  };

  const getColor = (tipo: string) => {
    return EVENT_COLORS[tipo] || EVENT_COLORS.default;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <History className="h-4 w-4" />
            Linha do Tempo
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : !events || events.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              Nenhum evento registrado
            </p>
          ) : (
            <div className="relative">
              {/* Linha vertical */}
              <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

              <div className="space-y-4">
                {events.map((event, index) => {
                  const Icon = getIcon(event.tipo_evento);
                  const colorClass = getColor(event.tipo_evento);

                  return (
                    <div key={event.id} className="relative flex gap-4">
                      {/* Ícone */}
                      <div className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full ${colorClass}`}>
                        <Icon className="h-4 w-4" />
                      </div>

                      {/* Conteúdo */}
                      <div className="flex-1 pb-4">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-xs font-medium">{event.titulo}</p>
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(event.data_evento), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                          </span>
                        </div>
                        {event.descricao && (
                          <p className="text-[11px] text-muted-foreground">{event.descricao}</p>
                        )}
                        {(event.valor_anterior || event.valor_novo) && (
                          <div className="flex items-center gap-2 mt-1 text-[10px]">
                            {event.valor_anterior && (
                              <span className="text-muted-foreground line-through">{event.valor_anterior}</span>
                            )}
                            {event.valor_anterior && event.valor_novo && (
                              <span className="text-muted-foreground">→</span>
                            )}
                            {event.valor_novo && (
                              <span className="text-primary font-medium">{event.valor_novo}</span>
                            )}
                          </div>
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
    </div>
  );
}
