import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMeetingStats } from "@/hooks/useMeetingStats";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Calendar, 
  Users, 
  Webhook, 
  MousePointer, 
  CheckCircle, 
  XCircle, 
  Clock,
  TrendingUp
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface MeetingStatsPanelProps {
  startDate: Date;
  endDate: Date;
}

const SOURCE_COLORS = {
  manual: 'hsl(var(--primary))',
  clint: 'hsl(142, 76%, 36%)',
  calendly: 'hsl(221, 83%, 53%)',
};

const STATUS_COLORS = {
  scheduled: 'hsl(var(--primary))',
  completed: 'hsl(142, 76%, 36%)',
  no_show: 'hsl(0, 84%, 60%)',
  cancelled: 'hsl(var(--muted-foreground))',
  rescheduled: 'hsl(38, 92%, 50%)',
};

const LEAD_COLORS = {
  A: 'hsl(142, 76%, 36%)',
  B: 'hsl(221, 83%, 53%)',
  unknown: 'hsl(var(--muted-foreground))',
};

export function MeetingStatsPanel({ startDate, endDate }: MeetingStatsPanelProps) {
  const { data: stats, isLoading } = useMeetingStats(startDate, endDate);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const sourceData = [
    { name: 'Manual', value: stats.bySource.manual, color: SOURCE_COLORS.manual },
    { name: 'Clint Webhook', value: stats.bySource.clint, color: SOURCE_COLORS.clint },
    { name: 'Calendly', value: stats.bySource.calendly, color: SOURCE_COLORS.calendly },
  ].filter(d => d.value > 0);

  const statusData = [
    { name: 'Agendadas', value: stats.byStatus.scheduled, color: STATUS_COLORS.scheduled },
    { name: 'Realizadas', value: stats.byStatus.completed, color: STATUS_COLORS.completed },
    { name: 'No-Show', value: stats.byStatus.no_show, color: STATUS_COLORS.no_show },
    { name: 'Canceladas', value: stats.byStatus.cancelled, color: STATUS_COLORS.cancelled },
    { name: 'Reagendadas', value: stats.byStatus.rescheduled, color: STATUS_COLORS.rescheduled },
  ].filter(d => d.value > 0);

  const leadTypeData = [
    { name: 'Lead A', value: stats.byLeadType.A, color: LEAD_COLORS.A },
    { name: 'Lead B', value: stats.byLeadType.B, color: LEAD_COLORS.B },
    { name: 'Não definido', value: stats.byLeadType.unknown, color: LEAD_COLORS.unknown },
  ].filter(d => d.value > 0);

  const getPercentage = (value: number, total: number) => {
    if (total === 0) return '0%';
    return `${((value / total) * 100).toFixed(0)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Reuniões</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">no período selecionado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agendadas Manual</CardTitle>
            <MousePointer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.bySource.manual}</div>
            <p className="text-xs text-muted-foreground">
              {getPercentage(stats.bySource.manual, stats.total)} do total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Via Clint Webhook</CardTitle>
            <Webhook className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.bySource.clint}</div>
            <p className="text-xs text-muted-foreground">
              {getPercentage(stats.bySource.clint, stats.total)} do total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.conversionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              realizadas vs finalizadas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Source Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por Origem</CardTitle>
          </CardHeader>
          <CardContent>
            {sourceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={sourceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {sourceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                Sem dados
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por Status</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                Sem dados
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lead Type Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por Tipo de Lead</CardTitle>
          </CardHeader>
          <CardContent>
            {leadTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={leadTypeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {leadTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                Sem dados
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalhamento por Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <div>
                <div className="text-sm font-medium">{stats.byStatus.scheduled}</div>
                <div className="text-xs text-muted-foreground">Agendadas</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div>
                <div className="text-sm font-medium">{stats.byStatus.completed}</div>
                <div className="text-xs text-muted-foreground">Realizadas</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <div>
                <div className="text-sm font-medium">{stats.byStatus.no_show}</div>
                <div className="text-xs text-muted-foreground">No-Show</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">{stats.byStatus.cancelled}</div>
                <div className="text-xs text-muted-foreground">Canceladas</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-yellow-500" />
              <div>
                <div className="text-sm font-medium">{stats.byStatus.rescheduled}</div>
                <div className="text-xs text-muted-foreground">Reagendadas</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
