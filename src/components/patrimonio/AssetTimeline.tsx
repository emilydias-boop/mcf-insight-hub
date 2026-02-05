import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AssetHistory, ASSET_EVENT_LABELS, AssetEventType } from '@/types/patrimonio';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  History,
  ShoppingCart,
  UserPlus,
  ArrowRightLeft,
  Wrench,
  Undo2,
  XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AssetTimelineProps {
  history: AssetHistory[];
  isLoading?: boolean;
}

const eventConfig: Record<AssetEventType, { icon: React.ReactNode; color: string }> = {
  comprado: { 
    icon: <ShoppingCart className="h-4 w-4" />, 
    color: 'bg-green-500' 
  },
  liberado: { 
    icon: <UserPlus className="h-4 w-4" />, 
    color: 'bg-blue-500' 
  },
  transferido: { 
    icon: <ArrowRightLeft className="h-4 w-4" />, 
    color: 'bg-purple-500' 
  },
  manutencao: { 
    icon: <Wrench className="h-4 w-4" />, 
    color: 'bg-yellow-500' 
  },
  devolucao: { 
    icon: <Undo2 className="h-4 w-4" />, 
    color: 'bg-gray-500' 
  },
  baixa: { 
    icon: <XCircle className="h-4 w-4" />, 
    color: 'bg-red-500' 
  },
};

export const AssetTimeline = ({ history, isLoading }: AssetTimelineProps) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Histórico
        </CardTitle>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            Nenhum evento registrado
          </p>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
            
            <div className="space-y-6">
              {history.map((event, index) => {
                const config = eventConfig[event.tipo_evento];
                
                return (
                  <div key={event.id} className="relative flex gap-4 pl-0">
                    {/* Timeline dot */}
                    <div 
                      className={cn(
                        "relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-white shrink-0",
                        config.color
                      )}
                    >
                      {config.icon}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {ASSET_EVENT_LABELS[event.tipo_evento]}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(event.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      {event.descricao && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {event.descricao}
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
};
