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
    // Estimativa baseada em 100k+ contatos = 500+ páginas (200 contatos/página)
    const estimatedTotalPages = 500;
    if (job.job_type === 'contacts') {
      return Math.min((job.last_page / estimatedTotalPages) * 100, 100);
    }
    if (job.job_type === 'deals') {
      return Math.min((job.last_page / estimatedTotalPages) * 100, 100);
    }
    return 0;
  };

  const calculateStats = (job: SyncJob) => {
    if (!job.started_at) return null;
    
    const startTime = new Date(job.started_at).getTime();
    const currentTime = job.completed_at ? new Date(job.completed_at).getTime() : Date.now();
    const elapsedMinutes = (currentTime - startTime) / 60000;
    
    if (elapsedMinutes < 0.1) return null; // Muito cedo para estatísticas
    
    const contactsPerMin = Math.round(job.total_processed / elapsedMinutes);
    
    // Estimar tempo restante baseado em 100k contatos totais
    const estimatedTotal = 100000;
    const remaining = Math.max(0, estimatedTotal - job.total_processed);
    const etaMinutes = contactsPerMin > 0 ? Math.round(remaining / contactsPerMin) : null;
    
    return { contactsPerMin, etaMinutes, elapsedMinutes: Math.round(elapsedMinutes) };
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
              const stats = calculateStats(job);

              return (
                <div key={job.id} className="space-y-3 p-4 border rounded-lg bg-card">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${job.status === 'running' ? 'animate-spin' : ''}`} />
                      <span className="font-medium">{jobTypeLabels[job.job_type]}</span>
                    </div>
                    <Badge variant={config.variant}>{config.label}</Badge>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>{progress.toFixed(0)}% completo</span>
                      {stats?.etaMinutes && job.status === 'running' && (
                        <span className="font-medium text-primary">
                          ETA: ~{stats.etaMinutes}min
                        </span>
                      )}
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="text-muted-foreground">Processados</div>
                      <div className="font-medium">{job.total_processed.toLocaleString()} contatos</div>
                    </div>
                    {stats && (
                      <div className="space-y-1">
                        <div className="text-muted-foreground">Velocidade</div>
                        <div className="font-medium text-green-600">{stats.contactsPerMin.toLocaleString()}/min</div>
                      </div>
                    )}
                    <div className="space-y-1">
                      <div className="text-muted-foreground">Página atual</div>
                      <div className="font-medium">{job.last_page} / ~500</div>
                    </div>
                    {stats && (
                      <div className="space-y-1">
                        <div className="text-muted-foreground">Tempo decorrido</div>
                        <div className="font-medium">{stats.elapsedMinutes}min</div>
                      </div>
                    )}
                  </div>

                  {job.updated_at && (
                    <p className="text-xs text-muted-foreground pt-2 border-t">
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
