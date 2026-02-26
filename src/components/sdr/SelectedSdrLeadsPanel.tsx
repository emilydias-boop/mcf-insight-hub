import { useState, useMemo } from "react";
import { X, Filter, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MeetingsTable } from "./MeetingsTable";
import { SdrMeetingActionsDrawer } from "./SdrMeetingActionsDrawer";
import { MeetingV2 } from "@/hooks/useSdrMetricsV2";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatMeetingStatus } from "@/utils/formatMeetingStatus";

interface SelectedSdrLeadsPanelProps {
  sdrName: string;
  sdrEmail: string;
  meetings: MeetingV2[];
  onClose: () => void;
}

export function SelectedSdrLeadsPanel({
  sdrName,
  sdrEmail,
  meetings,
  onClose,
}: SelectedSdrLeadsPanelProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingV2 | null>(null);

  // Get unique status values
  const uniqueStatuses = useMemo(() => {
    const statuses = new Set<string>();
    meetings.forEach(m => {
      if (m.status_atual) statuses.add(m.status_atual);
    });
    return Array.from(statuses).sort();
  }, [meetings]);

  // Filtered meetings
  const filteredMeetings = useMemo(() => {
    return meetings.filter(m => {
      if (statusFilter !== "all" && m.status_atual !== statusFilter) return false;
      if (tipoFilter !== "all" && m.tipo !== tipoFilter) return false;
      return true;
    });
  }, [meetings, statusFilter, tipoFilter]);

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      "Data/Hora",
      "Tipo",
      "Conta",
      "Lead",
      "Email",
      "Telefone",
      "Origem",
      "Status",
      "Closer",
      "Probabilidade"
    ];

    const rows = filteredMeetings.map(m => [
      m.data_agendamento ? format(new Date(m.data_agendamento), "dd/MM/yyyy HH:mm") : "",
      m.tipo,
      m.conta ? "Sim" : "Não",
      m.contact_name || "",
      m.contact_email || "",
      m.contact_phone || "",
      m.origin_name || "",
      formatMeetingStatus(m.status_atual),
      m.closer || "",
      m.probability ? `${m.probability}%` : ""
    ]);

    const csvContent = [
      headers.join(";"),
      ...rows.map(row => row.join(";"))
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `leads_${sdrEmail.split('@')[0]}_${format(new Date(), "yyyyMMdd_HHmm")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Card className="border-primary/20 bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-lg">
                Leads de <span className="text-primary">{sdrName}</span>
              </CardTitle>
              <span className="text-sm text-muted-foreground">
                ({filteredMeetings.length} de {meetings.length})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-1" />
                Exportar
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Filters */}
          <div className="flex items-center gap-3 mt-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Filtros:</span>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] h-8">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                {uniqueStatuses.map(status => (
                  <SelectItem key={status} value={status}>{formatMeetingStatus(status)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="w-[180px] h-8">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Tipos</SelectItem>
                <SelectItem value="1º Agendamento">1º Agendamento</SelectItem>
                <SelectItem value="Reagendamento Válido">Reagendamento Válido</SelectItem>
                <SelectItem value="Reagendamento Inválido">Reagendamento Inválido</SelectItem>
              </SelectContent>
            </Select>

            {(statusFilter !== "all" || tipoFilter !== "all") && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => { setStatusFilter("all"); setTipoFilter("all"); }}
                className="text-xs"
              >
                Limpar filtros
              </Button>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          <div className="max-h-[400px] overflow-y-auto">
            <MeetingsTable
              meetings={filteredMeetings}
              isLoading={false}
              onSelectMeeting={(meeting) => setSelectedMeeting(meeting as MeetingV2)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Meeting Actions Drawer */}
      <SdrMeetingActionsDrawer
        meeting={selectedMeeting}
        onClose={() => setSelectedMeeting(null)}
      />
    </>
  );
}
