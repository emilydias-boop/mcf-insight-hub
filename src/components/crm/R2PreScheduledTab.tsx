import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, X, Phone, Calendar, User, Loader2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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

export function R2PreScheduledTab() {
  const { data: leads = [], isLoading } = useR2PreScheduledLeads();
  const confirmMutation = useConfirmR2PreScheduled();
  const cancelMutation = useCancelR2PreScheduled();

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
                    <div className="flex items-center gap-1 text-sm">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      {format(new Date(scheduledAt), "dd/MM 'às' HH:mm", { locale: ptBR })}
                    </div>
                  ) : '-'}
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
