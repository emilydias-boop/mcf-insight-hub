import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, X, Phone, Calendar, User, Loader2, Clock, AlertTriangle, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  useR2PreScheduledLeads,
  useConfirmR2PreScheduled,
  useCancelR2PreScheduled,
} from '@/hooks/useR2PreScheduledLeads';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Hook to check which pre-scheduled leads have configured daily slots
function usePreScheduledSlotCheck(leads: ReturnType<typeof useR2PreScheduledLeads>['data']) {
  return useQuery({
    queryKey: ['r2-pre-scheduled-slot-check', leads?.map(l => l.id).join(',')],
    queryFn: async () => {
      if (!leads || leads.length === 0) return {};

      const checks: Record<string, boolean> = {};

      for (const lead of leads) {
        const meetingSlot = lead.meeting_slot as unknown as { id: string; scheduled_at: string; closer: { id: string; name: string; color: string | null } | null } | null;
        if (!meetingSlot?.scheduled_at || !meetingSlot?.closer?.id) {
          checks[lead.id] = false;
          continue;
        }

        const scheduledDate = new Date(meetingSlot.scheduled_at);
        const dateStr = scheduledDate.toISOString().split('T')[0];
        const timeStr = `${String(scheduledDate.getHours()).padStart(2, '0')}:${String(scheduledDate.getMinutes()).padStart(2, '0')}`;

        const { data } = await supabase
          .from('r2_daily_slots')
          .select('id')
          .eq('closer_id', meetingSlot.closer.id)
          .eq('slot_date', dateStr)
          .eq('start_time', timeStr)
          .maybeSingle();

        checks[lead.id] = !!data;
      }

      return checks;
    },
    enabled: !!leads && leads.length > 0,
  });
}

export function R2PreScheduledTab() {
  const { data: leads = [], isLoading } = useR2PreScheduledLeads();
  const confirmMutation = useConfirmR2PreScheduled();
  const cancelMutation = useCancelR2PreScheduled();
  const { data: slotChecks = {} } = usePreScheduledSlotCheck(leads);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Clock className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p className="font-medium">Nenhum pré-agendamento pendente</p>
        <p className="text-sm mt-1">Todos os pré-agendamentos já foram confirmados ou cancelados.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20">
          {leads.length} pré-agendamento(s) pendente(s)
        </Badge>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Lead</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead>Sócio R2</TableHead>
            <TableHead>Data/Hora</TableHead>
            <TableHead>Obs/Preferência</TableHead>
            <TableHead>Pré-agendado por</TableHead>
            <TableHead>Criado em</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map(lead => {
            const meetingSlot = lead.meeting_slot as unknown as { id: string; scheduled_at: string; closer: { id: string; name: string; color: string | null } | null } | null;
            const deal = lead.deal as unknown as { name: string; contact: { name: string; phone: string | null; email: string | null } | null } | null;
            const name = lead.attendee_name || deal?.contact?.name || deal?.name || 'Sem nome';
            const phone = lead.attendee_phone || deal?.contact?.phone || '-';
            const closerName = meetingSlot?.closer?.name || '-';
            const scheduledAt = meetingSlot?.scheduled_at;
            const bookerName = lead.booker_profile?.full_name || '-';
            const isPending = confirmMutation.isPending || cancelMutation.isPending;
            const hasSlot = slotChecks[lead.id] ?? true;
            const observations = lead.r2_observations || lead.notes || '';

            return (
              <TableRow key={lead.id}>
                <TableCell className="font-medium">{name}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-sm">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    {phone}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3 text-muted-foreground" />
                    {closerName}
                  </div>
                </TableCell>
                <TableCell>
                  {scheduledAt ? (
                    <div className="flex items-center gap-1.5 text-sm">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      {format(new Date(scheduledAt), "dd/MM 'às' HH:mm", { locale: ptBR })}
                      {!hasSlot && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-600 border-amber-500/20">
                                <AlertTriangle className="h-3 w-3 mr-0.5" />
                                Encaixe
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Horário não configurado na grade. Será criado automaticamente ao confirmar.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  ) : '-'}
                </TableCell>
                <TableCell>
                  {observations ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground max-w-[180px]">
                            <StickyNote className="h-3 w-3 shrink-0" />
                            <span className="truncate">{observations}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="whitespace-pre-wrap">{observations}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{bookerName}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(lead.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-950/30"
                      disabled={isPending}
                      onClick={() => confirmMutation.mutate(lead.id)}
                    >
                      {confirmMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4 mr-1" />
                      )}
                      Confirmar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive border-destructive/30 hover:bg-destructive/10"
                      disabled={isPending}
                      onClick={() => cancelMutation.mutate(lead.id)}
                    >
                      {cancelMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4 mr-1" />
                      )}
                      Cancelar
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
