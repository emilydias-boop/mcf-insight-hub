import { useState, useMemo } from 'react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calendar, Phone, User, Clock, AlertCircle, MoreVertical,
  RotateCcw, UserCheck, Repeat, XCircle, Undo2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useR2SemSucessoLeads, useRevertSemSucesso } from '@/hooks/useR2SemSucesso';
import { R2PendingLead } from '@/hooks/useR2PendingLeads';
import { R2QuickScheduleModal } from './R2QuickScheduleModal';
import { RefundModal } from './RefundModal';
import { useRecognizePartner } from '@/hooks/useRecognizePartner';
import { useRecognizeRecurrence } from '@/hooks/useRecognizeRecurrence';
import { useR2StatusOptions, useR2ThermometerOptions } from '@/hooks/useR2StatusOptions';
import { R2CloserWithAvailability } from '@/hooks/useR2AgendaData';
import { cn } from '@/lib/utils';

interface R2SemSucessoPanelProps {
  closers: R2CloserWithAvailability[];
}

export function R2SemSucessoPanel({ closers }: R2SemSucessoPanelProps) {
  const { data: leads = [], isLoading, error } = useR2SemSucessoLeads();
  const { data: statusOptions = [] } = useR2StatusOptions();
  const { data: thermometerOptions = [] } = useR2ThermometerOptions();
  const revertSemSucesso = useRevertSemSucesso();

  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<R2PendingLead | null>(null);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundLead, setRefundLead] = useState<R2PendingLead | null>(null);
  const [partnerDialogOpen, setPartnerDialogOpen] = useState(false);
  const [partnerLead, setPartnerLead] = useState<R2PendingLead | null>(null);
  const recognizePartner = useRecognizePartner();
  const [recurrenceDialogOpen, setRecurrenceDialogOpen] = useState(false);
  const [recurrenceLead, setRecurrenceLead] = useState<R2PendingLead | null>(null);
  const recognizeRecurrence = useRecognizeRecurrence();

  // Convert closers for modal
  const closersForModal = useMemo(() => {
    return closers.map(c => ({
      id: c.id,
      name: c.name,
      email: c.email,
      color: c.color || '#8B5CF6',
      is_active: c.is_active ?? true,
      meeting_duration_minutes: 45,
      max_leads_per_slot: 4,
      availability: [],
    }));
  }, [closers]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-muted-foreground">Erro ao carregar leads sem sucesso</p>
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <XCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="font-medium text-lg">Nenhum lead sem sucesso</p>
        <p className="text-sm text-muted-foreground">Leads marcados como sem sucesso aparecerão aqui</p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center gap-4">
        <Badge variant="outline" className="text-sm py-1 px-3 bg-red-500/10 text-red-600 border-red-500/20">
          {leads.length} sem sucesso
        </Badge>
        <span className="text-sm text-muted-foreground">
          Leads sem sucesso no contato — podem ser reagendados
        </span>
      </div>

      <ScrollArea className="h-[500px] pr-4">
        <div className="space-y-3">
          {leads.map((lead: any) => {
            const leadName = lead.attendee_name || lead.deal?.contact?.name || lead.deal?.name || 'Lead';
            const phone = lead.attendee_phone || lead.deal?.contact?.phone;
            const r1Date = lead.meeting_slot?.scheduled_at
              ? parseISO(lead.meeting_slot.scheduled_at)
              : null;
            const closerName = lead.meeting_slot?.closer?.name || 'Closer não identificado';
            const tentativas = lead.custom_fields?.sem_sucesso_tentativas || 0;
            const observacao = lead.custom_fields?.sem_sucesso_observacao || '';

            return (
              <Card key={lead.id} className="border-l-4 border-l-red-400 hover:bg-muted/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <User className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate">{leadName}</span>
                        <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 shrink-0">
                          Sem Sucesso
                        </Badge>
                        {tentativas > 0 && (
                          <Badge variant="secondary" className="shrink-0">
                            {tentativas} tentativa{tentativas !== 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>

                      {phone && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          <span>{phone}</span>
                        </div>
                      )}

                      {observacao && (
                        <p className="text-xs text-muted-foreground mb-1 italic line-clamp-2">
                          "{observacao}"
                        </p>
                      )}

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {r1Date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>R1: {format(r1Date, "dd/MM 'às' HH:mm")}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span>{closerName}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions Menu */}
                    <div className="shrink-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setSelectedLead(lead);
                            setScheduleModalOpen(true);
                          }}>
                            <Calendar className="h-4 w-4 mr-2 text-purple-600" />
                            Agendar R2
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => revertSemSucesso.mutate(lead.id)}>
                            <Undo2 className="h-4 w-4 mr-2 text-blue-600" />
                            Voltar para Pendentes
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setRefundLead(lead);
                            setRefundModalOpen(true);
                          }}>
                            <RotateCcw className="h-4 w-4 mr-2 text-orange-600" />
                            Reembolso
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setPartnerLead(lead);
                            setPartnerDialogOpen(true);
                          }}>
                            <UserCheck className="h-4 w-4 mr-2 text-blue-600" />
                            Reconhecer Parceiro
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setRecurrenceLead(lead);
                            setRecurrenceDialogOpen(true);
                          }}>
                            <Repeat className="h-4 w-4 mr-2 text-green-600" />
                            Reconhecer Recorrência
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>

      {/* Schedule Modal */}
      <R2QuickScheduleModal
        open={scheduleModalOpen}
        onOpenChange={(open) => { setScheduleModalOpen(open); if (!open) setSelectedLead(null); }}
        closers={closersForModal}
        statusOptions={statusOptions}
        thermometerOptions={thermometerOptions}
        preselectedDeal={selectedLead ? {
          id: selectedLead.deal?.id || '',
          name: selectedLead.deal?.name || selectedLead.attendee_name || 'Lead',
          contact: selectedLead.deal?.contact ? {
            id: selectedLead.deal.contact.id,
            name: selectedLead.deal.contact.name,
            phone: selectedLead.deal.contact.phone,
            email: selectedLead.deal.contact.email,
          } : {
            id: '',
            name: selectedLead.attendee_name || 'Lead',
            phone: selectedLead.attendee_phone,
            email: null,
          }
        } : undefined}
      />

      {/* Refund Modal */}
      <RefundModal
        open={refundModalOpen}
        onOpenChange={(open) => { setRefundModalOpen(open); if (!open) setRefundLead(null); }}
        meetingId={refundLead?.meeting_slot?.id || ''}
        attendeeId={refundLead?.id}
        dealId={refundLead?.deal?.id || null}
        dealName={refundLead?.attendee_name || refundLead?.deal?.name}
        meetingType="r1"
      />

      {/* Partner Recognition */}
      <AlertDialog open={partnerDialogOpen} onOpenChange={setPartnerDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reconhecer como Parceiro?</AlertDialogTitle>
            <AlertDialogDescription>
              O lead <strong>{partnerLead?.attendee_name || partnerLead?.deal?.contact?.name || 'Lead'}</strong> será
              marcado como parceiro e removido da lista.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (partnerLead) {
                recognizePartner.mutate({
                  attendeeId: partnerLead.id,
                  dealId: partnerLead.deal?.id,
                  contactId: partnerLead.deal?.contact?.id,
                  contactName: partnerLead.attendee_name || partnerLead.deal?.contact?.name || undefined,
                  contactEmail: partnerLead.deal?.contact?.email || undefined,
                  contactPhone: partnerLead.attendee_phone || partnerLead.deal?.contact?.phone || undefined,
                });
              }
              setPartnerDialogOpen(false);
              setPartnerLead(null);
            }}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Recurrence Recognition */}
      <AlertDialog open={recurrenceDialogOpen} onOpenChange={setRecurrenceDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reconhecer como Recorrência?</AlertDialogTitle>
            <AlertDialogDescription>
              O lead <strong>{recurrenceLead?.attendee_name || recurrenceLead?.deal?.contact?.name || 'Lead'}</strong> será
              marcado como recorrência e removido da lista.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (recurrenceLead) {
                recognizeRecurrence.mutate({
                  attendeeId: recurrenceLead.id,
                  dealId: recurrenceLead.deal?.id,
                  contactId: recurrenceLead.deal?.contact?.id,
                  contactName: recurrenceLead.attendee_name || recurrenceLead.deal?.contact?.name || undefined,
                  contactEmail: recurrenceLead.deal?.contact?.email || undefined,
                  contactPhone: recurrenceLead.attendee_phone || recurrenceLead.deal?.contact?.phone || undefined,
                });
              }
              setRecurrenceDialogOpen(false);
              setRecurrenceLead(null);
            }}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
