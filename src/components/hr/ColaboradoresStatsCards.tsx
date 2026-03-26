import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserCheck, Clock, FileWarning, TrendingDown, AlertTriangle, MessageSquare, Flag } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays } from 'date-fns';
import type { Employee } from '@/types/hr';

interface Props {
  employees: Employee[] | undefined;
  nfseStatusMap: Record<string, string>;
}

export default function ColaboradoresStatsCards({ employees, nfseStatusMap }: Props) {
  const { data: ticketsData } = useQuery({
    queryKey: ['hr-tickets-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rh_tickets')
        .select('status')
        .neq('status', 'finalizado');
      if (error) throw error;
      return data;
    },
  });

  const { data: flagsData } = useQuery({
    queryKey: ['hr-flags-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_flags')
        .select('id')
        .eq('is_resolved', false);
      if (error) throw error;
      return data;
    },
  });

  const stats = useMemo(() => {
    const total = employees?.length || 0;
    const ativos = employees?.filter(e => e.status === 'ativo').length || 0;

    const emExperiencia = employees?.filter(e => {
      if (e.status !== 'ativo' || !e.data_admissao) return false;
      return differenceInDays(new Date(), new Date(e.data_admissao)) <= 90;
    }).length || 0;

    const pjAtivos = employees?.filter(e => e.tipo_contrato === 'PJ' && e.status === 'ativo') || [];
    const nfsePendente = pjAtivos.filter(e => {
      const s = nfseStatusMap[e.id];
      return !s || s === 'pendente_envio' || s === 'devolvida';
    }).length;

    const desligados30d = employees?.filter(e => {
      if (e.status !== 'desligado' || !e.data_demissao) return false;
      return differenceInDays(new Date(), new Date(e.data_demissao)) <= 30;
    }).length || 0;
    const turnover = ativos > 0 ? ((desligados30d / ativos) * 100).toFixed(1) : '0.0';

    const pendenciasRh = ticketsData?.length || 0;
    const chamadosAbertos = ticketsData?.filter(t => t.status === 'encaminhado' || t.status === 'em_avaliacao').length || 0;
    const redFlags = flagsData?.length || 0;

    return { total, ativos, emExperiencia, nfsePendente, turnover, pendenciasRh, chamadosAbertos, redFlags };
  }, [employees, nfseStatusMap, ticketsData, flagsData]);

  const cards = [
    { label: 'Total', value: stats.total, icon: Users, iconColor: 'text-muted-foreground', valueColor: '' },
    { label: 'Ativos', value: stats.ativos, icon: UserCheck, iconColor: 'text-green-500', valueColor: 'text-green-600' },
    { label: 'Em Experiência', value: stats.emExperiencia, icon: Clock, iconColor: 'text-blue-500', valueColor: 'text-blue-600', sub: '≤90 dias' },
    { label: 'NFSe Pendente', value: stats.nfsePendente, icon: FileWarning, iconColor: 'text-yellow-500', valueColor: 'text-yellow-600', sub: 'PJ este mês' },
    { label: 'Turnover', value: `${stats.turnover}%`, icon: TrendingDown, iconColor: 'text-orange-500', valueColor: 'text-orange-600', sub: 'Últimos 30 dias' },
    { label: 'Pendências RH', value: stats.pendenciasRh, icon: MessageSquare, iconColor: 'text-purple-500', valueColor: 'text-purple-600', sub: 'Tickets abertos' },
    { label: 'Red Flags', value: stats.redFlags, icon: Flag, iconColor: 'text-red-500', valueColor: 'text-red-600', sub: 'Não resolvidas' },
    { label: 'Chamados Abertos', value: stats.chamadosAbertos, icon: AlertTriangle, iconColor: 'text-amber-500', valueColor: 'text-amber-600', sub: 'Sem encerramento' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map(c => (
        <Card key={c.label}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{c.label}</CardTitle>
            <c.icon className={`h-4 w-4 ${c.iconColor}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${c.valueColor}`}>{c.value}</div>
            {c.sub && <p className="text-xs text-muted-foreground">{c.sub}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
