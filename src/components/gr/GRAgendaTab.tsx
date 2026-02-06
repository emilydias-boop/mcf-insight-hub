import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useGRAgenda } from '@/hooks/useGRDetailMetrics';
import { formatDate, formatDateTime } from '@/lib/formatters';
import { Calendar, CheckCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';

interface GRAgendaTabProps {
  walletId: string;
  grUserId: string;
}

export const GRAgendaTab = ({ walletId, grUserId }: GRAgendaTabProps) => {
  const { data: agenda, isLoading } = useGRAgenda(walletId, grUserId);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  
  const agendadas = agenda?.filter(a => a.type === 'scheduled') || [];
  const realizadas = agenda?.filter(a => a.type === 'completed') || [];
  const pendentes = agenda?.filter(a => a.type === 'pending') || [];
  
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Calendar className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Agendadas</p>
              <p className="text-2xl font-bold">{agendadas.length}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Realizadas</p>
              <p className="text-2xl font-bold">{realizadas.length}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <AlertCircle className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pendentes</p>
              <p className="text-2xl font-bold">{pendentes.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Upcoming Meetings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Próximas Reuniões
          </CardTitle>
        </CardHeader>
        <CardContent>
          {agendadas.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma reunião agendada
            </p>
          ) : (
            <div className="space-y-3">
              {agendadas.map((meeting) => (
                <div 
                  key={meeting.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <Clock className="h-4 w-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="font-medium">{meeting.customer_name}</p>
                      <p className="text-sm text-muted-foreground">{meeting.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatDate(meeting.scheduled_at)}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(meeting.scheduled_at).toLocaleTimeString('pt-BR', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Completed Meetings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Reuniões Realizadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {realizadas.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma reunião realizada ainda
            </p>
          ) : (
            <div className="space-y-3">
              {realizadas.slice(0, 10).map((meeting) => (
                <div 
                  key={meeting.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-emerald-500/10">
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div>
                      <p className="font-medium">{meeting.customer_name}</p>
                      <p className="text-sm text-muted-foreground">{meeting.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                      Realizada
                    </Badge>
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatDate(meeting.completed_at || meeting.scheduled_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
