import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CRMOverviewData } from '@/hooks/useCRMOverviewData';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  data: CRMOverviewData | undefined;
  isLoading: boolean;
}

interface Alert {
  level: 'critical' | 'warning' | 'info';
  message: string;
}

export function OperationalAlertsBlock({ data, isLoading }: Props) {
  if (isLoading) {
    return <Skeleton className="h-40 w-full rounded-lg" />;
  }

  if (!data) return null;

  const alerts: Alert[] = [];

  // Generate alerts from data
  if (data.kpis.leadsEsquecidos > 0) {
    alerts.push({
      level: data.kpis.leadsEsquecidos > 20 ? 'critical' : 'warning',
      message: `${data.kpis.leadsEsquecidos} leads sem movimentação há mais de 7 dias`,
    });
  }

  if (data.kpis.leadsSemOwner > 0) {
    alerts.push({
      level: data.kpis.leadsSemOwner > 10 ? 'critical' : 'warning',
      message: `${data.kpis.leadsSemOwner} leads sem owner atribuído`,
    });
  }

  if (data.health.leadsEnvelhecidos > 0) {
    alerts.push({
      level: 'critical',
      message: `${data.health.leadsEnvelhecidos} leads envelhecidos (7+ dias sem movimentação)`,
    });
  }

  // SDR alerts
  data.sdrRanking.forEach(sdr => {
    if (sdr.taxaAproveitamento < 30 && sdr.recebidos >= 5) {
      alerts.push({
        level: 'warning',
        message: `SDR "${sdr.sdrName}" com taxa de aproveitamento de ${sdr.taxaAproveitamento}%`,
      });
    }
    if (sdr.esquecidos > 10) {
      alerts.push({
        level: 'warning',
        message: `SDR "${sdr.sdrName}" com ${sdr.esquecidos} leads esquecidos`,
      });
    }
  });

  // Closer alerts
  data.closerRanking.forEach(closer => {
    const totalR1 = closer.r1Realizadas + closer.noShow;
    const noShowRate = totalR1 > 0 ? (closer.noShow / totalR1) * 100 : 0;
    if (noShowRate > 40 && totalR1 >= 3) {
      alerts.push({
        level: 'warning',
        message: `Closer "${closer.closerName}" com taxa de no-show de ${noShowRate.toFixed(0)}%`,
      });
    }
  });

  // Stalled stages
  data.health.travadosPorEtapa.forEach(item => {
    if (item.count > 10) {
      alerts.push({
        level: 'warning',
        message: `Etapa "${item.stageName}" com ${item.count} leads travados`,
      });
    }
  });

  if (alerts.length === 0) {
    alerts.push({ level: 'info', message: 'Nenhum alerta operacional no momento' });
  }

  const getIcon = (level: Alert['level']) => {
    switch (level) {
      case 'critical': return <AlertCircle className="h-4 w-4 text-destructive shrink-0" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-warning shrink-0" />;
      case 'info': return <Info className="h-4 w-4 text-muted-foreground shrink-0" />;
    }
  };

  const getBg = (level: Alert['level']) => {
    switch (level) {
      case 'critical': return 'bg-destructive/10 border-destructive/20';
      case 'warning': return 'bg-warning/10 border-warning/20';
      case 'info': return 'bg-muted border-border';
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-foreground flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          Alertas Operacionais
          {alerts.filter(a => a.level !== 'info').length > 0 && (
            <span className="text-xs bg-destructive/20 text-destructive rounded-full px-2 py-0.5 ml-2">
              {alerts.filter(a => a.level !== 'info').length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {alerts.map((alert, i) => (
            <div
              key={i}
              className={cn(
                "flex items-start gap-2.5 p-2.5 rounded-lg border text-sm",
                getBg(alert.level)
              )}
            >
              {getIcon(alert.level)}
              <span className="text-foreground">{alert.message}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
