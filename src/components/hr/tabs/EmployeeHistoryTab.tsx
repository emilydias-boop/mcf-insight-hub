import { Employee, EmployeeEvent } from '@/types/hr';
import { useEmployeeEvents, useEmployeeMutations } from '@/hooks/useEmployees';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  History, 
  Plus, 
  TrendingUp, 
  Award, 
  AlertTriangle, 
  Calendar,
  ArrowRight,
  Briefcase
} from 'lucide-react';

interface EmployeeHistoryTabProps {
  employee: Employee;
}

const EVENT_ICONS: Record<string, React.ReactNode> = {
  promocao: <TrendingUp className="h-4 w-4 text-green-500" />,
  aumento: <Award className="h-4 w-4 text-blue-500" />,
  advertencia: <AlertTriangle className="h-4 w-4 text-red-500" />,
  ferias: <Calendar className="h-4 w-4 text-cyan-500" />,
  transferencia: <ArrowRight className="h-4 w-4 text-purple-500" />,
  mudanca_cargo: <Briefcase className="h-4 w-4 text-orange-500" />,
};

export default function EmployeeHistoryTab({ employee }: EmployeeHistoryTabProps) {
  const { data: events, isLoading } = useEmployeeEvents(employee.id);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          Registrar Evento
        </Button>
      </div>

      {events && events.length > 0 ? (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

          <div className="space-y-4">
            {events.map((event, index) => (
              <div key={event.id} className="relative pl-10">
                {/* Timeline dot */}
                <div className="absolute left-0 w-8 h-8 rounded-full bg-background border-2 flex items-center justify-center">
                  {EVENT_ICONS[event.tipo_evento] || <History className="h-4 w-4 text-muted-foreground" />}
                </div>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{event.titulo}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(event.data_evento), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </p>
                      </div>
                      <span className="text-xs bg-muted px-2 py-1 rounded capitalize">
                        {event.tipo_evento.replace('_', ' ')}
                      </span>
                    </div>

                    {event.descricao && (
                      <p className="text-sm text-muted-foreground mt-2">
                        {event.descricao}
                      </p>
                    )}

                    {(event.valor_anterior || event.valor_novo) && (
                      <div className="flex items-center gap-2 mt-2 text-sm">
                        {event.valor_anterior && (
                          <span className="line-through text-muted-foreground">
                            {event.valor_anterior}
                          </span>
                        )}
                        {event.valor_anterior && event.valor_novo && (
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        {event.valor_novo && (
                          <span className="font-medium text-green-600">
                            {event.valor_novo}
                          </span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhum evento registrado</p>
            <p className="text-xs mt-1">Registre promoções, mudanças de cargo, etc.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
