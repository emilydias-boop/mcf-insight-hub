import { KPICard } from '@/components/ui/KPICard';
import { Skeleton } from '@/components/ui/skeleton';
import { OverviewKPIData } from '@/hooks/useCRMOverviewData';
import { Users, Zap, TrendingUp, TrendingDown, Clock, Ghost, UserX } from 'lucide-react';

interface Props {
  data: OverviewKPIData | undefined;
  isLoading: boolean;
}

export function OverviewKPIs({ data, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const items = [
    { title: 'Entraram', value: String(data?.leadsEntraram ?? 0), icon: Users, variant: 'neutral' as const },
    { title: 'Trabalhados', value: String(data?.leadsTrabalhados ?? 0), icon: Zap, variant: 'success' as const },
    { title: 'Avançados', value: String(data?.leadsAvancados ?? 0), icon: TrendingUp, variant: 'success' as const },
    { title: 'Perdidos', value: String(data?.leadsPerdidos ?? 0), icon: TrendingDown, variant: 'danger' as const },
    { title: 'Sem Movimentação', value: String(data?.leadsSemMovimentacao ?? 0), icon: Clock, variant: 'danger' as const },
    { title: 'Esquecidos', value: String(data?.leadsEsquecidos ?? 0), icon: Ghost, variant: 'danger' as const },
    { title: 'Sem Owner', value: String(data?.leadsSemOwner ?? 0), icon: UserX, variant: 'danger' as const },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {items.map(item => (
        <KPICard
          key={item.title}
          title={item.title}
          value={item.value}
          icon={item.icon}
          variant={item.variant}
          compact
        />
      ))}
    </div>
  );
}
