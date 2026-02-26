import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/formatters';
import { Users, CalendarCheck, FileCheck, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { FunilDuplo } from '@/components/dashboard/FunilDuplo';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getCustomWeekStart, getCustomWeekEnd } from '@/lib/dateHelpers';
import { startOfDay, endOfDay, subDays } from 'date-fns';

const PIPELINE_ORIGIN_ID = 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c';

const STAGE_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-1, 220 70% 50%))',
  'hsl(var(--chart-2, 160 60% 45%))',
  'hsl(var(--chart-3, 30 80% 55%))',
  'hsl(var(--chart-4, 280 65% 60%))',
  'hsl(var(--chart-5, 340 75% 55%))',
];

export function FunilDashboard() {
  const now = new Date();
  const weekStart = getCustomWeekStart(now);
  const weekEnd = getCustomWeekEnd(now);
  const prevWeekStart = subDays(weekStart, 7);
  const prevWeekEnd = subDays(weekEnd, 7);

  // KPIs: current week
  const { data: kpis, isLoading: loadingKpis } = useQuery({
    queryKey: ['funnel-kpis', weekStart.toISOString()],
    queryFn: async () => {
      const [
        { count: novosLeads },
        { data: agendadas },
        { data: contratos },
      ] = await Promise.all([
        supabase.from('crm_deals')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', weekStart.toISOString())
          .lte('created_at', weekEnd.toISOString()),
        supabase.from('crm_deals')
          .select('id, stage:crm_stages!inner(stage_name)')
          .gte('created_at', weekStart.toISOString())
          .lte('created_at', weekEnd.toISOString())
          .ilike('crm_stages.stage_name', '%Reunião 01 Agendada%'),
        supabase.from('crm_deals')
          .select('id, stage:crm_stages!inner(stage_name)')
          .gte('created_at', weekStart.toISOString())
          .lte('created_at', weekEnd.toISOString())
          .ilike('crm_stages.stage_name', '%Contrato Pago%'),
      ]);

      const leadsCount = novosLeads || 0;
      const agendadasCount = agendadas?.length || 0;
      const contratosCount = contratos?.length || 0;
      const taxaConversao = leadsCount > 0 ? ((contratosCount / leadsCount) * 100) : 0;

      return { novosLeads: leadsCount, agendadas: agendadasCount, contratos: contratosCount, taxaConversao };
    },
    staleTime: 60000,
  });

  // KPIs: previous week (for comparison)
  const { data: prevKpis } = useQuery({
    queryKey: ['funnel-kpis-prev', prevWeekStart.toISOString()],
    queryFn: async () => {
      const [
        { count: novosLeads },
        { data: agendadas },
        { data: contratos },
      ] = await Promise.all([
        supabase.from('crm_deals')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', prevWeekStart.toISOString())
          .lte('created_at', prevWeekEnd.toISOString()),
        supabase.from('crm_deals')
          .select('id, stage:crm_stages!inner(stage_name)')
          .gte('created_at', prevWeekStart.toISOString())
          .lte('created_at', prevWeekEnd.toISOString())
          .ilike('crm_stages.stage_name', '%Reunião 01 Agendada%'),
        supabase.from('crm_deals')
          .select('id, stage:crm_stages!inner(stage_name)')
          .gte('created_at', prevWeekStart.toISOString())
          .lte('created_at', prevWeekEnd.toISOString())
          .ilike('crm_stages.stage_name', '%Contrato Pago%'),
      ]);

      return {
        novosLeads: novosLeads || 0,
        agendadas: agendadas?.length || 0,
        contratos: contratos?.length || 0,
      };
    },
    staleTime: 60000,
  });

  // Stage distribution
  const { data: stageDistribution, isLoading: loadingStages } = useQuery({
    queryKey: ['funnel-stage-distribution'],
    queryFn: async () => {
      const { data } = await supabase
        .from('crm_deals')
        .select('stage_id, stage:crm_stages!inner(stage_name, stage_order)')
        .not('stage_id', 'is', null);

      if (!data) return [];

      const counts: Record<string, { name: string; count: number; order: number }> = {};
      data.forEach((deal: any) => {
        const name = deal.stage?.stage_name || 'Sem etapa';
        const order = deal.stage?.stage_order || 999;
        if (!counts[name]) counts[name] = { name, count: 0, order };
        counts[name].count++;
      });

      return Object.values(counts)
        .sort((a, b) => a.order - b.order)
        .slice(0, 10);
    },
    staleTime: 60000,
  });

  // Top deals
  const { data: topDeals, isLoading: loadingDeals } = useQuery({
    queryKey: ['funnel-top-deals'],
    queryFn: async () => {
      const { data } = await supabase
        .from('crm_deals')
        .select('id, name, value, stage:crm_stages(stage_name)')
        .not('value', 'is', null)
        .order('value', { ascending: false })
        .limit(5);
      return data || [];
    },
    staleTime: 60000,
  });

  // Recent deals
  const { data: recentDeals, isLoading: loadingRecent } = useQuery({
    queryKey: ['funnel-recent-deals'],
    queryFn: async () => {
      const { data } = await supabase
        .from('crm_deals')
        .select('id, name, value, updated_at, stage:crm_stages(stage_name)')
        .order('updated_at', { ascending: false })
        .limit(5);
      return data || [];
    },
    staleTime: 60000,
  });

  const calcVariation = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const kpiCards = [
    {
      title: 'Novos Leads',
      value: kpis?.novosLeads || 0,
      icon: Users,
      variation: prevKpis ? calcVariation(kpis?.novosLeads || 0, prevKpis.novosLeads) : null,
      color: 'text-primary',
    },
    {
      title: 'Reuniões Agendadas',
      value: kpis?.agendadas || 0,
      icon: CalendarCheck,
      variation: prevKpis ? calcVariation(kpis?.agendadas || 0, prevKpis.agendadas) : null,
      color: 'text-warning',
    },
    {
      title: 'Contratos Pagos',
      value: kpis?.contratos || 0,
      icon: FileCheck,
      variation: prevKpis ? calcVariation(kpis?.contratos || 0, prevKpis.contratos) : null,
      color: 'text-success',
    },
    {
      title: 'Taxa de Conversão',
      value: `${(kpis?.taxaConversao || 0).toFixed(1)}%`,
      icon: TrendingUp,
      variation: null,
      color: 'text-accent',
      isPercentage: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          const isPositive = kpi.variation !== null && kpi.variation >= 0;
          return (
            <Card key={kpi.title} className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
                <Icon className={`h-4 w-4 ${kpi.color}`} />
              </CardHeader>
              <CardContent>
                {loadingKpis ? (
                  <>
                    <Skeleton className="h-8 w-20 mb-1" />
                    <Skeleton className="h-4 w-24" />
                  </>
                ) : (
                  <>
                    <div className="text-lg sm:text-2xl font-bold text-foreground">
                      {typeof kpi.value === 'number' ? kpi.value.toLocaleString('pt-BR') : kpi.value}
                    </div>
                    {kpi.variation !== null && (
                      <div className={`flex items-center gap-1 text-xs ${isPositive ? 'text-success' : 'text-destructive'}`}>
                        {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        <span>{isPositive ? '+' : ''}{kpi.variation.toFixed(1)}% vs semana anterior</span>
                      </div>
                    )}
                    {kpi.variation === null && !kpi.isPercentage && (
                      <p className="text-xs text-muted-foreground">Esta semana</p>
                    )}
                    {kpi.isPercentage && (
                      <p className="text-xs text-muted-foreground">Contratos / Novos Leads</p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Funil Duplo */}
      <FunilDuplo
        originId={PIPELINE_ORIGIN_ID}
        weekStart={weekStart}
        weekEnd={weekEnd}
        showCurrentState={false}
      />

      {/* Stage Distribution Chart */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Distribuição por Etapa</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingStages ? (
            <Skeleton className="h-64 w-full" />
          ) : stageDistribution && stageDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(250, (stageDistribution.length * 40))}>
              <BarChart data={stageDistribution} layout="vertical" margin={{ left: 20, right: 20 }}>
                <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={160}
                  tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--foreground))',
                  }}
                  formatter={(value: number) => [`${value} negócios`, 'Quantidade']}
                />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={28}>
                  {stageDistribution.map((_, index) => (
                    <Cell key={index} fill={STAGE_COLORS[index % STAGE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-center py-8">Nenhum dado disponível</p>
          )}
        </CardContent>
      </Card>

      {/* Bottom lists */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground text-base">Últimas Movimentações</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingRecent ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : recentDeals && recentDeals.length > 0 ? (
              <div className="space-y-3">
                {recentDeals.map((deal: any) => (
                  <div key={deal.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground text-sm truncate">{deal.name}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ArrowRight className="h-3 w-3" />
                        <span>{deal.stage?.stage_name || 'Sem etapa'}</span>
                      </div>
                    </div>
                    {deal.value && (
                      <span className="text-sm font-semibold text-success ml-2 shrink-0">
                        {formatCurrency(deal.value)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-6 text-sm">Nenhuma movimentação recente</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground text-base">Maiores Oportunidades</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingDeals ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : topDeals && topDeals.length > 0 ? (
              <div className="space-y-3">
                {topDeals.map((deal: any) => (
                  <div key={deal.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground text-sm truncate">{deal.name}</p>
                      <p className="text-xs text-muted-foreground">{deal.stage?.stage_name || 'Sem etapa'}</p>
                    </div>
                    <span className="font-semibold text-success text-sm ml-2 shrink-0">
                      {formatCurrency(deal.value || 0)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-6 text-sm">Nenhum negócio cadastrado</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
