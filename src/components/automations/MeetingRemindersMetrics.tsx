import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useMeetingRemindersMetrics } from '@/hooks/useMeetingRemindersMetrics';
import { CheckCircle2, XCircle, MinusCircle } from 'lucide-react';

function StatCard({ label, bucket }: { label: string; bucket: { sent: number; skipped: number; failed: number; total: number } }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{bucket.total}</div>
        <div className="flex gap-3 mt-2 text-xs">
          <span className="flex items-center gap-1 text-success">
            <CheckCircle2 className="h-3 w-3" /> {bucket.sent}
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <MinusCircle className="h-3 w-3" /> {bucket.skipped}
          </span>
          <span className="flex items-center gap-1 text-destructive">
            <XCircle className="h-3 w-3" /> {bucket.failed}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function MeetingRemindersMetrics() {
  const { data, isLoading } = useMeetingRemindersMetrics();

  if (isLoading || !data) {
    return <div className="text-sm text-muted-foreground">Carregando métricas...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard label="Últimas 24h" bucket={data.last24h} />
        <StatCard label="Últimos 7 dias" bucket={data.last7d} />
        <StatCard label="Últimos 30 dias" bucket={data.last30d} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Por offset (30 dias)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {['d-1', 'h-4', 'h-2', 'h-1', 'm-20', 'm-0'].map(k => {
              const b = data.byOffset[k] ?? { sent: 0, skipped: 0, failed: 0, total: 0 };
              return (
                <div key={k} className="border rounded-md p-3">
                  <div className="text-xs text-muted-foreground">{k}</div>
                  <div className="text-lg font-semibold">{b.total}</div>
                  <div className="flex gap-2 mt-1 text-xs">
                    <Badge variant="outline" className="text-success border-success/40">{b.sent}</Badge>
                    <Badge variant="outline">{b.skipped}</Badge>
                    {b.failed > 0 && <Badge variant="destructive">{b.failed}</Badge>}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
