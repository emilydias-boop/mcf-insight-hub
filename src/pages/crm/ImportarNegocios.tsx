import { useState, useEffect } from 'react';
import { Upload, FileText, CheckCircle, XCircle, AlertCircle, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface JobMetadata {
  file_name: string;
  file_path: string;
  total_deals: number;
  current_chunk?: number;
  total_chunks?: number;
  current_line?: number;
  total_lines?: number;
  errors?: any[];
}

interface JobStatus {
  id: string;
  status: string;
  total_processed: number | null;
  total_skipped: number | null;
  metadata: JobMetadata;
}

const ImportarNegocios = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [selectedOriginId, setSelectedOriginId] = useState<string | null>(null);

  // Buscar origens disponíveis
  const { data: origins, isLoading: originsLoading } = useQuery({
    queryKey: ['import-origins'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_origins')
        .select('id, name, display_name')
        .order('name');
      if (error) throw error;
      return data || [];
    }
  });

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
      setJobStatus(null);
      setJobId(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error('Selecione um arquivo CSV');
      return;
    }

    if (!selectedOriginId) {
      toast.error('Selecione uma pipeline de destino');
      return;
    }

    setIsImporting(true);
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('origin_id', selectedOriginId);

      const { data, error } = await supabase.functions.invoke('import-deals-csv', {
        body: formData,
      });

      if (error) throw error;

      if (data.success) {
        setJobId(data.jobId);
        toast.success(`Importação iniciada! ${data.totalDeals} deals serão processados em chunks.`);
      } else {
        throw new Error(data.error || 'Erro na importação');
      }
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || 'Erro ao importar negócios');
      setIsImporting(false);
    }
  };

  const cancelJob = async () => {
    if (!jobId) return;
    
    try {
      const { error } = await supabase
        .from('sync_jobs')
        .update({ 
          status: 'cancelled',
          completed_at: new Date().toISOString(),
          error_message: 'Cancelado manualmente pelo usuário'
        })
        .eq('id', jobId);
      
      if (error) throw error;
      
      toast.success('Importação cancelada com sucesso');
      setIsImporting(false);
      setJobStatus(null);
      setJobId(null);
      setFile(null);
      setProgress(0);
    } catch (error: any) {
      console.error('Erro ao cancelar job:', error);
      toast.error('Erro ao cancelar importação: ' + error.message);
    }
  };

  // Monitorar progresso do job
  useEffect(() => {
    if (!jobId) return;

    const interval = setInterval(async () => {
      try {
        const { data: job, error } = await supabase
          .from('sync_jobs')
          .select('id, status, total_processed, total_skipped, metadata')
          .eq('id', jobId)
          .single();

        if (error) throw error;
        if (!job) return;

        const metadata = job.metadata as unknown as JobMetadata;
        const jobWithMetadata = { ...job, metadata } as JobStatus;
        setJobStatus(jobWithMetadata);

        // Calcular progresso baseado nos chunks
        const currentChunk = metadata?.current_chunk || 0;
        const totalChunks = metadata?.total_chunks || 1;
        const progressPercent = Math.round((currentChunk / totalChunks) * 100);
        
        setProgress(progressPercent);

        // Parar polling quando completar ou falhar
        if (job.status === 'completed' || job.status === 'failed') {
          setIsImporting(false);
          clearInterval(interval);
          
          if (job.status === 'completed') {
            toast.success(`Importação concluída! ${job.total_processed || 0} deals importados.`);
          } else {
            toast.error('Erro na importação. Verifique os logs.');
          }
        }
      } catch (error) {
        console.error('Error polling job:', error);
      }
    }, 3000); // Poll a cada 3 segundos

    return () => clearInterval(interval);
  }, [jobId]);

  const downloadErrorLog = () => {
    if (!jobStatus?.metadata?.errors || jobStatus.metadata.errors.length === 0) return;

    const csvContent = [
      'Deal,Erro',
      ...jobStatus.metadata.errors.map((e: any) => `"${JSON.stringify(e.deal)}","${e.error}"`),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'erros-importacao-deals.csv';
    a.click();
    URL.revokeObjectURL(url);
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
            O arquivo será processado em chunks de 1.000 deals a cada 2 minutos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Formato esperado:</strong> CSV com colunas: id, name, value, stage, contact, owner, tags, etc.
              <br />
              <strong>Processamento incremental:</strong> 1.000 deals por chunk a cada 2 minutos (cron job)
              <br />
              <strong>Segurança:</strong> Deals protegidos por webhook não são sobrescritos
            </AlertDescription>
          </Alert>

          {/* Seletor de Pipeline */}
          <div className="space-y-2">
            <Label htmlFor="pipeline-select" className="text-sm font-medium">
              Pipeline de Destino <span className="text-destructive">*</span>
            </Label>
            <Select 
              value={selectedOriginId || ''} 
              onValueChange={(value) => setSelectedOriginId(value || null)}
              disabled={isImporting}
            >
              <SelectTrigger id="pipeline-select" className="w-full">
                <SelectValue placeholder={originsLoading ? "Carregando..." : "Selecione uma pipeline"} />
              </SelectTrigger>
              <SelectContent>
                {origins?.map(origin => (
                  <SelectItem key={origin.id} value={origin.id}>
                    {origin.display_name || origin.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Todos os deals importados serão associados a esta pipeline
            </p>
          </div>

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

          {isImporting && jobStatus && (
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Chunk {jobStatus.metadata?.current_chunk || 0}/{jobStatus.metadata?.total_chunks || 0} processado
                </span>
                <span className="font-medium text-foreground">{progress}%</span>
              </div>
              <Progress value={progress} />
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span>{jobStatus.total_processed || 0} processados</span>
                </div>
                {jobStatus.total_skipped && jobStatus.total_skipped > 0 && (
                  <div className="flex items-center gap-2 text-yellow-600">
                    <AlertCircle className="h-4 w-4" />
                    <span>{jobStatus.total_skipped} ignorados</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Próximo chunk será processado automaticamente pelo cron job
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleImport}
              disabled={!file || isImporting || !selectedOriginId}
              className="flex-1"
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                'Iniciar Importação'
              )}
            </Button>
            {isImporting && (
              <Button
                onClick={cancelJob}
                variant="destructive"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
            )}
            {file && !isImporting && (
              <Button
                variant="outline"
                onClick={() => {
                  setFile(null);
                  setJobStatus(null);
                  setJobId(null);
                }}
              >
                Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {jobStatus && jobStatus.status === 'completed' && !isImporting && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Importação Concluída
            </CardTitle>
            <CardDescription>
              Processados {jobStatus.metadata?.total_chunks || 0} chunk(s) de 1.000 deals cada
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {jobStatus.total_skipped && jobStatus.total_skipped > 0 && (
              <Alert className="border-yellow-500/50 bg-yellow-500/10">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                  <strong>{jobStatus.total_skipped} deals foram ignorados</strong> por falta de dados obrigatórios ou erros na conversão.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-foreground">{jobStatus.metadata?.total_lines || 0}</div>
                <div className="text-sm text-muted-foreground">Total no CSV</div>
              </div>
              <div className="text-center p-4 bg-green-500/10 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{jobStatus.total_processed || 0}</div>
                <div className="text-sm text-muted-foreground">Processados</div>
              </div>
              <div className="text-center p-4 bg-yellow-500/10 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{jobStatus.total_skipped || 0}</div>
                <div className="text-sm text-muted-foreground">Ignorados</div>
              </div>
            </div>

            {jobStatus.metadata?.errors && jobStatus.metadata.errors.length > 0 && (
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground">
                  {jobStatus.metadata.errors.length} erro(s) encontrado(s)
                </div>
                <Button variant="outline" size="sm" onClick={downloadErrorLog}>
                  <Download className="h-4 w-4 mr-2" />
                  Baixar Log de Erros
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ImportarNegocios;
