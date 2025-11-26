import { useState, useRef, ChangeEvent } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface BubbleRecord {
  clint_id: string;
  email_clint: string;
  tefone_clint: string;
  nome_clint: string;
  etapa_funil_clint: string;
  "Creation Date": string;
  valor_clint: string;
  dono_do_negocio_clint: string;
  closer: string;
  nota_clint: string;
  tag: string;
}

interface ImportStats {
  total: number;
  created: number;
  updated: number;
  preserved: number;
  activities_created: number;
  errors: string[];
}

export default function ImportarHistorico() {
  const [file, setFile] = useState<File | null>(null);
  const [records, setRecords] = useState<BubbleRecord[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<ImportStats | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCSV = (text: string): BubbleRecord[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const records: BubbleRecord[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      const record: any = {};
      headers.forEach((header, index) => {
        record[header] = values[index] || '';
      });
      records.push(record as BubbleRecord);
    }

    return records;
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      toast.error('Por favor, selecione um arquivo CSV');
      return;
    }

    setFile(selectedFile);
    setStats(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCSV(text);
      setRecords(parsed);
      toast.success(`${parsed.length} registros detectados no CSV`);
    };
    reader.readAsText(selectedFile);
  };

  const handleImport = async () => {
    if (!records.length) {
      toast.error('Nenhum registro para importar');
      return;
    }

    setImporting(true);
    setProgress(0);
    setStats(null);

    try {
      // Buscar origin_id do Clint CRM
      const { data: origins } = await supabase
        .from('crm_origins')
        .select('id')
        .eq('name', 'Clint CRM')
        .single();

      if (!origins) {
        toast.error('Origem "Clint CRM" não encontrada');
        setImporting(false);
        return;
      }

      const originId = origins.id;
      const batchSize = 100;
      const totalBatches = Math.ceil(records.length / batchSize);

      toast.info(`Iniciando importação em ${totalBatches} lotes...`);

      let allStats: ImportStats = {
        total: 0,
        created: 0,
        updated: 0,
        preserved: 0,
        activities_created: 0,
        errors: []
      };

      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        
        const { data, error } = await supabase.functions.invoke('import-bubble-history', {
          body: {
            origin_id: originId,
            records: batch
          }
        });

        if (error) {
          console.error('Erro no lote:', error);
          allStats.errors.push(`Erro no lote ${i / batchSize + 1}: ${error.message}`);
        } else if (data) {
          allStats.total += data.total || 0;
          allStats.created += data.created || 0;
          allStats.updated += data.updated || 0;
          allStats.preserved += data.preserved || 0;
          allStats.activities_created += data.activities_created || 0;
          if (data.errors?.length) {
            allStats.errors.push(...data.errors);
          }
        }

        const currentProgress = Math.round(((i + batch.length) / records.length) * 100);
        setProgress(currentProgress);
      }

      setStats(allStats);
      toast.success('Importação concluída!');
    } catch (error) {
      console.error('Erro na importação:', error);
      toast.error('Erro ao importar histórico');
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setRecords([]);
    setStats(null);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <History className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Importar Histórico Bubble</h1>
          <p className="text-muted-foreground">
            Importe o histórico completo de movimentações do Bubble para o CRM
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload do Arquivo CSV</CardTitle>
          <CardDescription>
            Selecione o arquivo CSV exportado do Bubble com o histórico de movimentações
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              file ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
          >
            <Input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={importing}
              className="hidden"
              id="csv-upload"
            />
            <label htmlFor="csv-upload" className="cursor-pointer">
              {file ? (
                <div className="flex flex-col items-center gap-3">
                  <FileText className="h-12 w-12 text-primary" />
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {records.length} registros detectados
                    </p>
                  </div>
                  {!importing && (
                    <Button variant="outline" size="sm" onClick={handleReset}>
                      Trocar arquivo
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <Upload className="h-12 w-12 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Clique para selecionar o arquivo CSV</p>
                    <p className="text-sm text-muted-foreground">
                      Formato esperado: clint_id, email_clint, telefone_clint, etc.
                    </p>
                  </div>
                </div>
              )}
            </label>
          </div>

          {/* Preview */}
          {records.length > 0 && !stats && (
            <div className="space-y-3">
              <h3 className="font-medium">Preview dos primeiros 5 registros:</h3>
              <div className="border rounded-lg overflow-auto max-h-64">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2 text-left">Nome</th>
                      <th className="p-2 text-left">Email</th>
                      <th className="p-2 text-left">Etapa</th>
                      <th className="p-2 text-left">Data</th>
                      <th className="p-2 text-left">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.slice(0, 5).map((record, index) => (
                      <tr key={index} className="border-t">
                        <td className="p-2">{record.nome_clint}</td>
                        <td className="p-2 text-xs">{record.email_clint}</td>
                        <td className="p-2 text-xs">{record.etapa_funil_clint}</td>
                        <td className="p-2 text-xs">{record['Creation Date']}</td>
                        <td className="p-2">R$ {record.valor_clint}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  A importação preservará negócios vindos de webhook e criará histórico completo em deal_activities
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Progress */}
          {importing && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Importando...</span>
                <span className="text-sm text-muted-foreground">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                Processando {records.length} registros em lotes de 100
              </p>
            </div>
          )}

          {/* Stats */}
          {stats && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <h3 className="font-semibold">Importação Concluída</h3>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{stats.total}</div>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-green-600">{stats.created}</div>
                    <p className="text-xs text-muted-foreground">Criados</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-blue-600">{stats.updated}</div>
                    <p className="text-xs text-muted-foreground">Atualizados</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-amber-600">{stats.preserved}</div>
                    <p className="text-xs text-muted-foreground">Preservados</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-purple-600">{stats.activities_created}</div>
                    <p className="text-xs text-muted-foreground">Atividades</p>
                  </CardContent>
                </Card>
              </div>

              {stats.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium mb-2">{stats.errors.length} erros encontrados:</p>
                    <ul className="text-xs space-y-1 max-h-32 overflow-auto">
                      {stats.errors.slice(0, 10).map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                      {stats.errors.length > 10 && (
                        <li className="font-medium">... e mais {stats.errors.length - 10} erros</li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <Button onClick={handleReset} variant="outline" className="w-full">
                Importar outro arquivo
              </Button>
            </div>
          )}

          {/* Actions */}
          {records.length > 0 && !stats && (
            <div className="flex gap-3">
              <Button
                onClick={handleImport}
                disabled={importing}
                className="flex-1"
              >
                {importing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Importar {records.length} registros
                  </>
                )}
              </Button>
              <Button
                onClick={handleReset}
                variant="outline"
                disabled={importing}
              >
                Cancelar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informações Importantes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
            <p>Negócios provenientes de webhook serão preservados sem alteração</p>
          </div>
          <div className="flex gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
            <p>Cada registro cria uma entrada em deal_activities para histórico completo</p>
          </div>
          <div className="flex gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
            <p>A data original do Bubble (Creation Date) é preservada no histórico</p>
          </div>
          <div className="flex gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
            <p>O funil CRM exibirá dados históricos corretamente após a importação</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
