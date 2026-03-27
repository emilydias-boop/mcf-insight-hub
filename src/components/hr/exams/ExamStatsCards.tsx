import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipboardList, Users, Calendar, TrendingUp, ArrowUp, ArrowDown, Percent } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAllExamStats } from '@/hooks/useExamStats';

export default function ExamStatsCards() {
  const { data: stats } = useAllExamStats();

  const cards = [
    {
      title: 'Total de Provas',
      value: stats?.totalExams ?? 0,
      icon: ClipboardList,
    },
    {
      title: 'Total de Avaliações',
      value: stats?.totalScores ?? 0,
      icon: Users,
    },
    {
      title: 'Última Prova',
      value: stats?.lastExamDate
        ? format(new Date(stats.lastExamDate), 'dd/MM', { locale: ptBR })
        : '-',
      icon: Calendar,
    },
    {
      title: 'Média Geral',
      value: stats?.overallAverage != null ? stats.overallAverage.toFixed(1) : '-',
      icon: TrendingUp,
    },
    {
      title: 'Maior Nota',
      value: stats?.highestScore != null ? stats.highestScore.toFixed(1) : '-',
      icon: ArrowUp,
    },
    {
      title: 'Menor Nota',
      value: stats?.lowestScore != null ? stats.lowestScore.toFixed(1) : '-',
      icon: ArrowDown,
    },
    {
      title: 'Taxa de Participação',
      value: stats?.participationRate != null ? `${stats.participationRate.toFixed(0)}%` : '-',
      icon: Percent,
    },
  ];

  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
