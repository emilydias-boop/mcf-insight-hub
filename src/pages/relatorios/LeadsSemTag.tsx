import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  AlertCircle, 
  Calendar, 
  Download, 
  Save, 
  Trash2,
  FileText,
  Search
} from "lucide-react";
import { 
  useLeadsSemTagReport, 
  useSavedReports, 
  useSaveReport, 
  useDeleteReport 
} from "@/hooks/useLeadsSemTagReport";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";

export default function LeadsSemTag() {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [reportName, setReportName] = useState("");
  const [deleteReportId, setDeleteReportId] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<any>(null);

  const { data: reportData, isLoading, refetch } = useLeadsSemTagReport(startDate, endDate);
  const { data: savedReports } = useSavedReports();
  const saveReportMutation = useSaveReport();
  const deleteReportMutation = useDeleteReport();

  const handleGenerateReport = () => {
    if (!startDate || !endDate) {
      return;
    }
    refetch();
    setSelectedReport(null);
  };

  const handleSaveReport = () => {
    if (!reportData || !startDate || !endDate) return;

    const name = reportName.trim() || 
      `Leads sem Tag - ${format(startDate, 'dd/MM/yyyy')} a ${format(endDate, 'dd/MM/yyyy')}`;

    saveReportMutation.mutate({
      name,
      startDate,
      endDate,
      data: reportData
    });

    setReportName("");
  };

  const handleOpenSavedReport = (report: any) => {
    setSelectedReport(report);
    setStartDate(new Date(report.start_date));
    setEndDate(new Date(report.end_date));
  };

  const handleDeleteReport = () => {
    if (deleteReportId) {
      deleteReportMutation.mutate(deleteReportId);
      setDeleteReportId(null);
      if (selectedReport?.id === deleteReportId) {
        setSelectedReport(null);
      }
    }
  };

  const handleExportExcel = () => {
    const dataToExport = selectedReport?.data || reportData;
    if (!dataToExport) return;

    // Criar CSV
    const headers = ["Nome", "Email", "Telefone", "Tags", "SDR", "Data/Hora"];
    const rows = dataToExport.leads.map((lead: any) => [
      lead.nome,
      lead.email,
      lead.telefone,
      lead.tags.join(", "),
      lead.sdr,
      format(new Date(lead.data), "dd/MM/yyyy HH:mm", { locale: ptBR })
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row: string[]) => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    // Download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `leads-sem-tag-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  const displayData = selectedReport?.data || reportData;

  return (
    <RoleGuard allowedRoles={["admin", "coordenador"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Leads sem Tag em R1 Agendada</h1>
          <p className="text-muted-foreground mt-1">
            Identifique leads que entraram em R1 Agendada sem classificação Lead A/B/C
          </p>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Gerar Relatório
            </CardTitle>
            <CardDescription>
              Selecione o período para buscar leads sem tag de classificação
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Data Início</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate ? format(startDate, "yyyy-MM-dd") : ""}
                  onChange={(e) => setStartDate(e.target.value ? new Date(e.target.value) : undefined)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">Data Fim</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate ? format(endDate, "yyyy-MM-dd") : ""}
                  onChange={(e) => setEndDate(e.target.value ? new Date(e.target.value) : undefined)}
                />
              </div>
            </div>
            <Button 
              onClick={handleGenerateReport} 
              disabled={!startDate || !endDate || isLoading}
              className="w-full md:w-auto"
            >
              <Calendar className="h-4 w-4 mr-2" />
              {isLoading ? "Gerando..." : "Gerar Relatório"}
            </Button>
          </CardContent>
        </Card>

        {/* Resultados */}
        {displayData && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-warning" />
                    Resultados
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {displayData.total} lead{displayData.total !== 1 ? 's' : ''} encontrado{displayData.total !== 1 ? 's' : ''} sem tag Lead A/B/C
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleExportExcel}>
                    <Download className="h-4 w-4 mr-2" />
                    Exportar Excel
                  </Button>
                  {!selectedReport && reportData && (
                    <Button onClick={handleSaveReport} disabled={saveReportMutation.isPending}>
                      <Save className="h-4 w-4 mr-2" />
                      Salvar Relatório
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {reportName === "" && !selectedReport && reportData && (
                <div className="mb-4">
                  <Label htmlFor="report-name">Nome do Relatório (opcional)</Label>
                  <Input
                    id="report-name"
                    placeholder="Ex: Leads sem tag - Semana 1"
                    value={reportName}
                    onChange={(e) => setReportName(e.target.value)}
                    className="mt-1"
                  />
                </div>
              )}

              <ScrollArea className="h-[500px] w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Tags</TableHead>
                      <TableHead>SDR</TableHead>
                      <TableHead>Data/Hora R1</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayData.leads.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          Nenhum lead sem tag encontrado no período
                        </TableCell>
                      </TableRow>
                    ) : (
                      displayData.leads.map((lead: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{lead.nome}</TableCell>
                          <TableCell className="text-muted-foreground">{lead.email}</TableCell>
                          <TableCell className="text-muted-foreground">{lead.telefone}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {lead.tags.slice(0, 3).map((tag: string, i: number) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                              {lead.tags.length > 3 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{lead.tags.length - 3}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{lead.sdr}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(lead.data), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Histórico de Relatórios Salvos */}
        {savedReports && savedReports.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Relatórios Salvos
              </CardTitle>
              <CardDescription>
                Histórico de relatórios gerados anteriormente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {savedReports.map((report) => (
                  <div
                    key={report.id}
                    className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1">
                      <h4 className="font-medium text-foreground">{report.name}</h4>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span>
                          {format(new Date(report.start_date), "dd/MM/yyyy")} - {format(new Date(report.end_date), "dd/MM/yyyy")}
                        </span>
                        <Separator orientation="vertical" className="h-4" />
                        <span>{(report.data as any).total} leads</span>
                        <Separator orientation="vertical" className="h-4" />
                        <span>
                          Salvo em {format(new Date(report.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenSavedReport(report)}
                      >
                        Abrir
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteReportId(report.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dialog de confirmação de exclusão */}
        <AlertDialog open={!!deleteReportId} onOpenChange={() => setDeleteReportId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir relatório?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. O relatório será permanentemente excluído.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteReport}>
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </RoleGuard>
  );
}
