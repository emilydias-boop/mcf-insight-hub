import { useState, useMemo } from 'react';
import { format, addWeeks, subWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, RefreshCw, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useR2CarrinhoKPIs } from '@/hooks/useR2CarrinhoKPIs';
import { useR2CarrinhoData } from '@/hooks/useR2CarrinhoData';
import { useR2StatusOptions } from '@/hooks/useR2StatusOptions';
import { getCustomWeekStart, getCustomWeekEnd } from '@/lib/dateHelpers';
import { R2AprovadosList } from '@/components/crm/R2AprovadosList';
import { R2NoShowList } from '@/components/crm/R2NoShowList';
import { R2RealizadasList } from '@/components/crm/R2RealizadasList';
import { R2AgendadasList } from '@/components/crm/R2AgendadasList';
import { useQueryClient } from '@tanstack/react-query';

export default function R2Carrinho() {
  const [weekDate, setWeekDate] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState('all');
  const queryClient = useQueryClient();

  const weekStart = getCustomWeekStart(weekDate);
  const weekEnd = getCustomWeekEnd(weekDate);

  // Fetch KPIs
  const { data: kpis, isLoading: kpisLoading, refetch: refetchKpis } = useR2CarrinhoKPIs(weekDate);
  
  // Fetch status options
  const { data: statusOptions = [] } = useR2StatusOptions();

  // Fetch data for each tab
  const { data: agendadasData = [], isLoading: agendadasLoading } = useR2CarrinhoData(weekDate, 'agendadas');
  const { data: noShowData = [], isLoading: noShowLoading } = useR2CarrinhoData(weekDate, 'no_show');
  const { data: realizadasData = [], isLoading: realizadasLoading } = useR2CarrinhoData(weekDate, 'realizadas');
  const { data: aprovadosData = [], isLoading: aprovadosLoading } = useR2CarrinhoData(weekDate, 'aprovados');

  const handlePrevWeek = () => setWeekDate(subWeeks(weekDate, 1));
  const handleNextWeek = () => setWeekDate(addWeeks(weekDate, 1));
  const handleToday = () => setWeekDate(new Date());

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['r2-carrinho-kpis'] });
    queryClient.invalidateQueries({ queryKey: ['r2-carrinho-data'] });
  };

  const handleReschedule = (meetingId: string) => {
    // Open the R2 agenda with the meeting selected for rescheduling
    window.location.href = `/crm/agenda-r2?reschedule=${meetingId}`;
  };

  const weekLabel = useMemo(() => {
    return `${format(weekStart, 'dd/MM', { locale: ptBR })} - ${format(weekEnd, 'dd/MM/yyyy', { locale: ptBR })}`;
  }, [weekStart, weekEnd]);

  const kpiCards = [
    { label: 'Contratos (R1)', value: kpis?.contratosPagos ?? 0, color: 'bg-blue-500' },
    { label: 'R2 Agendadas', value: kpis?.r2Agendadas ?? 0, color: 'bg-indigo-500' },
    { label: 'R2 Realizadas', value: kpis?.r2Realizadas ?? 0, color: 'bg-green-500' },
    { label: 'No-Show', value: kpis?.r2NoShow ?? 0, color: 'bg-red-500' },
    { label: 'Aprovados', value: kpis?.aprovados ?? 0, color: 'bg-emerald-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCart className="h-6 w-6" />
            Carrinho R2
          </h1>
          <p className="text-muted-foreground">
            Gestão semanal do funil de R2
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <Button variant="outline" onClick={handleToday}>
            Hoje
          </Button>
          
          <div className="px-4 py-2 bg-muted rounded-md font-medium min-w-[200px] text-center">
            {weekLabel}
          </div>
          
          <Button variant="outline" size="icon" onClick={handleNextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button variant="outline" size="icon" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-10 rounded-full ${kpi.color}`} />
                <div>
                  <p className="text-sm text-muted-foreground">{kpi.label}</p>
                  <p className="text-2xl font-bold">
                    {kpisLoading ? '...' : kpi.value}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="aprovados" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="agendadas" className="flex items-center gap-2">
            R2 Agendadas
            <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
              {agendadasData.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="no_show" className="flex items-center gap-2">
            No-Show
            <span className="text-xs bg-destructive/20 text-destructive px-2 py-0.5 rounded-full">
              {noShowData.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="realizadas" className="flex items-center gap-2">
            R2 Realizadas
            <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
              {realizadasData.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="aprovados" className="flex items-center gap-2">
            ✓ Aprovados
            <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 px-2 py-0.5 rounded-full">
              {aprovadosData.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agendadas">
          <R2AgendadasList 
            attendees={agendadasData} 
            isLoading={agendadasLoading}
          />
        </TabsContent>

        <TabsContent value="no_show">
          <R2NoShowList 
            attendees={noShowData} 
            isLoading={noShowLoading}
            onReschedule={handleReschedule}
          />
        </TabsContent>

        <TabsContent value="realizadas">
          <R2RealizadasList 
            attendees={realizadasData} 
            isLoading={realizadasLoading}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            statusOptions={statusOptions.map(s => ({ id: s.id, name: s.name, color: s.color }))}
          />
        </TabsContent>

        <TabsContent value="aprovados">
          <R2AprovadosList 
            attendees={aprovadosData} 
            isLoading={aprovadosLoading}
            weekEnd={weekEnd}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
