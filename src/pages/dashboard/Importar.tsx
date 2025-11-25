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
      
      // Parse números com formato brasileiro (R$ 1.234,56)
      const parseNum = (val: any) => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        // Remove R$, espaços, pontos de milhar, troca vírgula por ponto
        return parseFloat(
          String(val)
            .replace(/R\$\s*/g, '')
            .replace(/\./g, '')
            .replace(',', '.')
        ) || 0;
      };

      // Parse data DD/MM/YYYY para YYYY-MM-DD
      const parseDate = (dateStr: any) => {
        if (!dateStr) return null;
        const [day, month, year] = String(dateStr).split('/');
        if (!day || !month || !year) return null;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      };

      console.log('Abas encontradas:', workbook.SheetNames);

      // Processar cada aba
      for (const sheetName of workbook.SheetNames) {
        console.log(`Processando aba: ${sheetName}`);
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);
        
        // Procurar especificamente pela aba "Resultados Semanais"
        if (sheetName.toLowerCase().includes('resultados semanais') || 
            sheetName.toLowerCase().includes('resultados_semanais')) {
          
          console.log(`✓ Aba de métricas encontrada: ${sheetName}`);
          console.log(`  Total de linhas: ${data.length}`);
          
          for (const row of data) {
            // Parse datas separadas (Data Inicio e Data Fim)
            const dataInicio = row['Data Inicio'] || row['Data início'] || row['Data Início'];
            const dataFim = row['Data Fim'] || row['Data fim'];
            
            if (!dataInicio || !dataFim) {
              console.log('  ⚠ Linha ignorada: datas não encontradas', row);
              continue;
            }
            
            const startDate = parseDate(dataInicio);
            const endDate = parseDate(dataFim);
            
            if (!startDate || !endDate) {
              console.log('  ⚠ Linha ignorada: formato de data inválido', { dataInicio, dataFim });
              continue;
            }

            // Gerar week_label
            const [startDay, startMonth] = String(dataInicio).split('/');
            const [endDay, endMonth] = String(dataFim).split('/');
            const weekLabel = `${startDay}/${startMonth} - ${endDay}/${endMonth}`;

            const metric = {
              start_date: startDate,
              end_date: endDate,
              week_label: weekLabel,
              
              // Custos
              ads_cost: parseNum(row['Custo Ads (MAKE)']),
              team_cost: parseNum(row['Custo Equipe']),
              office_cost: parseNum(row['Custo Escritório']),
              total_cost: parseNum(row['Custo Real Por Semana (ADS - (A010+BIM))']),
              
              // Receitas e vendas A010
              a010_revenue: parseNum(row['Faturado Curso A010']),
              a010_sales: parseInt(row['Vendas A010']) || 0,
              
              // Receitas Order Bumps
              ob_construir_revenue: parseNum(row['Faturado Order Bump Construir Para Alugar']),
              ob_construir_sales: parseInt(row['Vendas OB Construir Para alugar']) || 0,
              ob_vitalicio_revenue: parseNum(row['Faturado Order Bump Acesso Vitalício']),
              ob_vitalicio_sales: parseInt(row['Vendas Acesso Vitalício']) || 0,
              ob_evento_revenue: parseNum(row['Valor Vendido OB Evento']),
              ob_evento_sales: parseInt(row['Vendas OB Evento']) || 0,
              
              // Receitas Contrato
              contract_revenue: parseNum(row['Faturado Contrato']),
              contract_sales: parseInt(row['Vendas Contrato']) || 0,
              
              // Receitas Clint
              clint_revenue: parseNum(row['Faturado Clint']),
              
              // Métricas
              roi: parseNum(row['ROI']),
              roas: parseNum(row['ROAS']),
              cpl: parseNum(row['CPL']),
              cplr: parseNum(row['CPLR']),
              
              // Outros
              sdr_ia_ig: parseInt(row['SDR IA+IG']) || 0,
              incorporador_50k: parseInt(row['Incorporador 50K']) || 0,
              ultrameta_clint: parseNum(row['Ultrameta Clint']),
              
              // Funil - Etapas com valores reais
              stage_01_actual: parseInt(row['01']) || 0,
              stage_02_actual: parseInt(row['02']) || 0,
              stage_03_actual: parseInt(row['03']) || 0,
              stage_04_actual: parseInt(row['04']) || 0,
              stage_05_actual: parseInt(row['05']) || 0,
              stage_06_actual: parseInt(row['06']) || 0,
              stage_07_actual: parseInt(row['07']) || 0,
              stage_08_actual: parseInt(row['08']) || 0,
              
              // Funil - Metas
              stage_01_target: parseInt(row['Meta 01']) || 0,
              stage_02_target: parseInt(row['Meta 02']) || 0,
              stage_03_target: parseInt(row['Meta 03']) || 0,
              stage_04_target: parseInt(row['Meta 04']) || 0,
              stage_05_target: parseInt(row['Meta 05']) || 0,
              stage_06_target: parseInt(row['Meta 06']) || 0,
              stage_07_target: parseInt(row['Meta 07']) || 0,
              stage_08_target: parseInt(row['Meta 08']) || 0,
              
              // Funil - Taxas de conversão
              stage_01_rate: parseNum(row['Taxa 01']),
              stage_02_rate: parseNum(row['Taxa 02']),
              stage_03_rate: parseNum(row['Taxa 03']),
              stage_04_rate: parseNum(row['Taxa 04']),
              stage_05_rate: parseNum(row['Taxa 05']),
              stage_06_rate: parseNum(row['Taxa 06']),
              stage_07_rate: parseNum(row['Taxa 07']),
              stage_08_rate: parseNum(row['Taxa 08']),
            };

            console.log('  ✓ Métrica processada:', { weekLabel, startDate, endDate });
            metrics.push(metric);
          }
        }
      }

      console.log(`Total de métricas processadas: ${metrics.length}`);

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
                <h4 className="font-semibold text-foreground mb-1">Aba "Resultados Semanais"</h4>
                <p className="text-muted-foreground mb-2">
                  A planilha deve conter uma aba chamada "Resultados Semanais" com as seguintes colunas:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>Data Inicio e Data Fim (formato DD/MM/YYYY)</li>
                  <li>Custo Ads (MAKE), Custo Equipe, Custo Escritório</li>
                  <li>Faturado Curso A010, Vendas A010</li>
                  <li>Faturado Order Bumps (Construir, Vitalício, Evento)</li>
                  <li>Faturado Contrato, Faturado Clint</li>
                  <li>ROI, ROAS, CPL, CPLR</li>
                  <li>Funil: colunas 01 a 08 (valores), Meta 01 a 08, Taxa 01 a 08</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-1">Formato de Valores</h4>
                <p className="text-muted-foreground">
                  O sistema aceita valores no formato brasileiro: R$ 1.234,56
                </p>
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
