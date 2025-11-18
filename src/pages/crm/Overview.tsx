import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useClintContacts, useClintDeals, useClintOrigins, useClintGroups } from '@/hooks/useClintAPI';
import { Users, Briefcase, MapPin, Layers, TrendingUp, DollarSign } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const Overview = () => {
  const { data: contacts, isLoading: loadingContacts } = useClintContacts();
  const { data: deals, isLoading: loadingDeals } = useClintDeals();
  const { data: origins, isLoading: loadingOrigins } = useClintOrigins();
  const { data: groups, isLoading: loadingGroups } = useClintGroups();

  const contactsData = contacts?.data || [];
  const dealsData = deals?.data || [];
  const originsData = origins?.data || [];
  const groupsData = groups?.data || [];

  const totalDealsValue = dealsData.reduce((sum: number, deal: any) => sum + (deal.value || 0), 0);
  const activeDeals = dealsData.filter((deal: any) => deal.stage !== 'lost' && deal.stage !== 'won').length;

  const stats = [
    {
      title: 'Total de Contatos',
      value: contactsData.length,
      icon: Users,
      description: 'Contatos cadastrados',
      loading: loadingContacts,
      color: 'text-primary',
    },
    {
      title: 'Negócios Ativos',
      value: activeDeals,
      icon: Briefcase,
      description: 'Em andamento',
      loading: loadingDeals,
      color: 'text-warning',
    },
    {
      title: 'Valor do Pipeline',
      value: `R$ ${(totalDealsValue / 1000).toFixed(1)}k`,
      icon: DollarSign,
      description: 'Valor total dos negócios',
      loading: loadingDeals,
      color: 'text-success',
    },
    {
      title: 'Origens Ativas',
      value: originsData.length,
      icon: MapPin,
      description: 'Canais de captação',
      loading: loadingOrigins,
      color: 'text-accent',
    },
    {
      title: 'Grupos',
      value: groupsData.length,
      icon: Layers,
      description: 'Segmentações ativas',
      loading: loadingGroups,
      color: 'text-muted-foreground',
    },
    {
      title: 'Taxa de Conversão',
      value: dealsData.length > 0 ? `${((dealsData.filter((d: any) => d.stage === 'won').length / dealsData.length) * 100).toFixed(1)}%` : '0%',
      icon: TrendingUp,
      description: 'Negócios ganhos',
      loading: loadingDeals,
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
        {stats.map((stat) => {
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
            ) : contactsData.length > 0 ? (
              <div className="space-y-4">
                {contactsData.slice(0, 5).map((contact: any) => (
                  <div key={contact.id} className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0">
                    <div>
                      <p className="font-medium text-foreground">{contact.name}</p>
                      <p className="text-sm text-muted-foreground">{contact.email}</p>
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
            <CardTitle className="text-foreground">Negócios em Destaque</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingDeals ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : dealsData.length > 0 ? (
              <div className="space-y-4">
                {dealsData.slice(0, 5).map((deal: any) => (
                  <div key={deal.id} className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0">
                    <div>
                      <p className="font-medium text-foreground">{deal.name}</p>
                      <p className="text-sm text-muted-foreground">{deal.stage}</p>
                    </div>
                    <span className="font-semibold text-success">
                      R$ {(deal.value || 0).toLocaleString('pt-BR')}
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
