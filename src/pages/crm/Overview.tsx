import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Briefcase, MapPin, TrendingUp, DollarSign, CheckCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/formatters';

const Overview = () => {
  // Estatísticas agregadas com COUNT (eficiente)
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['crm-overview-stats'],
    queryFn: async () => {
      const [
        { count: totalContacts },
        { count: totalDeals },
        { count: totalOrigins },
        { data: pipelineData },
        { data: wonDealsData }
      ] = await Promise.all([
        supabase.from('crm_contacts').select('*', { count: 'exact', head: true }),
        supabase.from('crm_deals').select('*', { count: 'exact', head: true }),
        supabase.from('crm_origins').select('*', { count: 'exact', head: true }),
        supabase.from('crm_deals').select('value').not('value', 'is', null),
        supabase.from('crm_deals')
          .select('id, stage:crm_stages!inner(stage_name)')
          .or('stage_name.ilike.%venda realizada%,stage_name.ilike.%contrato pago%', { foreignTable: 'crm_stages' })
      ]);

      const pipelineValue = pipelineData?.reduce((sum, d) => sum + (d.value || 0), 0) || 0;
      const wonDeals = wonDealsData?.length || 0;
      const conversionRate = totalDeals && totalDeals > 0 
        ? ((wonDeals / totalDeals) * 100).toFixed(1) 
        : '0';

      return {
        totalContacts: totalContacts || 0,
        totalDeals: totalDeals || 0,
        totalOrigins: totalOrigins || 0,
        pipelineValue,
        wonDeals,
        conversionRate
      };
    },
    staleTime: 60000, // 1 minuto
  });

  // Contatos recentes (últimos 5)
  const { data: recentContacts, isLoading: loadingContacts } = useQuery({
    queryKey: ['crm-recent-contacts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('crm_contacts')
        .select('id, name, email, phone, tags, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    },
    staleTime: 60000,
  });

  // Negócios em destaque (top 5 por valor)
  const { data: topDeals, isLoading: loadingDeals } = useQuery({
    queryKey: ['crm-top-deals'],
    queryFn: async () => {
      const { data } = await supabase
        .from('crm_deals')
        .select(`
          id, 
          name, 
          value, 
          stage:crm_stages(stage_name)
        `)
        .not('value', 'is', null)
        .order('value', { ascending: false })
        .limit(5);
      return data || [];
    },
    staleTime: 60000,
  });

  const statsCards = [
    {
      title: 'Total de Contatos',
      value: stats?.totalContacts?.toLocaleString('pt-BR') || '0',
      icon: Users,
      description: 'Contatos cadastrados',
      loading: loadingStats,
      color: 'text-primary',
    },
    {
      title: 'Total de Negócios',
      value: stats?.totalDeals?.toLocaleString('pt-BR') || '0',
      icon: Briefcase,
      description: 'Negócios no pipeline',
      loading: loadingStats,
      color: 'text-warning',
    },
    {
      title: 'Valor do Pipeline',
      value: formatCurrency(stats?.pipelineValue || 0),
      icon: DollarSign,
      description: 'Valor total dos negócios',
      loading: loadingStats,
      color: 'text-success',
    },
    {
      title: 'Origens Ativas',
      value: stats?.totalOrigins?.toLocaleString('pt-BR') || '0',
      icon: MapPin,
      description: 'Canais de captação',
      loading: loadingStats,
      color: 'text-accent',
    },
    {
      title: 'Vendas Realizadas',
      value: stats?.wonDeals?.toLocaleString('pt-BR') || '0',
      icon: CheckCircle,
      description: 'Negócios convertidos',
      loading: loadingStats,
      color: 'text-success',
    },
    {
      title: 'Taxa de Conversão',
      value: `${stats?.conversionRate || '0'}%`,
      icon: TrendingUp,
      description: 'Negócios ganhos',
      loading: loadingStats,
      color: 'text-primary',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Dashboard do CRM</h2>
        <p className="text-muted-foreground">Visão geral das suas métricas e atividades</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statsCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                {stat.loading ? (
                  <>
                    <Skeleton className="h-8 w-24 mb-1" />
                    <Skeleton className="h-4 w-32" />
                  </>
                ) : (
                  <>
                    <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                    <p className="text-xs text-muted-foreground">{stat.description}</p>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Contatos Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingContacts ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : recentContacts && recentContacts.length > 0 ? (
              <div className="space-y-4">
                {recentContacts.map((contact) => (
                  <div key={contact.id} className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0">
                    <div>
                      <p className="font-medium text-foreground">{contact.name}</p>
                      <p className="text-sm text-muted-foreground">{contact.email || contact.phone || 'Sem contato'}</p>
                    </div>
                    {contact.tags && contact.tags.length > 0 && (
                      <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                        {contact.tags[0]}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">Nenhum contato cadastrado</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Maiores Negócios</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingDeals ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : topDeals && topDeals.length > 0 ? (
              <div className="space-y-4">
                {topDeals.map((deal: any) => (
                  <div key={deal.id} className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0">
                    <div>
                      <p className="font-medium text-foreground">{deal.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {deal.stage?.stage_name || 'Sem estágio'}
                      </p>
                    </div>
                    <span className="font-semibold text-success">
                      {formatCurrency(deal.value || 0)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">Nenhum negócio cadastrado</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Overview;
