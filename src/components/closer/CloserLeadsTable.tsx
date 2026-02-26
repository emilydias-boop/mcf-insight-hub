import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CloserLead } from "@/hooks/useCloserDetailData";
import { CheckCircle, DollarSign } from "lucide-react";

interface CloserLeadsTableProps {
  leads: CloserLead[];
  isLoading: boolean;
  showR1Sdr?: boolean;
}

export function CloserLeadsTable({ leads, isLoading, showR1Sdr = false }: CloserLeadsTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <p>Nenhum lead encontrado no período.</p>
      </div>
    );
  }

  const getStatusBadge = (status: string, contractPaidAt?: string | null) => {
    const displayStatus = contractPaidAt ? 'contract_paid' : status;
    
    switch (displayStatus) {
      case 'contract_paid':
        return (
          <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30 flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            Contrato Pago
          </Badge>
        );
      case 'completed':
        return (
          <Badge className="bg-green-500/10 text-green-400 border-green-500/30 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Realizada
          </Badge>
        );
      case 'no_show':
        return (
          <Badge className="bg-red-500/10 text-red-400 border-red-500/30 flex items-center gap-1">
            No-Show
          </Badge>
        );
      case 'scheduled':
        return (
          <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30 flex items-center gap-1">
            Agendada
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="text-muted-foreground">Data</TableHead>
              <TableHead className="text-muted-foreground">Lead</TableHead>
              <TableHead className="text-muted-foreground">Telefone</TableHead>
              <TableHead className="text-muted-foreground">{showR1Sdr ? 'SDR (R1)' : 'SDR'}</TableHead>
              {showR1Sdr && <TableHead className="text-muted-foreground">Agendado por</TableHead>}
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="text-muted-foreground">Origem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => (
              <TableRow key={lead.attendee_id} className="hover:bg-muted/30">
                <TableCell className="font-medium whitespace-nowrap">
                  {format(new Date(lead.scheduled_at), "dd/MM HH:mm", { locale: ptBR })}
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium text-foreground">{lead.contact_name}</div>
                    {lead.contact_email && (
                      <div className="text-xs text-muted-foreground">{lead.contact_email}</div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {lead.contact_phone || '-'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {showR1Sdr ? (lead.r1_sdr_name || '-') : (lead.booked_by_name || '-')}
                </TableCell>
                {showR1Sdr && (
                  <TableCell className="text-muted-foreground">
                    {lead.booked_by_name || '-'}
                  </TableCell>
                )}
                <TableCell>{getStatusBadge(lead.status, lead.contract_paid_at)}</TableCell>
                <TableCell>
                  {lead.origin_name ? (
                    <Badge variant="outline" className="text-xs">
                      {lead.origin_name}
                    </Badge>
                  ) : (
                    '-'
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
