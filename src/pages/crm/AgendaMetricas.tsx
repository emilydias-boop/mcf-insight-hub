import { useState, useMemo } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getWeekStartsOn } from '@/lib/businessDays';
import { ArrowLeft, BarChart3, Users, CheckCircle, XCircle, AlertTriangle, Percent, TrendingUp, MousePointer, Webhook, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { useAgendaMeetings, useAgendaStats, useClosersWithAvailability, useCloserMetrics } from '@/hooks/useAgendaData';
import { useMeetingStats } from '@/hooks/useMeetingStats';
import { UpcomingMeetingsSidebar } from '@/components/crm/UpcomingMeetingsSidebar';
import { useActiveBU } from '@/hooks/useActiveBU';

export default function AgendaMetricas() {
  const navigate = useNavigate();
  const [selectedDate] = useState(new Date());
  const activeBU = useActiveBU();
  
  const wso = getWeekStartsOn(activeBU);
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: wso });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: wso });
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);

  // Buscar closers da BU primeiro
  const { data: closers = [], isLoading: closersLoading } = useClosersWithAvailability(activeBU);
  
  // Extrair IDs dos closers para filtrar reuniões por BU
  const closerIds = useMemo(() => closers.map(c => c.id), [closers]);
  
  // Passar closerIds para filtrar apenas reuniões dos closers desta BU
  const { data: weekMeetings = [], isLoading: meetingsLoading } = useAgendaMeetings(
    weekStart, weekEnd, 'r1', closerIds.length > 0 ? closerIds : undefined
  );
  const { data: monthMeetings = [] } = useAgendaMeetings(
    monthStart, monthEnd, 'r1', closerIds.length > 0 ? closerIds : undefined
  );
  const { data: stats, isLoading: statsLoading } = useAgendaStats(selectedDate);
  const { data: closerMetrics = [], isLoading: metricsLoading } = useCloserMetrics(selectedDate);
  const { data: sourceStats } = useMeetingStats(monthStart, monthEnd);

  // Calculate occupancy per closer
  const closerOccupancy = useMemo(() => {
    return closers.map(closer => {
      const closerMeetings = weekMeetings.filter(m => m.closer_id === closer.id && ['scheduled', 'rescheduled'].includes(m.status));
      const totalSlots = 20 * 5; // 20 slots per day x 5 days
      const occupancy = Math.round((closerMeetings.length / totalSlots) * 100);
      return { ...closer, meetingsCount: closerMeetings.length, occupancy: Math.min(occupancy, 100) };
    });
  }, [closers, weekMeetings]);

  // Calculate conversion rates per closer
  const closerConversion = useMemo(() => {
    return closers.map(closer => {
      const closerMeetings = monthMeetings.filter(m => m.closer_id === closer.id);
      const completed = closerMeetings.filter(m => m.status === 'completed').length;
      const noShow = closerMeetings.filter(m => m.status === 'no_show').length;
      const total = closerMeetings.length;
      const conversionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
      return { ...closer, total, completed, noShow, conversionRate };
    });
  }, [closers, monthMeetings]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/crm/agenda')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <BarChart3 className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Métricas da Agenda</h1>
              <p className="text-sm text-muted-foreground">
                KPIs detalhados dos closers e reuniões
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Hoje</CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats?.totalMeetingsToday || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Semana</CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats?.totalMeetingsWeek || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Realizadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-green-600">{stats?.completedMeetings || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              No-show
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-yellow-600">{stats?.noShowMeetings || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <XCircle className="h-4 w-4 text-red-500" />
              Canceladas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-red-600">{stats?.canceledMeetings || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <Percent className="h-4 w-4 text-primary" />
              Ocupação Média
            </CardTitle>
          </CardHeader>
          <CardContent>
            {closersLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-primary">
                {closerOccupancy.length > 0
                  ? Math.round(closerOccupancy.reduce((acc, c) => acc + c.occupancy, 0) / closerOccupancy.length)
                  : 0}%
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Source Stats */}
      {sourceStats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              Origem dos Agendamentos (Mês)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <Calendar className="h-6 w-6 mx-auto mb-2 text-primary" />
                <div className="text-2xl font-bold">{sourceStats.total}</div>
                <div className="text-sm text-muted-foreground">Total</div>
              </div>
              <div className="p-4 rounded-lg bg-primary/10 text-center">
                <MousePointer className="h-6 w-6 mx-auto mb-2 text-primary" />
                <div className="text-2xl font-bold">{sourceStats.bySource.manual}</div>
                <div className="text-sm text-muted-foreground">Manual</div>
                <div className="text-xs text-muted-foreground">
                  {sourceStats.total > 0 ? Math.round((sourceStats.bySource.manual / sourceStats.total) * 100) : 0}%
                </div>
              </div>
              <div className="p-4 rounded-lg bg-green-500/10 text-center">
                <Webhook className="h-6 w-6 mx-auto mb-2 text-green-600" />
                <div className="text-2xl font-bold text-green-600">{sourceStats.bySource.clint}</div>
                <div className="text-sm text-muted-foreground">Via Clint</div>
                <div className="text-xs text-muted-foreground">
                  {sourceStats.total > 0 ? Math.round((sourceStats.bySource.clint / sourceStats.total) * 100) : 0}%
                </div>
              </div>
              <div className="p-4 rounded-lg bg-blue-500/10 text-center">
                <Calendar className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                <div className="text-2xl font-bold text-blue-600">{sourceStats.bySource.calendly}</div>
                <div className="text-sm text-muted-foreground">Via Calendly</div>
                <div className="text-xs text-muted-foreground">
                  {sourceStats.total > 0 ? Math.round((sourceStats.bySource.calendly / sourceStats.total) * 100) : 0}%
                </div>
              </div>
            </div>
            {/* Lead Type Distribution */}
            <div className="mt-4 pt-4 border-t">
              <div className="text-sm font-medium mb-2">Por Tipo de Lead</div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-sm">Lead A: {sourceStats.byLeadType.A}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-sm">Lead B: {sourceStats.byLeadType.B}</span>
                </div>
                {sourceStats.byLeadType.unknown > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gray-400" />
                    <span className="text-sm">Não definido: {sourceStats.byLeadType.unknown}</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Occupancy by Closer */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Ocupação por Closer (Semana)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {closersLoading ? (
              <>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </>
            ) : (
              closerOccupancy.map(closer => (
                <div key={closer.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: closer.color || '#6B7280' }}
                      />
                      <span className="font-medium">{closer.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{closer.meetingsCount} reuniões</span>
                      <Badge variant={closer.occupancy > 70 ? 'default' : closer.occupancy > 40 ? 'secondary' : 'outline'}>
                        {closer.occupancy}%
                      </Badge>
                    </div>
                  </div>
                  <Progress value={closer.occupancy} className="h-2" />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Conversion Rate by Closer */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Taxa de Conversão (Mês)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {closersLoading ? (
              <>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </>
            ) : (
              closerConversion.map(closer => (
                <div key={closer.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: closer.color || '#6B7280' }}
                    />
                    <span className="font-medium">{closer.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>{closer.completed}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      <span>{closer.noShow}</span>
                    </div>
                    <Badge 
                      variant={closer.conversionRate >= 70 ? 'default' : closer.conversionRate >= 50 ? 'secondary' : 'destructive'}
                    >
                      {closer.conversionRate}%
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Meetings & Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Próximas Reuniões de Hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <UpcomingMeetingsSidebar
              selectedDate={selectedDate}
              metrics={closerMetrics}
              metricsLoading={metricsLoading}
              onSelectMeeting={() => {}}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estatísticas da Semana</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground mb-4">
              {format(weekStart, "dd MMM", { locale: ptBR })} - {format(weekEnd, "dd MMM yyyy", { locale: ptBR })}
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 rounded-lg bg-green-500/10">
                <span className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Taxa de Comparecimento
                </span>
                <span className="font-bold text-green-600">
                  {stats && stats.totalMeetingsWeek > 0
                    ? Math.round(((stats.completedMeetings || 0) / stats.totalMeetingsWeek) * 100)
                    : 0}%
                </span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-yellow-500/10">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  Taxa de No-Show
                </span>
                <span className="font-bold text-yellow-600">
                  {stats && stats.totalMeetingsWeek > 0
                    ? Math.round(((stats.noShowMeetings || 0) / stats.totalMeetingsWeek) * 100)
                    : 0}%
                </span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-red-500/10">
                <span className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  Taxa de Cancelamento
                </span>
                <span className="font-bold text-red-600">
                  {stats && stats.totalMeetingsWeek > 0
                    ? Math.round(((stats.canceledMeetings || 0) / stats.totalMeetingsWeek) * 100)
                    : 0}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
