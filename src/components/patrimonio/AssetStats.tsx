import { Card, CardContent } from '@/components/ui/card';
import { useAssetStats } from '@/hooks/useAssets';
import { Package, Monitor, Wrench, Archive, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export const AssetStats = () => {
  const { data: stats, isLoading } = useAssetStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-4 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const statCards = [
    { label: 'Total', value: stats?.total ?? 0, icon: Package, color: 'text-primary' },
    { label: 'Em Estoque', value: stats?.em_estoque ?? 0, icon: Archive, color: 'text-green-500' },
    { label: 'Em Uso', value: stats?.em_uso ?? 0, icon: Monitor, color: 'text-blue-500' },
    { label: 'Manutenção', value: stats?.em_manutencao ?? 0, icon: Wrench, color: 'text-yellow-500' },
    { label: 'Devolvido', value: stats?.devolvido ?? 0, icon: Archive, color: 'text-gray-500' },
    { label: 'Baixado', value: stats?.baixado ?? 0, icon: Trash2, color: 'text-red-500' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {statCards.map((stat) => (
        <Card key={stat.label} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
              <stat.icon className={`h-8 w-8 ${stat.color} opacity-50`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
