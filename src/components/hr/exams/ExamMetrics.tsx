import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy } from 'lucide-react';
import { ExamScore } from '@/hooks/useExams';

interface ExamMetricsProps {
  scores: ExamScore[];
}

function getNotaBadgeVariant(nota: number): 'default' | 'secondary' | 'destructive' {
  if (nota >= 7) return 'default';
  if (nota >= 5) return 'secondary';
  return 'destructive';
}

function groupAverage(scores: ExamScore[], groupBy: (s: ExamScore) => string | null): { group: string; avg: number; count: number }[] {
  const map = new Map<string, number[]>();
  scores.forEach(s => {
    const key = groupBy(s) || 'Não definido';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(Number(s.nota));
  });
  return Array.from(map.entries())
    .map(([group, notas]) => ({
      group,
      avg: notas.reduce((a, b) => a + b, 0) / notas.length,
      count: notas.length,
    }))
    .sort((a, b) => b.avg - a.avg);
}

export default function ExamMetrics({ scores }: ExamMetricsProps) {
  if (scores.length === 0) return null;

  const byCargo = groupAverage(scores, s => s.employee?.cargo || null);
  const bySquad = groupAverage(scores, s => s.employee?.squad || null);
  const ranking = [...scores]
    .sort((a, b) => Number(b.nota) - Number(a.nota))
    .map((s, i) => ({ ...s, position: i + 1 }));

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {/* Média por Cargo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Média por Cargo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {byCargo.map(item => (
            <div key={item.group} className="flex items-center justify-between">
              <span className="text-sm truncate flex-1">{item.group}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{item.count}p</span>
                <Badge variant={getNotaBadgeVariant(item.avg)}>{item.avg.toFixed(1)}</Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Média por Squad */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Média por Squad</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {bySquad.map(item => (
            <div key={item.group} className="flex items-center justify-between">
              <span className="text-sm truncate flex-1">{item.group}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{item.count}p</span>
                <Badge variant={getNotaBadgeVariant(item.avg)}>{item.avg.toFixed(1)}</Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Ranking */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            Ranking
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {ranking.slice(0, 10).map(s => (
            <div key={s.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold w-6 ${s.position <= 3 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                  {s.position}º
                </span>
                <span className="text-sm truncate max-w-[120px]">
                  {s.employee?.nome_completo || 'N/A'}
                </span>
              </div>
              <Badge variant={getNotaBadgeVariant(Number(s.nota))}>{Number(s.nota).toFixed(1)}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
