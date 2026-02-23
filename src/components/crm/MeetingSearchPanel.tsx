import { useState } from 'react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, DollarSign, ChevronRight, Loader2, Phone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSearchPastMeetings, PastMeetingResult } from '@/hooks/useSearchPastMeetings';
import { useMarkContractPaid } from '@/hooks/useAgendaData';
import { MeetingSlot } from '@/hooks/useAgendaData';

interface MeetingSearchPanelProps {
  closerId: string;
  onSelectMeeting: (meeting: MeetingSlot) => void;
  isConsorcio?: boolean;
}

export function MeetingSearchPanel({ closerId, onSelectMeeting, isConsorcio = false }: MeetingSearchPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: results = [], isLoading } = useSearchPastMeetings(searchQuery, closerId);
  const markContractPaid = useMarkContractPaid();

  const handleMarkPaid = (result: PastMeetingResult) => {
    markContractPaid.mutate({
      meetingId: result.meeting.id,
      attendeeId: result.attendeeId
    });
  };

  const handleOpenMeeting = (result: PastMeetingResult) => {
    // Convert to MeetingSlot format for the drawer
    const meetingSlot: MeetingSlot = {
      id: result.meeting.id,
      closer_id: result.meeting.closer_id,
      deal_id: null,
      contact_id: null,
      scheduled_at: result.meeting.scheduled_at,
      duration_minutes: result.meeting.duration_minutes,
      status: result.meeting.status,
      booked_by: null,
      notes: null,
      closer_notes: null,
      meeting_link: null,
      video_conference_link: null,
      google_event_id: null,
      created_at: '',
      closer: result.meeting.closer ? {
        id: result.meeting.closer.id,
        name: result.meeting.closer.name,
        email: '',
        color: result.meeting.closer.color || undefined
      } : undefined,
      attendees: [{
        id: result.attendeeId,
        deal_id: null,
        contact_id: null,
        attendee_name: result.attendeeName,
        attendee_phone: result.attendeePhone,
        is_partner: false,
        status: result.attendeeStatus,
        notified_at: null,
        booked_by: null,
        notes: null,
        closer_notes: null,
        already_builds: null
      }]
    };
    onSelectMeeting(meetingSlot);
  };

  const getDaysAgo = (dateString: string) => {
    return differenceInDays(new Date(), parseISO(dateString));
  };

  const getStatusBadge = (status: string) => {
    if (status === 'completed') {
      return <Badge variant="outline" className="text-emerald-600 border-emerald-600/30 bg-emerald-500/10 text-xs">Realizada</Badge>;
    }
    if (status === 'no_show') {
      return <Badge variant="outline" className="text-red-600 border-red-600/30 bg-red-500/10 text-xs">No-show</Badge>;
    }
    return <Badge variant="outline" className="text-xs">{status}</Badge>;
  };

  return (
    <Card className="bg-gradient-to-br from-card to-amber-500/5 border-amber-500/20">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Search className="h-4 w-4 text-amber-500" />
          Buscar Reuniões Passadas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {searchQuery.length >= 2 && (
          <ScrollArea className="max-h-[280px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                Nenhuma reunião encontrada
              </div>
            ) : (
              <div className="space-y-2">
                {results.map((result) => (
                  <div
                    key={`${result.meeting.id}-${result.attendeeId}`}
                    className="flex items-center justify-between p-2.5 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {result.attendeeName || 'Sem nome'}
                        </span>
                        {getStatusBadge(result.meeting.status)}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>
                          {format(parseISO(result.meeting.scheduled_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </span>
                        <span>•</span>
                        <span>{getDaysAgo(result.meeting.scheduled_at)} dias atrás</span>
                        {result.attendeePhone && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-0.5">
                              <Phone className="h-3 w-3" />
                              {result.attendeePhone}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      {!isConsorcio && (
                        result.attendeeStatus === 'contract_paid' ? (
                          <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">
                            ✅ Pago
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="default"
                            className="h-8 w-8 p-0 bg-amber-500 hover:bg-amber-600"
                            onClick={() => handleMarkPaid(result)}
                            disabled={markContractPaid.isPending}
                            title="Marcar Contrato Pago"
                          >
                            <DollarSign className="h-4 w-4" />
                          </Button>
                        )
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => handleOpenMeeting(result)}
                        title="Ver detalhes"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        )}

        {searchQuery.length > 0 && searchQuery.length < 2 && (
          <div className="text-center py-4 text-xs text-muted-foreground">
            Digite pelo menos 2 caracteres para buscar
          </div>
        )}

        {searchQuery.length === 0 && (
          <div className="text-center py-4 text-xs text-muted-foreground">
            {isConsorcio ? 'Busque reuniões realizadas para follow-up' : 'Busque leads para marcar como "Contrato Pago"'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
