import { useState, useEffect, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Phone, Calendar, CheckCircle, XCircle, 
  ExternalLink, Clock, User, X, Users
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { R2MeetingSlot, useUpdateR2MeetingStatus } from '@/hooks/useR2AgendaData';
import { cn } from '@/lib/utils';

interface R2MeetingDrawerProps {
  meeting: R2MeetingSlot | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReschedule: (meeting: R2MeetingSlot) => void;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Agendada', color: 'bg-purple-500' },
  invited: { label: 'Convidado', color: 'bg-purple-400' },
  rescheduled: { label: 'Reagendada', color: 'bg-yellow-500' },
  completed: { label: 'Realizada', color: 'bg-green-500' },
  no_show: { label: 'No-show', color: 'bg-red-500' },
  canceled: { label: 'Cancelada', color: 'bg-muted' },
  contract_paid: { label: 'Contrato Pago', color: 'bg-emerald-600' },
};

export function R2MeetingDrawer({ meeting, open, onOpenChange, onReschedule }: R2MeetingDrawerProps) {
  const updateStatus = useUpdateR2MeetingStatus();

  if (!meeting) return null;

  const contact = meeting.deal?.contact;
  const statusInfo = STATUS_LABELS[meeting.status] || STATUS_LABELS.scheduled;
  const isPending = meeting.status === 'scheduled' || meeting.status === 'rescheduled';

  const handleStatusChange = (newStatus: string) => {
    updateStatus.mutate({ meetingId: meeting.id, status: newStatus });
  };

  const handleCall = () => {
    if (contact?.phone) {
      window.open(`tel:${contact.phone}`, '_blank');
    }
  };

  const handleWhatsApp = () => {
    if (contact?.phone) {
      const phone = contact.phone.replace(/\D/g, '');
      window.open(`https://wa.me/55${phone}`, '_blank');
    }
  };

  const participants = meeting.attendees || [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="border-b p-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-purple-500" />
              Reunião R2
            </SheetTitle>
            <Badge className={cn(statusInfo.color, 'text-white')}>
              {statusInfo.label}
            </Badge>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* Meeting Info */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">
                    {format(parseISO(meeting.scheduled_at), "EEEE, d 'de' MMMM", { locale: ptBR })}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {format(parseISO(meeting.scheduled_at), 'HH:mm')} - {meeting.duration_minutes}min
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm text-muted-foreground">Closer R2</div>
                  <div className="font-medium">{meeting.closer?.name}</div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Participants */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Participantes ({participants.length})</span>
              </div>

              {participants.map(att => (
                <div key={att.id} className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {att.attendee_name || att.contact?.name || 'Lead'}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {STATUS_LABELS[att.status]?.label || att.status}
                    </Badge>
                  </div>
                  
                  {(att.attendee_phone || att.contact?.phone) && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      {att.attendee_phone || att.contact?.phone}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <Separator />

            {/* Notes */}
            {meeting.notes && (
              <div className="space-y-2">
                <span className="font-medium text-sm">Observações</span>
                <div className="bg-muted/50 rounded-lg p-3 text-sm whitespace-pre-wrap">
                  {meeting.notes}
                </div>
              </div>
            )}

            {/* Contact Actions */}
            {contact?.phone && (
              <>
                <Separator />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={handleCall}>
                    <Phone className="h-4 w-4 mr-2" />
                    Ligar
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1" onClick={handleWhatsApp}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    WhatsApp
                  </Button>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        {/* Footer Actions */}
        <div className="border-t p-4 space-y-2">
          {isPending && (
            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant="outline" 
                className="text-green-600 border-green-200 hover:bg-green-50"
                onClick={() => handleStatusChange('completed')}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Realizada
              </Button>
              <Button 
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => handleStatusChange('no_show')}
              >
                <XCircle className="h-4 w-4 mr-2" />
                No-show
              </Button>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline"
              onClick={() => onReschedule(meeting)}
            >
              <Clock className="h-4 w-4 mr-2" />
              Reagendar
            </Button>
            <Button 
              variant="outline"
              className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
              onClick={() => handleStatusChange('contract_paid')}
            >
              Contrato Pago
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
