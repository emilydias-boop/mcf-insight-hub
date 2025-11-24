import { useState, useEffect } from 'react';
import { Upload, FileText, CheckCircle, XCircle, AlertCircle, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ImportStats {
  total: number;
  imported: number;
  updated: number;
  skipped: number;
  errors: number;
  duration_seconds: number;
  errorDetails?: Array<{ line: number; clint_id: string; error: string }>;
}

interface ChunkJob {
  id: string;
  status: string;
  total_processed: number | null;
  total_skipped: number | null;
  metadata: any;
}

interface AggregatedStats {
  totalDeals: number;
  totalImported: number;
  totalSkipped: number;
  totalErrors: number;
  completedChunks: number;
  totalChunks: number;
  currentChunk: number;
  allErrorDetails: Array<{ line: number; clint_id: string; error: string }>;
}

const ImportarNegocios = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [parentJobId, setParentJobId] = useState<string | null>(null);
  const [jobIds, setJobIds] = useState<string[]>([]);
  const [aggregatedStats, setAggregatedStats] = useState<AggregatedStats | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        toast.error('Por favor, selecione um arquivo CSV');
        return;
      }
      if (selectedFile.size > 50 * 1024 * 1024) {
        toast.error('Arquivo muito grande. Máximo: 50 MB');
        return;
      }
      setFile(selectedFile);
      setAggregatedStats(null);
      setParentJobId(null);
      setJobIds([]);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error('Selecione um arquivo CSV');
      return;
    }

    setIsImporting(true);
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const { data, error } = await supabase.functions.invoke('import-deals-csv', {
        body: formData,
      });

      if (error) throw error;

      if (data.success) {
        setParentJobId(data.parent_job_id);
        setJobIds(data.job_ids);
        toast.success(`Importação iniciada! ${data.total_chunks} chunk(s) de ${data.total_deals} deals sendo processados em background.`);
      } else {
        throw new Error(data.error || 'Erro na importação');
      }
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || 'Erro ao importar negócios');
      setIsImporting(false);
    }
  };

  // Monitorar progresso dos jobs
  useEffect(() => {
    if (!jobIds.length) return;

    const interval = setInterval(async () => {
      try {
        const { data: jobs, error } = await supabase
          .from('sync_jobs')
          .select('id, status, total_processed, total_skipped, metadata')
          .in('id', jobIds);

        if (error) throw error;

        const chunkJobs = jobs as ChunkJob[];
        
        const completed = chunkJobs.filter(j => j.status === 'completed' || j.status === 'failed').length;
        const totalChunks = chunkJobs.length;
        const progressPercent = Math.round((completed / totalChunks) * 100);
        
        setProgress(progressPercent);

        // Calcular estatísticas agregadas
        let totalImported = 0;
        let totalSkipped = 0;
        let totalErrors = 0;
        let totalDeals = 0;
        let currentChunk = 0;
        const allErrorDetails: Array<{ line: number; clint_id: string; error: string }> = [];

        chunkJobs.forEach((job, idx) => {
          totalImported += job.metadata?.imported || job.total_processed || 0;
          totalSkipped += job.metadata?.skipped || 0;
          totalErrors += job.metadata?.errors || 0;
          totalDeals += job.metadata?.stats?.total || 0;
          
          if (job.status === 'processing') {
            currentChunk = idx + 1;
          }
          
          if (job.metadata?.errorDetails) {
            allErrorDetails.push(...job.metadata.errorDetails);
          }
        });

        setAggregatedStats({
          totalDeals,
          totalImported,
          totalSkipped,
          totalErrors,
          completedChunks: completed,
          totalChunks,
          currentChunk: currentChunk || completed,
          allErrorDetails,
        });

        // Parar polling quando todos completarem
        if (completed === totalChunks) {
          setIsImporting(false);
          clearInterval(interval);
          toast.success(`Importação concluída! ${totalImported} deals importados.`);
        }
      } catch (error) {
        console.error('Error polling jobs:', error);
      }
    }, 2000); // Poll a cada 2 segundos

    return () => clearInterval(interval);
  }, [jobIds]);

  const downloadErrorLog = () => {
    if (!aggregatedStats?.allErrorDetails || aggregatedStats.allErrorDetails.length === 0) return;

    const csvContent = [
      'Linha,Clint ID,Erro',
      ...aggregatedStats.allErrorDetails.map(e => `${e.line},"${e.clint_id}","${e.error}"`),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'erros-importacao-deals.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}min ${secs}s` : `${secs}s`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Importar Negócios</h2>
        <p className="text-muted-foreground mt-1">
          Importe negócios em lote para o PIPELINE INSIDE SALES via arquivo CSV
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload do Arquivo CSV</CardTitle>
          <CardDescription>
            O arquivo será processado em chunks de 5.000 deals para garantir estabilidade
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Formato esperado:</strong> CSV exportado do Clint CRM com colunas: id, name, email, phone, stage, origin, value, user_email, tags, etc.
              <br />
              <strong>Destino:</strong> Todos os deals serão importados para <span className="font-semibold">PIPELINE INSIDE SALES</span>
              <br />
              <strong>Processamento:</strong> Arquivos grandes são divididos em chunks de 5.000 deals processados em sequência. Não interfere com o webhook.
            </AlertDescription>
          </Alert>

          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
              id="csv-upload"
              disabled={isImporting}
            />
            <label
              htmlFor="csv-upload"
              className="cursor-pointer flex flex-col items-center gap-4"
            >
              {file ? (
                <>
                  <FileText className="h-12 w-12 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <Upload className="h-12 w-12 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-foreground">
                      Clique para selecionar um arquivo CSV
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Máximo: 50 MB
                    </p>
                  </div>
                </>
              )}
            </label>
          </div>

          {isImporting && aggregatedStats && (
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Chunk {aggregatedStats.currentChunk}/{aggregatedStats.totalChunks} em progresso...
                </span>
                <span className="font-medium text-foreground">{progress}%</span>
              </div>
              <Progress value={progress} />
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span>{aggregatedStats.totalImported} importados</span>
                </div>
                {aggregatedStats.totalSkipped > 0 && (
                  <div className="flex items-center gap-2 text-yellow-600">
                    <AlertCircle className="h-4 w-4" />
                    <span>{aggregatedStats.totalSkipped} protegidos</span>
                  </div>
                )}
                {aggregatedStats.totalErrors > 0 && (
                  <div className="flex items-center gap-2 text-red-600">
                    <XCircle className="h-4 w-4" />
                    <span>{aggregatedStats.totalErrors} erros</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleImport}
              disabled={!file || isImporting}
              className="flex-1"
            >
              {isImporting ? 'Processando...' : 'Iniciar Importação'}
            </Button>
            {file && !isImporting && (
              <Button
                variant="outline"
                onClick={() => {
                  setFile(null);
                  setAggregatedStats(null);
                  setParentJobId(null);
                  setJobIds([]);
                }}
              >
                Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {aggregatedStats && !isImporting && aggregatedStats.completedChunks === aggregatedStats.totalChunks && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Importação Concluída
            </CardTitle>
            <CardDescription>
              Processados {aggregatedStats.totalChunks} chunk(s) de 5.000 deals cada
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {aggregatedStats.totalSkipped > 0 && (
              <Alert className="border-yellow-500/50 bg-yellow-500/10">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                  <strong>{aggregatedStats.totalSkipped} deals foram protegidos</strong> porque já existem com dados mais recentes vindos do webhook (ao vivo). Isso evita sobrescrever dados atualizados.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-foreground">{aggregatedStats.totalDeals}</div>
                <div className="text-sm text-muted-foreground">Total Processado</div>
              </div>
              <div className="text-center p-4 bg-green-500/10 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{aggregatedStats.totalImported}</div>
                <div className="text-sm text-muted-foreground">Importados</div>
              </div>
              <div className="text-center p-4 bg-yellow-500/10 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{aggregatedStats.totalSkipped}</div>
                <div className="text-sm text-muted-foreground">Protegidos</div>
              </div>
              <div className="text-center p-4 bg-blue-500/10 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{aggregatedStats.totalChunks}</div>
                <div className="text-sm text-muted-foreground">Chunks</div>
              </div>
              <div className="text-center p-4 bg-red-500/10 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{aggregatedStats.totalErrors}</div>
                <div className="text-sm text-muted-foreground">Erros</div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">
                Processamento concluído com sucesso
              </div>
              {aggregatedStats.allErrorDetails && aggregatedStats.allErrorDetails.length > 0 && (
                <Button variant="outline" size="sm" onClick={downloadErrorLog}>
                  <Download className="h-4 w-4 mr-2" />
                  Baixar Log de Erros ({aggregatedStats.allErrorDetails.length})
                </Button>
              )}
            </div>

            {aggregatedStats.totalErrors > 0 && aggregatedStats.allErrorDetails && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  {aggregatedStats.totalErrors} deal(s) não puderam ser importados. Baixe o log de erros para mais detalhes.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ImportarNegocios;
