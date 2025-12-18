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
import { Meeting } from "@/hooks/useSdrMeetings";
import { Skeleton } from "@/components/ui/skeleton";

interface MeetingsTableProps {
  meetings: Meeting[];
  isLoading?: boolean;
  onSelectMeeting: (meeting: Meeting) => void;
}

const getStageBadgeClass = (classification: string) => {
  switch (classification) {
    case 'agendada':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'realizada':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'noShow':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'contratoPago':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const formatTimeToHuman = (hours: number | null): string => {
  if (hours === null) return 'N/A';
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
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

  return (
    <div className="h-full flex flex-col rounded-md border border-border overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
            <TableRow className="hover:bg-muted/80">
              <TableHead className="text-muted-foreground">Data/Horário</TableHead>
              <TableHead className="text-muted-foreground">Lead</TableHead>
              <TableHead className="text-muted-foreground">Origem</TableHead>
              <TableHead className="text-muted-foreground">Estágio</TableHead>
              <TableHead className="text-muted-foreground">Tempo p/ Agendar</TableHead>
              <TableHead className="text-muted-foreground">Tempo p/ Contrato</TableHead>
              <TableHead className="text-muted-foreground">Prob.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {meetings.map((meeting) => (
              <TableRow
                key={meeting.id}
                className="cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => onSelectMeeting(meeting)}
              >
                <TableCell className="font-medium">
                  {meeting.scheduledDate
                    ? format(new Date(meeting.scheduledDate), "dd/MM HH:mm", { locale: ptBR })
                    : 'N/A'}
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium text-foreground">{meeting.contactName}</p>
                    {meeting.contactEmail && (
                      <p className="text-xs text-muted-foreground">{meeting.contactEmail}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-muted-foreground">{meeting.originName}</span>
                </TableCell>
                <TableCell>
                  <Badge 
                    variant="outline"
                    className={getStageBadgeClass(meeting.currentStageClassification)}
                  >
                    {meeting.currentStage}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatTimeToHuman(meeting.timeToSchedule)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatTimeToHuman(meeting.timeToContract)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {meeting.probability ? `${meeting.probability}%` : 'N/A'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
