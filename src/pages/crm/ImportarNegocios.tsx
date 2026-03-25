import { useState, useEffect } from 'react';
import { Upload, FileText, CheckCircle, XCircle, AlertCircle, Download, Loader2, ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { useActiveBU } from '@/hooks/useActiveBU';
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
  const activeBU = useActiveBU();
  const buKey = activeBU?.slug || 'incorporador';

  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [selectedOriginId, setSelectedOriginId] = useState<string | null>(null);
  const [selectedOwnerEmail, setSelectedOwnerEmail] = useState<string | null>(null);
  const [selectedOwnerProfileId, setSelectedOwnerProfileId] = useState<string | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  // Buscar origens filtradas pela BU ativa via bu_origin_mapping
  const { data: origins, isLoading: originsLoading } = useQuery({
    queryKey: ['import-origins', buKey],
    queryFn: async () => {
      // 1. Buscar mapeamentos da BU ativa
      const { data: mappings, error: mappingError } = await supabase
        .from('bu_origin_mapping')
        .select('entity_type, entity_id, is_default')
        .eq('bu', buKey);
      if (mappingError) throw mappingError;

      const directOriginIds = (mappings || [])
        .filter(m => m.entity_type === 'origin')
        .map(m => m.entity_id);
      const groupIds = (mappings || [])
        .filter(m => m.entity_type === 'group')
        .map(m => m.entity_id);
      const defaultOriginId = (mappings || [])
        .find(m => m.entity_type === 'origin' && m.is_default)?.entity_id || null;

      // 2. Buscar origens filhas dos grupos
      let childOriginIds: string[] = [];
      if (groupIds.length > 0) {
        const { data: childOrigins } = await supabase
          .from('crm_origins')
          .select('id')
          .in('group_id', groupIds);
        childOriginIds = childOrigins?.map(o => o.id) || [];
      }

      // 3. Combinar IDs únicos
      const allOriginIds = [...new Set([...directOriginIds, ...childOriginIds])];

      // 4. Buscar dados das origens
      const { data: originsData, error: originsError } = await supabase
        .from('crm_origins')
        .select('id, name, display_name')
        .in('id', allOriginIds)
        .order('name');
      if (originsError) throw originsError;

      return { origins: originsData || [], defaultOriginId };
    }
  });

  // Auto-selecionar a origin padrão quando os dados carregarem
  useEffect(() => {
    if (origins?.defaultOriginId && !selectedOriginId) {
      setSelectedOriginId(origins.defaultOriginId);
    }
  }, [origins?.defaultOriginId]);

  // Resetar estágio quando pipeline mudar
  useEffect(() => {
    setSelectedStageId(null);
  }, [selectedOriginId]);

  // Buscar estágios da pipeline selecionada
  const { data: stagesForOrigin } = useQuery({
    queryKey: ['stages-for-origin', selectedOriginId],
    enabled: !!selectedOriginId,
    queryFn: async () => {
      const { data } = await supabase
        .from('local_pipeline_stages')
        .select('id, name')
        .eq('origin_id', selectedOriginId!)
        .eq('is_active', true)
        .order('stage_order');
      return data || [];
    }
  });

  // Buscar usuários ativos para atribuição
  const { data: activeUsers, isLoading: usersLoading } = useQuery({
    queryKey: ['active-users-for-import'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email')
        .order('email');
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
      if (selectedOwnerEmail) {
        formData.append('owner_email', selectedOwnerEmail);
      }
      if (selectedOwnerProfileId) {
        formData.append('owner_profile_id', selectedOwnerProfileId);
      }
      if (selectedStageId) {
        formData.append('default_stage_id', selectedStageId);
      }

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

        // Calcular progresso com fallback para total_processed/total_deals
        const currentChunk = metadata?.current_chunk || 0;
        const totalChunks = metadata?.total_chunks || 1;
        const processedDeals = job.total_processed || 0;
        const totalDeals = metadata?.total_deals || 1;
        const progressPercent = totalChunks > 1
          ? Math.round((currentChunk / totalChunks) * 100)
          : Math.round((processedDeals / totalDeals) * 100);
        
        setProgress(progressPercent);

        // Parar polling quando completar, falhar ou cancelar
        if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
          setProgress(100);
          setIsImporting(false);
          clearInterval(interval);
          
          if (job.status === 'completed') {
            toast.success(`Importação concluída! ${job.total_processed || 0} deals importados.`);
          } else if (job.status === 'cancelled') {
            toast.info('Importação cancelada.');
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
              <strong>Processamento incremental:</strong> 1.000 deals por chunk a cada 2 minutos (cron job)
              <br />
              <strong>Segurança:</strong> Deals protegidos por webhook não são sobrescritos
            </AlertDescription>
          </Alert>

          {/* Guia de colunas CSV */}
          <Collapsible open={guideOpen} onOpenChange={setGuideOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full">
              <ChevronDown className={`h-4 w-4 transition-transform ${guideOpen ? 'rotate-180' : ''}`} />
              Guia de colunas do CSV
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 rounded-lg border bg-muted/40 p-4">
                <p className="text-xs text-muted-foreground mb-3">Colunas reconhecidas pelo importador:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {[
                    { col: 'id', desc: 'ID único do deal (evita duplicatas)' },
                    { col: 'name', desc: 'Nome do negócio (obrigatório)' },
                    { col: 'value', desc: 'Valor do negócio (número)' },
                    { col: 'stage', desc: 'Nome do estágio (ex: Novo Lead)' },
                    { col: 'owner / user_email', desc: 'E-mail do responsável' },
                    { col: 'contact', desc: 'Nome do contato' },
                    { col: 'email', desc: 'E-mail do contato' },
                    { col: 'phone', desc: 'Telefone do contato' },
                    { col: 'tags', desc: 'Tags separadas por vírgula' },
                    { col: 'created_at', desc: 'Data de criação original (ISO 8601)' },
                  ].map(({ col, desc }) => (
                    <div key={col} className="flex gap-2">
                      <code className="bg-background border rounded px-1.5 py-0.5 font-mono shrink-0">{col}</code>
                      <span className="text-muted-foreground">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

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
                {origins?.origins?.map(origin => (
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

          {/* Seletor de Estágio Padrão */}
          <div className="space-y-2">
            <Label htmlFor="stage-select" className="text-sm font-medium">
              Estágio padrão (opcional)
            </Label>
            <Select
              value={selectedStageId || ''}
              onValueChange={(value) => setSelectedStageId(value || null)}
              disabled={isImporting || !selectedOriginId}
            >
              <SelectTrigger id="stage-select" className="w-full">
                <SelectValue placeholder={!selectedOriginId ? "Selecione uma pipeline primeiro" : "Selecione um estágio padrão"} />
              </SelectTrigger>
              <SelectContent>
                {stagesForOrigin?.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Usado quando o CSV não tem coluna "stage". Se vazio, deals entram sem estágio.
            </p>
          </div>

          {/* Seletor de SDR/Responsável */}
          <div className="space-y-2">
            <Label htmlFor="owner-select" className="text-sm font-medium">
              Atribuir a (opcional)
            </Label>
            <Select 
              value={selectedOwnerProfileId || ''} 
              onValueChange={(value) => {
                const user = activeUsers?.find(u => u.id === value);
                setSelectedOwnerProfileId(value || null);
                setSelectedOwnerEmail(user?.email || null);
              }}
              disabled={isImporting}
            >
              <SelectTrigger id="owner-select" className="w-full">
                <SelectValue placeholder={usersLoading ? "Carregando..." : "Selecione um responsável"} />
              </SelectTrigger>
              <SelectContent>
                {activeUsers?.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Se vazio, os leads serão distribuídos automaticamente via rodízio (se configurado na pipeline)
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
