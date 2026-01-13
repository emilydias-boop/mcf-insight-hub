import { useMemo } from 'react';
import { format, parseISO, isSameDay, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, Phone, Video, User, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MeetingSlot } from '@/hooks/useAgendaData';
import { cn } from '@/lib/utils';

interface UpcomingMeetingsPanelProps {
  meetings: MeetingSlot[];
  onSelectMeeting: (meeting: MeetingSlot) => void;
  maxItems?: number;
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-primary/10 text-primary border-primary/30',
  rescheduled: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  completed: 'bg-green-500/10 text-green-600 border-green-500/30',
  no_show: 'bg-red-500/10 text-red-600 border-red-500/30',
};

export function UpcomingMeetingsPanel({ 
  meetings, 
  onSelectMeeting, 
  maxItems = 5 
}: UpcomingMeetingsPanelProps) {
  const now = new Date();
  
  // Filter today's upcoming meetings and sort by time
  const upcomingMeetings = useMemo(() => {
    return meetings
      .filter(m => {
        const meetingDate = parseISO(m.scheduled_at);
        return isSameDay(meetingDate, now) && 
               isAfter(meetingDate, now) &&
               m.status !== 'canceled';
      })
      .sort((a, b) => 
        parseISO(a.scheduled_at).getTime() - parseISO(b.scheduled_at).getTime()
      )
      .slice(0, maxItems);
  }, [meetings, now, maxItems]);

  // Current/ongoing meeting (started but not ended)
  const currentMeeting = useMemo(() => {
    return meetings.find(m => {
      const meetingStart = parseISO(m.scheduled_at);
      const duration = m.duration_minutes || 30;
      const meetingEnd = new Date(meetingStart.getTime() + duration * 60 * 1000);
      
      return isSameDay(meetingStart, now) && 
             now >= meetingStart && 
             now < meetingEnd &&
             m.status !== 'canceled';
    });
  }, [meetings, now]);

  if (!currentMeeting && upcomingMeetings.length === 0) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-br from-card to-muted/30 border-primary/20">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          {currentMeeting ? 'Reunião em Andamento' : 'Próximas Reuniões'}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 pb-3">
        <div className="space-y-2">
          {/* Current meeting highlight */}
          {currentMeeting && (
            <Button
              variant="outline"
              className="w-full h-auto p-3 justify-between bg-primary/5 border-primary/30 hover:bg-primary/10 animate-pulse"
              onClick={() => onSelectMeeting(currentMeeting)}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Video className="h-5 w-5 text-primary" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-sm">
                    {format(parseISO(currentMeeting.scheduled_at), 'HH:mm')} - AGORA
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {currentMeeting.attendees?.[0]?.attendee_name || 
                     currentMeeting.deal?.contact?.name || 
                     'Lead'}
                    {currentMeeting.attendees && currentMeeting.attendees.length > 1 && (
                      <span> (+{currentMeeting.attendees.length - 1})</span>
                    )}
                  </div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Button>
          )}

          {/* Upcoming meetings */}
          {upcomingMeetings.map((meeting) => {
            const meetingTime = parseISO(meeting.scheduled_at);
            const attendeeName = meeting.attendees?.[0]?.attendee_name || 
                                meeting.deal?.contact?.name || 
                                'Lead';
            const attendeeCount = meeting.attendees?.length || 1;

            return (
              <Button
                key={meeting.id}
                variant="ghost"
                className={cn(
                  "w-full h-auto p-2.5 justify-between hover:bg-muted/50",
                  STATUS_COLORS[meeting.status] || ''
                )}
                onClick={() => onSelectMeeting(meeting)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-sm flex items-center gap-2">
                      <span>{format(meetingTime, 'HH:mm')}</span>
                      <span className="text-muted-foreground">•</span>
                      <span className="truncate max-w-[150px]">{attendeeName}</span>
                    </div>
                    {attendeeCount > 1 && (
                      <div className="text-xs text-muted-foreground">
                        +{attendeeCount - 1} participante{attendeeCount > 2 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>
                <Badge variant="outline" className="text-xs shrink-0">
                  {meeting.duration_minutes}min
                </Badge>
              </Button>
            );
          })}
        </div>

        {/* Total meetings today summary */}
        <div className="mt-3 pt-2 border-t text-xs text-muted-foreground text-center">
          {meetings.filter(m => 
            isSameDay(parseISO(m.scheduled_at), now) && 
            m.status !== 'canceled'
          ).length} reuniões hoje
        </div>
      </CardContent>
    </Card>
  );
}
