import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Clock, CheckCircle2, AlertCircle, Loader2, Pause } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SyncJob {
  id: string;
  job_type: string;
  status: string;
  last_page: number;
  total_processed: number;
  total_skipped: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  metadata: any;
  updated_at: string;
}

const jobTypeLabels: Record<string, string> = {
  contacts: 'Contatos',
  deals: 'Negócios',
  origins_stages: 'Origens e Estágios',
  link_contacts: 'Vincular Contatos'
};

const statusConfig = {
  running: { label: 'Em execução', icon: Loader2, color: 'bg-blue-500', variant: 'default' as const },
  completed: { label: 'Concluído', icon: CheckCircle2, color: 'bg-green-500', variant: 'default' as const },
  failed: { label: 'Falhou', icon: AlertCircle, color: 'bg-destructive', variant: 'destructive' as const },
  pending: { label: 'Pendente', icon: Clock, color: 'bg-muted', variant: 'secondary' as const },
  paused: { label: 'Pausado', icon: Pause, color: 'bg-yellow-500', variant: 'secondary' as const }
};

export function SyncMonitor() {
  const { data: jobs, isLoading } = useQuery({
    queryKey: ['sync-jobs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sync_jobs')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data as SyncJob[];
    },
    refetchInterval: 5000 // Atualizar a cada 5 segundos
  });

  const estimateProgress = (job: SyncJob) => {
    // Estimativa baseada em ~117 páginas totais (23.400 contatos / 200 por página)
    const estimatedTotalPages = 117;
    if (job.job_type === 'contacts') {
      return Math.min((job.last_page / estimatedTotalPages) * 100, 100);
    }
    // Para deals, estimativa similar
    if (job.job_type === 'deals') {
      return Math.min((job.last_page / 100) * 100, 100);
    }
    return 0;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Monitor de Sincronização</CardTitle>
          <CardDescription>Carregando status...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const activeJobs = jobs?.filter(j => j.status === 'running' || j.status === 'paused') || [];
  const recentJobs = jobs?.slice(0, 5) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monitor de Sincronização Automática</CardTitle>
        <CardDescription>
          Sincronizações executadas via cron job a cada 5-10 minutos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {activeJobs.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Sincronizações Ativas</h3>
            {activeJobs.map((job) => {
              const config = statusConfig[job.status as keyof typeof statusConfig];
              const Icon = config.icon;
              const progress = estimateProgress(job);

              return (
                <div key={job.id} className="space-y-2 p-4 border rounded-lg bg-card">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${job.status === 'running' ? 'animate-spin' : ''}`} />
                      <span className="font-medium">{jobTypeLabels[job.job_type]}</span>
                    </div>
                    <Badge variant={config.variant}>{config.label}</Badge>
                  </div>
                  
                  <Progress value={progress} className="h-2" />
                  
                  <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <div>
                      <span className="font-medium">Processados:</span> {job.total_processed.toLocaleString()}
                    </div>
                    <div>
                      <span className="font-medium">Página:</span> {job.last_page}
                    </div>
                    <div>
                      <span className="font-medium">Progresso:</span> {progress.toFixed(0)}%
                    </div>
                  </div>

                  {job.updated_at && (
                    <p className="text-xs text-muted-foreground">
                      Última atualização: {formatDistanceToNow(new Date(job.updated_at), { 
                        addSuffix: true, 
                        locale: ptBR 
                      })}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Histórico Recente</h3>
          <div className="space-y-2">
            {recentJobs.map((job) => {
              const config = statusConfig[job.status as keyof typeof statusConfig];
              const Icon = config.icon;

              return (
                <div key={job.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`h-2 w-2 rounded-full ${config.color}`} />
                    <div>
                      <p className="text-sm font-medium">{jobTypeLabels[job.job_type]}</p>
                      <p className="text-xs text-muted-foreground">
                        {job.total_processed.toLocaleString()} processados
                        {job.total_skipped > 0 && ` • ${job.total_skipped} ignorados`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={config.variant} className="gap-1">
                      <Icon className="h-3 w-3" />
                      {config.label}
                    </Badge>
                    {job.completed_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(job.completed_at), { 
                          addSuffix: true, 
                          locale: ptBR 
                        })}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {(!jobs || jobs.length === 0) && (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nenhuma sincronização encontrada</p>
            <p className="text-xs mt-1">As sincronizações automáticas acontecerão em breve</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
