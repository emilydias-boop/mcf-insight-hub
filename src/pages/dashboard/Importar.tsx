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
  const [sheetsFound, setSheetsFound] = useState<string[]>([]);

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

      // Parse data DD/MM/YYYY para YYYY-MM-DD ou Excel serial
      const parseDate = (dateStr: any) => {
        if (!dateStr) return null;
        
        // Se for número, é data serial do Excel
        if (typeof dateStr === 'number') {
          const excelEpoch = new Date(1899, 11, 30);
          const excelDate = new Date(excelEpoch.getTime() + dateStr * 86400000);
          const year = excelDate.getFullYear();
          const month = String(excelDate.getMonth() + 1).padStart(2, '0');
          const day = String(excelDate.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
        
        // Se for string DD/MM/YYYY
        const [day, month, year] = String(dateStr).split('/');
        if (!day || !month || !year) return null;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      };

      console.log('Abas encontradas:', workbook.SheetNames);
      setSheetsFound(workbook.SheetNames);

      // Buscar pela aba "Resultado Semanal" (SINGULAR)
      const isResultadoSemanal = (name: string) => {
        const normalized = name.toLowerCase().trim();
        return normalized === 'resultado semanal' || 
               (normalized.includes('resultado') && normalized.includes('semanal') && !normalized.includes('semanais'));
      };

      let metricsSheetFound = false;

      // Processar cada aba
      for (const sheetName of workbook.SheetNames) {
        console.log(`Processando aba: ${sheetName}`);
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);
        
        if (isResultadoSemanal(sheetName)) {
          metricsSheetFound = true;
          
          console.log(`✓ Aba de métricas encontrada: ${sheetName}`);
          console.log(`  Total de linhas: ${data.length}`);
          console.log('📋 Colunas encontradas:', Object.keys(data[0] || {}));
          
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

            // Gerar week_label no formato DD/MM - DD/MM
            const formatWeekLabel = (start: string, end: string) => {
              const startParts = String(start).split('/');
              const endParts = String(end).split('/');
              if (startParts.length >= 2 && endParts.length >= 2) {
                return `${startParts[0].padStart(2,'0')}/${startParts[1].padStart(2,'0')} - ${endParts[0].padStart(2,'0')}/${endParts[1].padStart(2,'0')}`;
              }
              return `${start} - ${end}`;
            };
            const weekLabel = formatWeekLabel(dataInicio, dataFim);

            // Parse valores com nomes EXATOS das colunas
            const ads_cost = parseNum(row['Custo Ads (MAKE)']);
            const team_cost = parseNum(row['Custo Equipe (PLANILHA MANUAL)']);
            const office_cost = parseNum(row['Custo Escritório (PLANILHA MANUAL)']);
            
            const a010_revenue = parseNum(row['Faturado Curso A010']);
            const a010_sales = parseInt(row['Vendas A010']) || 0;
            
            const ob_construir_revenue = parseNum(row['Faturado Order Bump Construir Para Alugar']);
            const ob_construir_sales = parseInt(row['Vendas OB Construir Para alugar']) || 0;
            const ob_vitalicio_revenue = parseNum(row['Faturado Order Bump Acesso Vitalício']);
            const ob_vitalicio_sales = parseInt(row['Vendas Acesso Vitalício']) || 0;
            const ob_evento_revenue = parseNum(row['Valor Vendido OB Evento']);
            const ob_evento_sales = parseInt(row['Vendas OB Evento']) || 0;
            
            const contract_revenue = parseNum(row['Faturado Contrato']);
            const contract_sales = parseInt(row['Vendas Contrato']) || 0;
            
            const clint_revenue = parseNum(row['Faturamento Clint']);
            const incorporador_50k = parseNum(row['Faturamento Incorporador 50k']);
            const ultrameta_clint = parseNum(row['Ultrameta Clint']);
            const sdr_ia_ig = parseInt(row['SDR IA+IG']) || 0;
            
            // CALCULAR campos derivados
            const total_revenue = a010_revenue + ob_construir_revenue + ob_vitalicio_revenue + ob_evento_revenue + contract_revenue;
            const total_cost = ads_cost + team_cost + office_cost;
            const real_cost = ads_cost - (a010_revenue + ob_construir_revenue + ob_vitalicio_revenue + ob_evento_revenue);
            const operating_profit = total_revenue - total_cost;
            const cir = contract_revenue > 0 ? (real_cost / contract_revenue) * 100 : 0;
            
            // Calcular Ultrameta Líquido: (Faturamento Total * Vendas A010) + (SDR IA+IG * Faturamento Total / 2)
            const ultrameta_liquido = (total_revenue * a010_sales) + (sdr_ia_ig * total_revenue / 2);

            const metric = {
              start_date: startDate,
              end_date: endDate,
              week_label: weekLabel,
              
              // Custos
              ads_cost,
              team_cost,
              office_cost,
              total_cost,
              
              // Receitas e vendas A010
              a010_revenue,
              a010_sales,
              
              // Receitas Order Bumps
              ob_construir_revenue,
              ob_construir_sales,
              ob_vitalicio_revenue,
              ob_vitalicio_sales,
              ob_evento_revenue,
              ob_evento_sales,
              
              // Receitas Contrato
              contract_revenue,
              contract_sales,
              
              // Receitas Clint
              clint_revenue,
              incorporador_50k,
              ultrameta_clint,
              
              // Métricas importadas da planilha
              roi: parseNum(row['ROI']),
              roas: parseNum(row['ROAS']),
              cpl: parseNum(row['CPL']),
              cplr: parseNum(row['CPLR']),
              
              // Outros
              sdr_ia_ig,
              
              // Campos CALCULADOS
              total_revenue,
              real_cost,
              operating_profit,
              cir,
              ultrameta_liquido,
              
              // Funil - Etapa 01
              stage_01_target: parseInt(row['Meta Etapa 01']) || 0,
              stage_01_actual: parseInt(row['Etapa 01 - Novo Lead']) || 0,
              stage_01_rate: 100, // Sempre 100% na primeira etapa
              
              // Funil - Etapa 03
              stage_03_target: parseInt(row['Meta Etapa 03']) || 0,
              stage_03_actual: parseInt(row['Etapa 03 - Reunião 01 Agendada']) || 0,
              stage_03_rate: parseNum(row['%Etapa 03']),
              
              // Funil - Etapa 04
              stage_04_target: parseInt(row['Meta Etapa 04']) || 0,
              stage_04_actual: parseInt(row['Etapa 04 - Reunião 01 Realizada']) || 0,
              stage_04_rate: parseNum(row['%Etapa 04']),
              
              // Funil - Etapa 05
              stage_05_target: parseInt(row['Meta Etapa 05']) || 0,
              stage_05_actual: parseInt(row['Etapa 05 - Contrato Pago']) || 0,
              stage_05_rate: parseNum(row['%Etapa 05']),
              
              // Funil - Etapa 06 (sem meta)
              stage_06_target: 0,
              stage_06_actual: parseInt(row['Etapa 06 - Reunião 02 Realizada']) || 0,
              stage_06_rate: parseNum(row['%Etapa 06']),
              
              // Funil - Etapa 07 (sem meta)
              stage_07_target: 0,
              stage_07_actual: parseInt(row['Etapa 07 - Reunião 03 Realizada']) || 0,
              stage_07_rate: parseNum(row['%Etapa 07']),
              
              // Funil - Etapa 08 (sem meta)
              stage_08_target: 0,
              stage_08_actual: parseInt(row['Etapa 08 - Venda Realizada']) || 0,
              stage_08_rate: parseNum(row['%Etapa 08']),
              
              // Etapa 02 não existe na planilha, definir como 0
              stage_02_actual: 0,
              stage_02_target: 0,
              stage_02_rate: 0,
            };

            console.log('  ✓ Métrica processada:', { weekLabel, startDate, endDate });
            metrics.push(metric);
          }
        }
      }

      console.log(`Total de métricas processadas: ${metrics.length}`);

      setProgress(60);

      if (metrics.length === 0) {
        if (!metricsSheetFound) {
          throw new Error(
            `Aba "Resultado Semanal" não encontrada. Abas disponíveis: ${workbook.SheetNames.join(', ')}`
          );
        }
        throw new Error('Nenhuma métrica válida encontrada na aba (verifique se as colunas Data Inicio e Data Fim estão presentes)');
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

            {sheetsFound.length > 0 && (
              <Alert>
                <FileSpreadsheet className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-semibold mb-1">Abas encontradas no arquivo:</p>
                  <ul className="text-xs space-y-0.5">
                    {sheetsFound.map((sheet, idx) => (
                      <li key={idx}>• {sheet}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

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
                <h4 className="font-semibold text-foreground mb-1">Aba "Resultado Semanal"</h4>
                <p className="text-muted-foreground mb-2">
                  A planilha deve conter uma aba chamada "Resultado Semanal" (SINGULAR) com as seguintes colunas:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 text-xs">
                  <li>Data Inicio e Data Fim (formato DD/MM/YYYY)</li>
                  <li>Custo Ads (MAKE), Custo Equipe (PLANILHA MANUAL), Custo Escritório (PLANILHA MANUAL)</li>
                  <li>Faturado Curso A010, Vendas A010</li>
                  <li>Faturado Order Bumps: Construir Para Alugar, Acesso Vitalício, OB Evento</li>
                  <li>Faturado Contrato, Faturamento Clint, Faturamento Incorporador 50k</li>
                  <li>ROI, ROAS, CPL, CPLR</li>
                  <li>Ultrameta Clint, SDR IA+IG</li>
                  <li>Funil: Etapa 01 - Novo Lead, Etapa 03-08 com nomes completos</li>
                  <li>Meta Etapa 01, 03, 04, 05 e %Etapa 03-08</li>
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
