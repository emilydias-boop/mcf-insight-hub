import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ExternalLink, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { MeetingV2 } from "@/hooks/useSdrMetricsV2";
import { formatMeetingStatus } from "@/utils/formatMeetingStatus";

interface SdrLeadsTableProps {
  meetings: MeetingV2[];
  isLoading?: boolean;
  onSelectMeeting: (meeting: MeetingV2) => void;
}

const getStatusBadgeClass = (status: string) => {
  const statusLower = status?.toLowerCase() || '';
  if (statusLower.includes('agendad') || statusLower === 'invited' || statusLower === 'scheduled') {
    return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  }
  if (statusLower.includes('realizada') || statusLower === 'completed') {
    return 'bg-green-500/20 text-green-400 border-green-500/30';
  }
  if (statusLower.includes('no-show') || statusLower.includes('noshow') || statusLower === 'no_show') {
    return 'bg-red-500/20 text-red-400 border-red-500/30';
  }
  if (statusLower.includes('contrato') || statusLower === 'contract_paid') {
    return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
  }
  if (statusLower === 'rescheduled' || statusLower.includes('reagend')) {
    return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  }
  return 'bg-muted text-muted-foreground';
};

export function SdrLeadsTable({ meetings, isLoading, onSelectMeeting }: SdrLeadsTableProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Get unique statuses and types
  const { statuses, types } = useMemo(() => {
    const statusSet = new Set<string>();
    const typeSet = new Set<string>();
    
    meetings.forEach(m => {
      if (m.status_atual) statusSet.add(m.status_atual);
      if (m.tipo) typeSet.add(m.tipo);
    });
    
    return {
      statuses: Array.from(statusSet),
      types: Array.from(typeSet),
    };
  }, [meetings]);

  // Filter meetings
  const filteredMeetings = useMemo(() => {
    return meetings.filter(m => {
      if (statusFilter !== "all" && m.status_atual !== statusFilter) return false;
      if (typeFilter !== "all" && m.tipo !== typeFilter) return false;
      return true;
    });
  }, [meetings, statusFilter, typeFilter]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span>Filtros:</span>
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] h-8">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {statuses.map(status => (
              <SelectItem key={status} value={status}>
                {formatMeetingStatus(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px] h-8">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {types.map(type => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(statusFilter !== "all" || typeFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter("all");
              setTypeFilter("all");
            }}
          >
            Limpar filtros
          </Button>
        )}
        
        <span className="text-xs text-muted-foreground ml-auto">
          {filteredMeetings.length} de {meetings.length} leads
        </span>
      </div>

      {/* Table */}
      <div className="rounded-md border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="text-muted-foreground">Data/Hora</TableHead>
                <TableHead className="text-muted-foreground">Lead</TableHead>
                <TableHead className="text-muted-foreground">Tipo</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">Closer</TableHead>
                <TableHead className="text-muted-foreground text-center">Prob.</TableHead>
                <TableHead className="text-muted-foreground w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMeetings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum lead encontrado para os filtros selecionados.
                  </TableCell>
                </TableRow>
              ) : (
                filteredMeetings.map((meeting, index) => (
                  <TableRow
                    key={`${meeting.deal_id}-${index}`}
                    className="cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => onSelectMeeting(meeting)}
                  >
                    <TableCell className="text-sm">
                      {meeting.data_agendamento 
                        ? format(parseISO(meeting.data_agendamento), "dd/MM HH:mm", { locale: ptBR })
                        : 'N/A'
                      }
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{meeting.contact_name || 'Sem nome'}</span>
                        <span className="text-xs text-muted-foreground">{meeting.contact_email || ''}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {meeting.tipo === '1º Agendamento' ? '1º Agend.' : 
                         meeting.tipo === 'Reagendamento Válido' ? 'Reagend.' : meeting.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={getStatusBadgeClass(meeting.status_atual || '')}
                      >
                        {formatMeetingStatus(meeting.status_atual)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {meeting.closer || '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {meeting.probability ? (
                        <span className="text-sm font-medium">{meeting.probability}%</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`/crm/negocios?id=${meeting.deal_id}`, '_blank');
                        }}
                      >
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
