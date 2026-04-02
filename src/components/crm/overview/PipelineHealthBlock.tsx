import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { PipelineHealthData } from '@/hooks/useCRMOverviewData';
import { Activity, AlertTriangle, TrendingUp, UserCheck, UserX, ArrowUpRight } from 'lucide-react';

interface Props {
  data: PipelineHealthData | undefined;
  isLoading: boolean;
}

export function PipelineHealthBlock({ data, isLoading }: Props) {
  if (isLoading) {
    return <Skeleton className="h-64 w-full rounded-lg" />;
  }

  if (!data) return null;

  const formatTempo = (hours: number) => {
    if (hours < 24) return `${hours}h`;
    const days = Math.round(hours / 24);
    return `${days}d`;
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-foreground flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Saúde da Pipeline
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Period Flow */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">No período</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-2 rounded-md bg-muted/50">
              <p className="text-2xl font-bold text-foreground">{data.entaramNoPeriodo}</p>
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <TrendingUp className="h-3 w-3" /> Entraram
              </p>
            </div>
            <div className="text-center p-2 rounded-md bg-muted/50">
              <p className="text-2xl font-bold text-primary">{data.trabalhadosNoPeriodo}</p>
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <UserCheck className="h-3 w-3" /> Já trabalhados
              </p>
            </div>
            <div className="text-center p-2 rounded-md bg-muted/50">
              <p className="text-2xl font-bold text-warning">{data.semToqueNoPeriodo}</p>
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <UserX className="h-3 w-3" /> Sem toque
              </p>
            </div>
            <div className="text-center p-2 rounded-md bg-muted/50">
              <p className="text-2xl font-bold text-accent-foreground">{data.avancadosNoPeriodo}</p>
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <ArrowUpRight className="h-3 w-3" /> Avançados
              </p>
            </div>
          </div>
        </div>

        {/* General Health (90d) */}
        <div className="border-t border-border pt-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Saúde geral (últimos 90 dias)</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{data.totalAbertos}</p>
              <p className="text-xs text-muted-foreground">Abertos</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-warning">{data.leadsParados}</p>
              <p className="text-xs text-muted-foreground">Parados (3d+)</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-destructive">{data.leadsEnvelhecidos}</p>
              <p className="text-xs text-muted-foreground">Envelhecidos (7d+)</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{formatTempo(data.tempoMedioSemMovHoras)}</p>
              <p className="text-xs text-muted-foreground">Tempo Médio s/ Mov.</p>
            </div>
          </div>
        </div>

        {data.travadosPorEtapa.length > 0 && (
          <div className="border-t border-border pt-3">
            <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Travados por Etapa
            </p>
            <div className="flex flex-wrap gap-2">
              {data.travadosPorEtapa.map(item => (
                <Badge key={item.stageName} variant="secondary" className="text-xs">
                  {item.stageName}: <span className="font-bold ml-1">{item.count}</span>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
