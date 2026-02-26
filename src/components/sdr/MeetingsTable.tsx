import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
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
import { Meeting } from "@/hooks/useSdrMeetings";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { formatMeetingStatus } from "@/utils/formatMeetingStatus";

// Suporta ambos os tipos de meeting
type MeetingType = Meeting | MeetingV2;

interface MeetingsTableProps {
  meetings: MeetingType[];
  isLoading?: boolean;
  onSelectMeeting: (meeting: MeetingType) => void;
}

// Type guard para verificar se é MeetingV2
function isMeetingV2(meeting: MeetingType): meeting is MeetingV2 {
  return 'tipo' in meeting && 'status_atual' in meeting;
}

const getStatusBadgeClass = (status: string) => {
  const statusLower = status?.toLowerCase() || '';
  if (statusLower.includes('contrato') || statusLower === 'contract_paid') {
    return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
  }
  if (statusLower.includes('realizada') || statusLower === 'completed') {
    return 'bg-green-500/20 text-green-400 border-green-500/30';
  }
  if (statusLower.includes('no-show') || statusLower.includes('noshow') || statusLower === 'no_show') {
    return 'bg-red-500/20 text-red-400 border-red-500/30';
  }
  if (statusLower.includes('agendad') || statusLower === 'invited' || statusLower === 'scheduled') {
    return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  }
  if (statusLower === 'rescheduled' || statusLower.includes('reagend')) {
    return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  }
  return 'bg-muted text-muted-foreground';
};

const getTipoBadgeClass = (tipo: string, conta: boolean) => {
  if (tipo === '1º Agendamento') {
    return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
  }
  if (tipo === 'Reagendamento Válido') {
    return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  }
  // Reagendamento Inválido - não conta
  return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30';
};

export function MeetingsTable({ meetings, isLoading, onSelectMeeting }: MeetingsTableProps) {
  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="space-y-2 p-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (meetings.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <p>Nenhuma reunião encontrada para o período selecionado.</p>
      </div>
    );
  }

  // Detectar se está usando V2 baseado no primeiro item
  const isV2 = meetings.length > 0 && isMeetingV2(meetings[0]);

  return (
    <div className="h-full flex flex-col rounded-md border border-border overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
            <TableRow className="hover:bg-muted/80">
              <TableHead className="text-muted-foreground">Data/Horário</TableHead>
              {isV2 && <TableHead className="text-muted-foreground">Tipo</TableHead>}
              {isV2 && <TableHead className="text-muted-foreground text-center">Conta?</TableHead>}
              <TableHead className="text-muted-foreground">Lead</TableHead>
              <TableHead className="text-muted-foreground">Origem</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              {isV2 && <TableHead className="text-muted-foreground">Closer</TableHead>}
              <TableHead className="text-muted-foreground">Prob.</TableHead>
            </TableRow>
          </TableHeader>
          <TooltipProvider>
            <TableBody>
              {meetings.map((meeting) => {
                const isV2Meeting = isMeetingV2(meeting);
                const id = isV2Meeting ? meeting.deal_id : meeting.id;
                const date = isV2Meeting ? meeting.data_agendamento : meeting.scheduledDate;
                const contactName = isV2Meeting ? meeting.contact_name : meeting.contactName;
                const contactEmail = isV2Meeting ? meeting.contact_email : meeting.contactEmail;
                const originName = isV2Meeting ? meeting.origin_name : meeting.originName;
                const status = isV2Meeting ? meeting.status_atual : meeting.currentStage;
                const probability = meeting.probability;
                const conta = isV2Meeting ? meeting.conta : true;

                return (
                  <TableRow
                    key={`${id}-${date}`}
                    className={`cursor-pointer hover:bg-muted/30 transition-colors ${!conta ? 'opacity-50' : ''}`}
                    onClick={() => onSelectMeeting(meeting)}
                  >
                    <TableCell className="font-medium">
                      {isV2Meeting && meeting.scheduled_at ? (
                        <div>
                          <p>{format(new Date(meeting.scheduled_at), "dd/MM HH:mm", { locale: ptBR })}</p>
                          <p className="text-xs text-muted-foreground">
                            Agendado em {format(new Date(date), "dd/MM HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      ) : date ? (
                        format(new Date(date), "dd/MM HH:mm", { locale: ptBR })
                      ) : (
                        'N/A'
                      )}
                    </TableCell>
                    
                    {isV2Meeting && (
                      <TableCell>
                        <Badge 
                          variant="outline"
                          className={getTipoBadgeClass(meeting.tipo, conta)}
                        >
                          {meeting.tipo === 'Reagendamento Válido' ? 'Reagendamento' : 
                           meeting.tipo === 'Reagendamento Inválido' ? 'Reagendamento' : 
                           meeting.tipo}
                        </Badge>
                      </TableCell>
                    )}

                    {isV2Meeting && (
                      <TableCell className="text-center">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            {conta ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto" />
                            ) : (
                              <AlertCircle className="w-5 h-5 text-amber-400 mx-auto" />
                            )}
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            {conta ? (
                              <p>Este agendamento conta para as métricas</p>
                            ) : (
                              <p>
                                <strong>Não conta:</strong> Lead não passou por No-Show antes do reagendamento. 
                                Movimentação direta de outra etapa não é contabilizada.
                              </p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                    )}
                    
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-medium text-foreground">{contactName}</p>
                          {contactEmail && (
                            <p className="text-xs text-muted-foreground">{contactEmail}</p>
                          )}
                        </div>
                        {isV2Meeting && meeting.total_movimentacoes > 1 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                                {meeting.total_movimentacoes}x
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p>Este lead foi movido para R1 Agendada {meeting.total_movimentacoes} vezes no período</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <span className="text-muted-foreground">{originName || 'N/A'}</span>
                    </TableCell>
                    
                    <TableCell>
                      <Badge 
                        variant="outline"
                        className={getStatusBadgeClass(status)}
                      >
                        {formatMeetingStatus(status)}
                      </Badge>
                    </TableCell>
                    
                    {isV2Meeting && (
                      <TableCell>
                        {meeting.closer ? (
                          <span className="text-amber-400 font-medium">
                            {meeting.closer}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    )}
                    
                    <TableCell className="text-muted-foreground">
                      {probability ? `${probability}%` : 'N/A'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </TooltipProvider>
        </Table>
      </div>
    </div>
  );
}
