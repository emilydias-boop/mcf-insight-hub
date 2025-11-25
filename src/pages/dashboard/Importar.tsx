import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from 'xlsx';

export default function Importar() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv'
      ];
      
      if (!validTypes.includes(selectedFile.type)) {
        toast({
          title: "Formato inválido",
          description: "Por favor, selecione um arquivo Excel (.xlsx, .xls) ou CSV.",
          variant: "destructive",
        });
        return;
      }
      
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast({
        title: "Nenhum arquivo selecionado",
        description: "Por favor, selecione um arquivo Excel para importar.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setProgress(0);
    setResult(null);

    try {
      // Ler arquivo
      setProgress(20);
      const arrayBuffer = await file.arrayBuffer();
      
      // Parse Excel
      setProgress(40);
      const workbook = XLSX.read(arrayBuffer);
      
      const metrics: any[] = [];
      
      // Processar cada aba
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);
        
        // Detectar se é aba de métricas
        if (sheetName.toLowerCase().includes('métrica') || 
            sheetName.toLowerCase().includes('metrica') || 
            sheetName.toLowerCase().includes('semana')) {
          
          for (const row of data) {
            // Parse período
            const periodoStr = row['Período'] || row['periodo'] || row['PERÍODO'];
            if (!periodoStr) continue;
            
            // Converter período para datas
            const parts = String(periodoStr).split(' a ');
            if (parts.length !== 2) continue;
            
            const [startStr, endStr] = parts.map(s => s.trim());
            const [startDay, startMonth, startYear] = startStr.split('/');
            const [endDay, endMonth, endYear] = endStr.split('/');
            
            const startDate = `${startYear}-${startMonth.padStart(2, '0')}-${startDay.padStart(2, '0')}`;
            const endDate = `${endYear}-${endMonth.padStart(2, '0')}-${endDay.padStart(2, '0')}`;
            
            // Parse números (formato BR)
            const parseNum = (val: any) => {
              if (typeof val === 'number') return val;
              if (!val) return 0;
              return parseFloat(String(val).replace(/\./g, '').replace(',', '.'));
            };
            
            metrics.push({
              start_date: startDate,
              end_date: endDate,
              week_label: `Semana ${startDay}/${startMonth}`,
              ads_cost: parseNum(row['Custo Ads'] || row['custo_ads']),
              team_cost: parseNum(row['Custo Equipe'] || row['custo_equipe']),
              office_cost: parseNum(row['Custo Escritório'] || row['custo_escritorio']),
              a010_revenue: parseNum(row['Faturamento A010'] || row['faturamento_a010']),
              a010_sales: parseNum(row['Vendas A010'] || row['vendas_a010']),
              ob_evento_revenue: parseNum(row['Faturamento OB Evento'] || row['faturamento_ob_evento']),
              ob_evento_sales: parseNum(row['Vendas OB Evento'] || row['vendas_ob_evento']),
              contract_revenue: parseNum(row['Faturamento Contratos'] || row['faturamento_contratos']),
              contract_sales: parseNum(row['Vendas Contratos'] || row['vendas_contratos']),
              ob_construir_revenue: parseNum(row['Faturamento OB Construir'] || row['faturamento_ob_construir']),
              ob_construir_sales: parseNum(row['Vendas OB Construir'] || row['vendas_ob_construir']),
              ob_vitalicio_revenue: parseNum(row['Faturamento OB Vitalício'] || row['faturamento_ob_vitalicio']),
              ob_vitalicio_sales: parseNum(row['Vendas OB Vitalício'] || row['vendas_ob_vitalicio']),
              roi: parseNum(row['ROI'] || row['roi']),
              roas: parseNum(row['ROAS'] || row['roas']),
              cpl: parseNum(row['CPL'] || row['cpl']),
              stage_01_actual: parseNum(row['Etapa 01'] || row['etapa_01']),
              stage_02_actual: parseNum(row['Etapa 02'] || row['etapa_02']),
              stage_03_actual: parseNum(row['Etapa 03'] || row['etapa_03']),
              stage_04_actual: parseNum(row['Etapa 04'] || row['etapa_04']),
              stage_05_actual: parseNum(row['Etapa 05'] || row['etapa_05']),
              stage_06_actual: parseNum(row['Etapa 06'] || row['etapa_06']),
              stage_07_actual: parseNum(row['Etapa 07'] || row['etapa_07']),
              stage_08_actual: parseNum(row['Etapa 08'] || row['etapa_08']),
            });
          }
        }
      }

      setProgress(60);

      if (metrics.length === 0) {
        throw new Error('Nenhuma métrica encontrada no arquivo');
      }

      // Enviar para edge function
      const { data, error } = await supabase.functions.invoke('import-weekly-metrics', {
        body: { metrics },
      });

      setProgress(100);

      if (error) throw error;

      setResult({
        success: true,
        message: `Importação concluída com sucesso!`,
        details: { imported: metrics.length },
      });

      toast({
        title: "Importação concluída",
        description: `${metrics.length} registros importados com sucesso.`,
      });
    } catch (err: any) {
      console.error('Erro:', err);
      setResult({
        success: false,
        message: err.message || 'Erro ao processar arquivo',
      });
      toast({
        title: "Erro na importação",
        description: err.message || "Não foi possível processar o arquivo.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Importar Dados</h1>
        <p className="text-muted-foreground mt-1">
          Faça upload da planilha Excel com métricas semanais, comissões e transações
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload de Arquivo
            </CardTitle>
            <CardDescription>
              Selecione a planilha Excel (.xlsx, .xls) ou CSV com os dados históricos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file">Arquivo</Label>
              <Input
                id="file"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                disabled={uploading}
              />
              {file && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  {file.name} ({(file.size / 1024).toFixed(2)} KB)
                </p>
              )}
            </div>

            {uploading && (
              <div className="space-y-2">
                <Label>Progresso</Label>
                <Progress value={progress} className="w-full" />
                <p className="text-sm text-muted-foreground">{progress}% concluído</p>
              </div>
            )}

            <Button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="w-full"
            >
              {uploading ? "Processando..." : "Importar Dados"}
            </Button>

            {result && (
              <Alert variant={result.success ? "default" : "destructive"}>
                {result.success ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertDescription>
                  {result.message}
                  {result.details && (
                    <div className="mt-2 text-sm">
                      <p>Registros importados: {result.details.imported}</p>
                      {result.details.errors?.length > 0 && (
                        <p className="text-destructive">
                          Erros: {result.details.errors.length}
                        </p>
                      )}
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Instruções</CardTitle>
            <CardDescription>Como preparar sua planilha para importação</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 text-sm">
              <div>
                <h4 className="font-semibold text-foreground mb-1">Formato do Arquivo</h4>
                <p className="text-muted-foreground">
                  A planilha deve estar no formato Excel (.xlsx, .xls) ou CSV.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-1">Colunas Necessárias</h4>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>Período (data de início e fim)</li>
                  <li>Custos (Ads, Equipe, Escritório)</li>
                  <li>Receitas por canal (A010, OB Evento, Contratos, etc.)</li>
                  <li>Métricas (ROI, ROAS, CPL)</li>
                  <li>Funil (Etapas 01 a 08)</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-1">Abas Suportadas</h4>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>Métricas Semanais (weekly_metrics)</li>
                  <li>Comissões (closer_commissions)</li>
                  <li>Transações Hubla (hubla_transactions)</li>
                </ul>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  O sistema irá detectar e processar automaticamente as abas da planilha,
                  mapeando os dados para as tabelas corretas do banco de dados.
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
