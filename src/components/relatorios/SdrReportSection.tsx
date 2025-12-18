import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DatePickerCustom } from "@/components/ui/DatePickerCustom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, Download, RefreshCw, Users } from "lucide-react";
import { useSdrReportData, SdrReportMetrics } from "@/hooks/useSdrReportData";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function SdrReportSection() {
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  
  const { data: sdrData, isLoading, isError, error, refetch } = useSdrReportData(
    dateRange.from || null,
    dateRange.to || null
  );
  
  const totals = (sdrData || []).reduce((acc, sdr) => ({
    primeiro_agendamento: acc.primeiro_agendamento + (sdr.primeiro_agendamento || 0),
    reagendamento: acc.reagendamento + (sdr.reagendamento || 0),
    r1_agendada: acc.r1_agendada + sdr.r1_agendada,
    r1_realizada: acc.r1_realizada + sdr.r1_realizada,
    no_shows: acc.no_shows + sdr.no_shows,
    contratos: acc.contratos + sdr.contratos,
  }), { primeiro_agendamento: 0, reagendamento: 0, r1_agendada: 0, r1_realizada: 0, no_shows: 0, contratos: 0 });
  
  const handleExportExcel = () => {
    try {
      if (!sdrData || sdrData.length === 0 || !dateRange.from || !dateRange.to) {
        toast.error('Dados incompletos para exportação');
        return;
      }
      
      // Prepare data for Excel with new columns
      const excelData = sdrData.map(sdr => ({
        'SDR': sdr.sdr_name,
        'Email': sdr.sdr_email,
        '1º Agend': sdr.primeiro_agendamento || 0,
        'Reagend': sdr.reagendamento || 0,
        'Total Agend': sdr.r1_agendada,
        'Realizadas': sdr.r1_realizada,
        'No-Shows': sdr.no_shows,
        'Contratos': sdr.contratos,
        'Taxa Conversão (%)': sdr.taxa_conversao.toFixed(1),
        'Taxa No-Show (%)': sdr.taxa_no_show.toFixed(1),
      }));
      
      // Add totals row
      excelData.push({
        'SDR': 'TOTAL',
        'Email': '',
        '1º Agend': totals.primeiro_agendamento,
        'Reagend': totals.reagendamento,
        'Total Agend': totals.r1_agendada,
        'Realizadas': totals.r1_realizada,
        'No-Shows': totals.no_shows,
        'Contratos': totals.contratos,
        'Taxa Conversão (%)': totals.r1_agendada > 0 
          ? ((totals.r1_realizada / totals.r1_agendada) * 100).toFixed(1) 
          : '0.0',
        'Taxa No-Show (%)': totals.r1_agendada > 0 
          ? ((totals.no_shows / totals.r1_agendada) * 100).toFixed(1) 
          : '0.0',
      });
      
      // Create workbook
      const wb = XLSX.utils.book_new();
      
      // Create main data sheet
      const ws = XLSX.utils.json_to_sheet(excelData);
      
      // Set column widths
      ws['!cols'] = [
        { wch: 25 }, // SDR
        { wch: 35 }, // Email
        { wch: 10 }, // 1º Agend
        { wch: 10 }, // Reagend
        { wch: 12 }, // Total Agend
        { wch: 12 }, // Realizadas
        { wch: 10 }, // No-Shows
        { wch: 12 }, // Contratos
        { wch: 18 }, // Taxa Conversão
        { wch: 18 }, // Taxa No-Show
      ];
      
      XLSX.utils.book_append_sheet(wb, ws, 'Relatório SDR');
      
      // Create summary sheet with updated metrics
      const summaryData = [
        { 'Métrica': 'Período', 'Valor': `${format(dateRange.from, 'dd/MM/yyyy')} a ${format(dateRange.to, 'dd/MM/yyyy')}` },
        { 'Métrica': 'Total SDRs', 'Valor': sdrData.length },
        { 'Métrica': '1º Agendamentos', 'Valor': totals.primeiro_agendamento },
        { 'Métrica': 'Reagendamentos', 'Valor': totals.reagendamento },
        { 'Métrica': 'Total Agendamentos', 'Valor': totals.r1_agendada },
        { 'Métrica': 'Realizadas (Intermediação)', 'Valor': totals.r1_realizada },
        { 'Métrica': 'No-Shows', 'Valor': totals.no_shows },
        { 'Métrica': 'Contratos (Intermediação)', 'Valor': totals.contratos },
        { 'Métrica': 'Taxa Conversão Média', 'Valor': `${totals.r1_agendada > 0 ? ((totals.r1_realizada / totals.r1_agendada) * 100).toFixed(1) : 0}%` },
        { 'Métrica': 'Taxa No-Show Média', 'Valor': `${totals.r1_agendada > 0 ? ((totals.no_shows / totals.r1_agendada) * 100).toFixed(1) : 0}%` },
      ];
      
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      wsSummary['!cols'] = [{ wch: 30 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo');
      
      // Generate filename
      const filename = `relatorio_sdr_${format(dateRange.from, 'ddMMyyyy')}_${format(dateRange.to, 'ddMMyyyy')}.xlsx`;
      
      // Download
      XLSX.writeFile(wb, filename);
      toast.success('Excel exportado com sucesso!');
    } catch (err) {
      console.error('Erro ao exportar Excel:', err);
      toast.error('Erro ao exportar: ' + (err as Error).message);
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Relatório de Performance SDR (Nova Lógica)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Período</label>
              <DatePickerCustom 
                mode="range" 
                placeholder="Selecione o período"
                selected={dateRange}
                onSelect={(range: any) => setDateRange(range || { from: undefined, to: undefined })}
              />
            </div>
            
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
            
            <Button onClick={handleExportExcel} disabled={!sdrData || sdrData.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Error State */}
      {isError && (
        <Card className="bg-destructive/10 border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Erro ao carregar dados</p>
                <p className="text-sm text-muted-foreground">
                  {(error as Error)?.message || 'Erro desconhecido ao buscar relatório SDR'}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={() => refetch()} className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <Card className="bg-card border-border">
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center gap-3">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Carregando relatório SDR...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards - updated */}
      {!isLoading && !isError && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">1º Agend</p>
              <p className="text-2xl font-bold text-primary">{totals.primeiro_agendamento}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Reagend</p>
              <p className="text-2xl font-bold text-amber-500">{totals.reagendamento}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Agend</p>
              <p className="text-2xl font-bold text-blue-500">{totals.r1_agendada}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Realizadas</p>
              <p className="text-2xl font-bold text-success">{totals.r1_realizada}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">No-Shows</p>
              <p className="text-2xl font-bold text-destructive">{totals.no_shows}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Contratos</p>
              <p className="text-2xl font-bold text-chart-1">{totals.contratos}</p>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Data Table - updated columns */}
      {!isLoading && !isError && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Métricas por SDR</CardTitle>
          </CardHeader>
          <CardContent>
            {!sdrData || sdrData.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum dado encontrado para o período selecionado
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SDR</TableHead>
                    <TableHead className="text-center">1º Agend</TableHead>
                    <TableHead className="text-center">Reagend</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">Realizadas</TableHead>
                    <TableHead className="text-center">No-Shows</TableHead>
                    <TableHead className="text-center">Contratos</TableHead>
                    <TableHead className="text-center">Conv %</TableHead>
                    <TableHead className="text-center">NS %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sdrData.map((sdr) => (
                    <TableRow key={sdr.sdr_email}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{sdr.sdr_name}</p>
                          <p className="text-xs text-muted-foreground">{sdr.sdr_email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-medium">{sdr.primeiro_agendamento || 0}</TableCell>
                      <TableCell className="text-center font-medium text-amber-500">{sdr.reagendamento || 0}</TableCell>
                      <TableCell className="text-center font-medium text-blue-500">{sdr.r1_agendada}</TableCell>
                      <TableCell className="text-center font-medium text-success">{sdr.r1_realizada}</TableCell>
                      <TableCell className="text-center font-medium text-destructive">{sdr.no_shows}</TableCell>
                      <TableCell className="text-center font-medium">{sdr.contratos}</TableCell>
                      <TableCell className="text-center">
                        <span className={sdr.taxa_conversao >= 70 ? 'text-success' : sdr.taxa_conversao >= 50 ? 'text-warning' : 'text-destructive'}>
                          {sdr.taxa_conversao.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={sdr.taxa_no_show <= 20 ? 'text-success' : sdr.taxa_no_show <= 30 ? 'text-warning' : 'text-destructive'}>
                          {sdr.taxa_no_show.toFixed(1)}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Totals row */}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell>TOTAL</TableCell>
                    <TableCell className="text-center">{totals.primeiro_agendamento}</TableCell>
                    <TableCell className="text-center text-amber-500">{totals.reagendamento}</TableCell>
                    <TableCell className="text-center text-blue-500">{totals.r1_agendada}</TableCell>
                    <TableCell className="text-center text-success">{totals.r1_realizada}</TableCell>
                    <TableCell className="text-center text-destructive">{totals.no_shows}</TableCell>
                    <TableCell className="text-center">{totals.contratos}</TableCell>
                    <TableCell className="text-center">
                      {totals.r1_agendada > 0 ? ((totals.r1_realizada / totals.r1_agendada) * 100).toFixed(1) : 0}%
                    </TableCell>
                    <TableCell className="text-center">
                      {totals.r1_agendada > 0 ? ((totals.no_shows / totals.r1_agendada) * 100).toFixed(1) : 0}%
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
