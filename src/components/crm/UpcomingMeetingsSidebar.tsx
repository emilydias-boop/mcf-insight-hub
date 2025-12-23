import { format, parseISO, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, User, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { MeetingSlot, useUpcomingMeetings, CloserMetrics } from '@/hooks/useAgendaData';
import { cn } from '@/lib/utils';

interface UpcomingMeetingsSidebarProps {
  selectedDate: Date;
  metrics: CloserMetrics[];
  metricsLoading: boolean;
  onSelectMeeting: (meeting: MeetingSlot) => void;
}

export function UpcomingMeetingsSidebar({ 
  selectedDate, 
  metrics, 
  metricsLoading,
  onSelectMeeting 
}: UpcomingMeetingsSidebarProps) {
  const { data: upcomingMeetings = [], isLoading } = useUpcomingMeetings(selectedDate);
  const now = new Date();

  const getTimeUntil = (scheduledAt: string) => {
    const meetingDate = parseISO(scheduledAt);
    const minutes = differenceInMinutes(meetingDate, now);
    
    if (minutes < 0) return 'Passou';
    if (minutes === 0) return 'Agora';
    if (minutes < 60) return `Em ${minutes}min`;
    const hours = Math.floor(minutes / 60);
    return `Em ${hours}h${minutes % 60 > 0 ? ` ${minutes % 60}min` : ''}`;
  };

  return (
    <div className="w-80 flex-shrink-0 space-y-4">
      {/* Upcoming Meetings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Próximas Reuniões
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : upcomingMeetings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma reunião agendada para hoje
            </p>
          ) : (
            <ScrollArea className="h-[240px]">
              <div className="space-y-2 pr-2">
                {upcomingMeetings.map(meeting => {
                  const timeUntil = getTimeUntil(meeting.scheduled_at);
                  const isNow = timeUntil === 'Agora' || timeUntil === 'Passou';
                  
                  return (
                    <button
                      key={meeting.id}
                      onClick={() => onSelectMeeting(meeting)}
                      className={cn(
                        "w-full text-left p-3 rounded-lg border transition-colors hover:bg-accent",
                        isNow && "border-primary bg-primary/5"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">
                          {format(parseISO(meeting.scheduled_at), 'HH:mm')}
                        </span>
                        <Badge 
                          variant={isNow ? "default" : "secondary"} 
                          className="text-xs"
                        >
                          {timeUntil}
                        </Badge>
                      </div>
                      <div className="text-sm truncate">
                        {meeting.deal?.contact?.name || meeting.deal?.name || 'Sem lead'}
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <div 
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: meeting.closer?.color || '#3B82F6' }}
                        />
                        <span className="text-xs text-muted-foreground">
                          {meeting.closer?.name}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Closer Occupancy */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Ocupação Hoje
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {metricsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : metrics.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum closer cadastrado
            </p>
          ) : (
            <div className="space-y-3">
              {metrics.map(metric => (
                <div key={metric.closerId} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: metric.color }}
                      />
                      <span>{metric.closerName}</span>
                    </div>
                    <span className="text-muted-foreground">
                      {metric.bookedSlots}/{metric.totalSlots || '-'}
                    </span>
                  </div>
                  <Progress 
                    value={metric.occupancyRate} 
                    className="h-2"
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Week Stats */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Conversão Semanal
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {metricsLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="space-y-2">
              {metrics.map(metric => (
                <div key={metric.closerId} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: metric.color }}
                    />
                    <span>{metric.closerName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-green-600">{metric.completedMeetings}✓</span>
                    <span className="text-red-500">{metric.noShowMeetings}✗</span>
                    <Badge variant="secondary" className="text-xs">
                      {metric.conversionRate}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
