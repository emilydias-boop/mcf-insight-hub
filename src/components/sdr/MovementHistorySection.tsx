import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAttendeeMovementHistory, MovementLog } from '@/hooks/useAttendeeMovementHistory';

interface MovementHistorySectionProps {
  attendeeId: string | null;
}

export function MovementHistorySection({ attendeeId }: MovementHistorySectionProps) {
  const { data: movementHistory, isLoading } = useAttendeeMovementHistory(attendeeId);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          Histórico de Movimentações
        </h4>
        <div className="text-xs text-muted-foreground animate-pulse">
          Carregando...
        </div>
      </div>
    );
  }

  if (!movementHistory || movementHistory.length === 0) {
    return null;
  }

  const getMovementTypeLabel = (type: string) => {
    switch (type) {
      case 'no_show_reschedule':
        return 'Após No-Show';
      case 'same_day_reschedule':
        return 'Mesmo dia';
      case 'admin_override':
        return 'Admin';
      default:
        return 'Reagendamento';
    }
  };

  const getMovementTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'no_show_reschedule':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'same_day_reschedule':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" />
        Histórico de Movimentações
      </h4>
      <div className="bg-muted/30 rounded-lg p-3 border border-border space-y-3 max-h-[200px] overflow-y-auto">
        {movementHistory.map((log) => (
          <div key={log.id} className="text-xs border-l-2 border-amber-500 pl-3 py-1">
            <div className="flex justify-between items-center gap-2">
              <span className="text-muted-foreground">
                {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
              <Badge variant="outline" className={`text-xs ${getMovementTypeBadgeClass(log.movement_type)}`}>
                {getMovementTypeLabel(log.movement_type)}
              </Badge>
            </div>
            <div className="mt-1">
              <span className="text-muted-foreground">Por:</span>{' '}
              <span className="text-foreground">{log.moved_by_name || 'Sistema'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">De:</span>{' '}
              {log.from_scheduled_at 
                ? format(new Date(log.from_scheduled_at), "dd/MM HH:mm", { locale: ptBR }) 
                : '-'
              }
              {log.from_closer_name && (
                <span className="text-muted-foreground"> ({log.from_closer_name})</span>
              )}
              {' → '}
              {format(new Date(log.to_scheduled_at), "dd/MM HH:mm", { locale: ptBR })}
              {log.to_closer_name && (
                <span className="text-muted-foreground"> ({log.to_closer_name})</span>
              )}
            </div>
            {log.reason && (
              <div className="mt-1 italic text-muted-foreground border-t border-border/50 pt-1">
                "{log.reason}"
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
