import { useState, useMemo, useCallback } from 'react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Calendar, 
  Phone, 
  User, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  MoreVertical,
  RotateCcw,
  Copy,
  UserCheck,
  Repeat,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useR2PendingLeads, R2PendingLead } from '@/hooks/useR2PendingLeads';
import { R2QuickScheduleModal } from './R2QuickScheduleModal';
import { RefundModal } from './RefundModal';
import { useRecognizePartner } from '@/hooks/useRecognizePartner';
import { useRecognizeRecurrence } from '@/hooks/useRecognizeRecurrence';
import { R2CloserWithAvailability } from '@/hooks/useR2AgendaData';
import { useR2StatusOptions, useR2ThermometerOptions } from '@/hooks/useR2StatusOptions';
import { useGestorClosers } from '@/hooks/useGestorClosers';
import { cn } from '@/lib/utils';
import { R2SemSucessoModal } from './R2SemSucessoModal';

interface R2PendingLeadsPanelProps {
  closers: R2CloserWithAvailability[];
}

export function R2PendingLeadsPanel({ closers }: R2PendingLeadsPanelProps) {
  const { data: pendingLeads = [], isLoading, error } = useR2PendingLeads();
  const { data: statusOptions = [] } = useR2StatusOptions();
  const { data: thermometerOptions = [] } = useR2ThermometerOptions();
  const { data: r1Closers = [] } = useGestorClosers('r1');
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<R2PendingLead | null>(null);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundLead, setRefundLead] = useState<R2PendingLead | null>(null);
  const [r1CloserFilter, setR1CloserFilter] = useState<string>('all');
  const [partnerDialogOpen, setPartnerDialogOpen] = useState(false);
  const [partnerLead, setPartnerLead] = useState<R2PendingLead | null>(null);
  const recognizePartner = useRecognizePartner();
  const [recurrenceDialogOpen, setRecurrenceDialogOpen] = useState(false);
  const [recurrenceLead, setRecurrenceLead] = useState<R2PendingLead | null>(null);
  const recognizeRecurrence = useRecognizeRecurrence();
  const [semSucessoModalOpen, setSemSucessoModalOpen] = useState(false);
  const [semSucessoLead, setSemSucessoLead] = useState<R2PendingLead | null>(null);

  const filteredLeads = useMemo(() => {
    if (r1CloserFilter === 'all') return pendingLeads;
    return pendingLeads.filter(lead => lead.meeting_slot?.closer?.id === r1CloserFilter);
  }, [pendingLeads, r1CloserFilter]);

  const handleScheduleR2 = (lead: R2PendingLead) => {
    setSelectedLead(lead);
    setScheduleModalOpen(true);
  };

  const handleRefund = (lead: R2PendingLead) => {
    setRefundLead(lead);
    setRefundModalOpen(true);
  };

  const handleCopyReport = useCallback(() => {
    const today = format(new Date(), 'dd/MM/yyyy');
    const lines = [`📋 RELATÓRIO PENDENTES R2 - ${today}`, `Total: ${filteredLeads.length} leads`, ''];

    filteredLeads.forEach((lead, i) => {
      const name = lead.attendee_name || lead.deal?.contact?.name || lead.deal?.name || 'Lead';
      const phone = lead.attendee_phone || lead.deal?.contact?.phone || 'N/A';
      const r1Date = lead.meeting_slot?.scheduled_at
        ? format(parseISO(lead.meeting_slot.scheduled_at), "dd/MM 'às' HH:mm")
        : 'N/A';
      const closer = lead.meeting_slot?.closer?.name || 'N/A';
      const paidAt = format(parseISO(lead.contract_paid_at), "dd/MM 'às' HH:mm");

      lines.push(
        `${i + 1}. Nome: ${name}`,
        `   📞 Telefone: ${phone}`,
        `   📅 R1: ${r1Date}`,
        `   👤 Closer R1: ${closer}`,
        `   💰 Contrato Pago: ${paidAt}`,
        ''
      );
    });

    navigator.clipboard.writeText(lines.join('\n'));
    toast.success('Relatório copiado!');
  }, [filteredLeads]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-muted-foreground">Erro ao carregar leads pendentes</p>
        <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
      </div>
    );
  }

  if (pendingLeads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
        <p className="font-medium text-lg">Nenhum lead pendente!</p>
        <p className="text-sm text-muted-foreground">
          Todos os leads com Contrato Pago já têm R2 agendada
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Badge variant="destructive" className="text-sm py-1 px-3">
            {filteredLeads.length} pendente{filteredLeads.length !== 1 ? 's' : ''}
          </Badge>
          <span className="text-sm text-muted-foreground">
            Leads com Contrato Pago aguardando agendamento de R2
          </span>
          <Select value={r1CloserFilter} onValueChange={setR1CloserFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Closer R1" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Closers R1</SelectItem>
              {r1Closers.map((closer) => (
                <SelectItem key={closer.id} value={closer.id}>
                  {closer.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={handleCopyReport}>
            <Copy className="h-4 w-4 mr-1" />
            Copiar Relatório
          </Button>
        </div>
      </div>

      <ScrollArea className="h-[500px] pr-4">
        <div className="space-y-3">
          {filteredLeads.map((lead) => {
            const leadName = lead.attendee_name || lead.deal?.contact?.name || lead.deal?.name || 'Lead';
            const phone = lead.attendee_phone || lead.deal?.contact?.phone;
            const r1Date = lead.meeting_slot?.scheduled_at 
              ? parseISO(lead.meeting_slot.scheduled_at) 
              : null;
            const closerName = lead.meeting_slot?.closer?.name || 'Closer não identificado';
            const timeSincePaid = formatDistanceToNow(parseISO(lead.contract_paid_at), { 
              addSuffix: true, 
              locale: ptBR 
            });

            return (
              <Card 
                key={lead.id} 
                className={cn(
                  "border-l-4 border-l-emerald-500 hover:bg-muted/50 transition-colors",
                  "cursor-pointer"
                )}
                onClick={() => handleScheduleR2(lead)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    {/* Lead Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <User className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate">{leadName}</span>
                        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 shrink-0">
                          Contrato Pago
                        </Badge>
                      </div>

                      {phone && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          <span>{phone}</span>
                        </div>
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
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{timeSincePaid}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions Menu */}
                    <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleScheduleR2(lead)}>
                            <Calendar className="h-4 w-4 mr-2 text-purple-600" />
                            Agendar R2
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleRefund(lead)}>
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
                          <DropdownMenuItem onClick={() => {
                            setSemSucessoLead(lead);
                            setSemSucessoModalOpen(true);
                          }}>
                            <XCircle className="h-4 w-4 mr-2 text-destructive" />
                            Sem Sucesso
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

      {/* Schedule Modal with preselected deal */}
      <R2QuickScheduleModal
        open={scheduleModalOpen}
        onOpenChange={(open) => {
          setScheduleModalOpen(open);
          if (!open) setSelectedLead(null);
        }}
        closers={closers}
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

      {/* Refund Modal for R1 leads */}
      <RefundModal
        open={refundModalOpen}
        onOpenChange={(open) => {
          setRefundModalOpen(open);
          if (!open) setRefundLead(null);
        }}
        meetingId={refundLead?.meeting_slot?.id || ''}
        attendeeId={refundLead?.id}
        dealId={refundLead?.deal?.id || null}
        dealName={refundLead?.attendee_name || refundLead?.deal?.name}
        meetingType="r1"
      />

      {/* Partner Recognition Confirmation */}
      <AlertDialog open={partnerDialogOpen} onOpenChange={setPartnerDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reconhecer como Parceiro?</AlertDialogTitle>
            <AlertDialogDescription>
              O lead <strong>{partnerLead?.attendee_name || partnerLead?.deal?.contact?.name || 'Lead'}</strong> será 
              marcado como parceiro, removido da lista de pendentes e o deal será movido para Perdido.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
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
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Recurrence Recognition Confirmation */}
      <AlertDialog open={recurrenceDialogOpen} onOpenChange={setRecurrenceDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reconhecer como Recorrência?</AlertDialogTitle>
            <AlertDialogDescription>
              O lead <strong>{recurrenceLead?.attendee_name || recurrenceLead?.deal?.contact?.name || 'Lead'}</strong> será 
              marcado como recorrência, removido da lista de pendentes e o deal será movido para Perdido.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
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
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
