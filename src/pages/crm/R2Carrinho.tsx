import { useState, useMemo } from 'react';
import { format, addWeeks, subWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, RefreshCw, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useR2CarrinhoKPIs } from '@/hooks/useR2CarrinhoKPIs';
import { useR2CarrinhoData, R2CarrinhoAttendee } from '@/hooks/useR2CarrinhoData';
import { useR2StatusOptions, useR2ThermometerOptions } from '@/hooks/useR2StatusOptions';
import { getCustomWeekStart, getCustomWeekEnd } from '@/lib/dateHelpers';
import { R2AprovadosList } from '@/components/crm/R2AprovadosList';
import { R2ForaDoCarrinhoList } from '@/components/crm/R2ForaDoCarrinhoList';
import { useR2ForaDoCarrinhoData } from '@/hooks/useR2ForaDoCarrinhoData';
import { R2AgendadasList } from '@/components/crm/R2AgendadasList';
import { R2MetricsPanel } from '@/components/crm/R2MetricsPanel';
import { R2VendasList } from '@/components/crm/R2VendasList';
import { useR2CarrinhoVendas } from '@/hooks/useR2CarrinhoVendas';
import { useR2MeetingsExtended } from '@/hooks/useR2MeetingsExtended';
import { R2MeetingDetailDrawer } from '@/components/crm/R2MeetingDetailDrawer';
import { useQueryClient } from '@tanstack/react-query';
import { useActiveBU } from '@/hooks/useActiveBU';

export default function R2Carrinho() {
  const [weekDate, setWeekDate] = useState(new Date());
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const queryClient = useQueryClient();

  const weekStart = getCustomWeekStart(weekDate);
  const weekEnd = getCustomWeekEnd(weekDate);

  // Fetch KPIs
  const { data: kpis, isLoading: kpisLoading, refetch: refetchKpis } = useR2CarrinhoKPIs(weekDate);
  
  // Fetch status options
  const { data: statusOptions = [] } = useR2StatusOptions();
  const { data: thermometerOptions = [] } = useR2ThermometerOptions();

  // Fetch data for each tab
  const { data: agendadasData = [], isLoading: agendadasLoading } = useR2CarrinhoData(weekDate, 'agendadas');
  const { data: foraCarrinhoData = [], isLoading: foraCarrinhoLoading } = useR2ForaDoCarrinhoData(weekDate);
  const { data: aprovadosData = [], isLoading: aprovadosLoading } = useR2CarrinhoData(weekDate, 'aprovados');
  const { data: vendasData = [] } = useR2CarrinhoVendas(weekDate);

  // Fetch extended meeting data for the drawer
  const { data: meetingsExtended = [] } = useR2MeetingsExtended(weekStart, weekEnd);

  // Find the selected meeting for the drawer
  const selectedMeeting = useMemo(() => {
    if (!selectedMeetingId) return null;
    return meetingsExtended.find(m => m.id === selectedMeetingId) || null;
  }, [selectedMeetingId, meetingsExtended]);

  const handlePrevWeek = () => setWeekDate(subWeeks(weekDate, 1));
  const handleNextWeek = () => setWeekDate(addWeeks(weekDate, 1));
  const handleToday = () => setWeekDate(new Date());

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['r2-carrinho-kpis'] });
    queryClient.invalidateQueries({ queryKey: ['r2-carrinho-data'] });
    queryClient.invalidateQueries({ queryKey: ['r2-fora-carrinho-data'] });
    queryClient.invalidateQueries({ queryKey: ['r2-carrinho-vendas'] });
    queryClient.invalidateQueries({ queryKey: ['r2-meetings-extended'] });
  };

  const handleReschedule = (meetingId: string) => {
    // Open the R2 agenda with the meeting selected for rescheduling
    window.location.href = `/crm/agenda-r2?reschedule=${meetingId}`;
  };

  const handleSelectAttendee = (attendee: R2CarrinhoAttendee) => {
    setSelectedMeetingId(attendee.meeting_id);
    setDrawerOpen(true);
  };

  const weekLabel = useMemo(() => {
    return `${format(weekStart, 'dd/MM', { locale: ptBR })} - ${format(weekEnd, 'dd/MM/yyyy', { locale: ptBR })}`;
  }, [weekStart, weekEnd]);

  const kpiCards = [
    { label: 'Contratos (R1)', value: kpis?.contratosPagos ?? 0, color: 'bg-blue-500' },
    { label: 'R2 Pendentes', value: kpis?.r2Agendadas ?? 0, color: 'bg-indigo-500' },
    { label: 'R2 Realizadas', value: kpis?.r2Realizadas ?? 0, color: 'bg-green-500' },
    { label: 'Fora do Carrinho', value: kpis?.foraDoCarrinho ?? 0, color: 'bg-red-500' },
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

      {/* Tabs - Nova ordem: R2 Agendada | Fora do Carrinho | Aprovados | Vendas | Métricas */}
      <Tabs defaultValue="metricas" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="agendadas" className="flex items-center gap-2">
            📋 Todas R2s
            <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
              {agendadasData.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="fora_carrinho" className="flex items-center gap-2">
            Fora do Carrinho
            <span className="text-xs bg-destructive/20 text-destructive px-2 py-0.5 rounded-full">
              {foraCarrinhoData.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="aprovados" className="flex items-center gap-2">
            ✓ Aprovados
            <span className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100 px-2 py-0.5 rounded-full">
              {aprovadosData.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="vendas" className="flex items-center gap-2">
            💰 Vendas
            <span className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100 px-2 py-0.5 rounded-full">
              {vendasData.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="metricas" className="flex items-center gap-2">
            📊 Métricas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agendadas">
          <R2AgendadasList 
            attendees={agendadasData} 
            isLoading={agendadasLoading}
            onSelectAttendee={handleSelectAttendee}
          />
        </TabsContent>

        <TabsContent value="fora_carrinho">
          <R2ForaDoCarrinhoList 
            attendees={foraCarrinhoData} 
            isLoading={foraCarrinhoLoading}
          />
        </TabsContent>

        <TabsContent value="aprovados">
          <R2AprovadosList 
            attendees={aprovadosData} 
            isLoading={aprovadosLoading}
            weekEnd={weekEnd}
          />
        </TabsContent>

        <TabsContent value="vendas">
          <R2VendasList 
            weekStart={weekStart} 
            weekEnd={weekEnd} 
          />
        </TabsContent>

        <TabsContent value="metricas">
          <R2MetricsPanel weekDate={weekDate} />
        </TabsContent>
      </Tabs>

      {/* R2 Meeting Detail Drawer */}
      <R2MeetingDetailDrawer
        meeting={selectedMeeting}
        statusOptions={statusOptions}
        thermometerOptions={thermometerOptions}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onReschedule={() => {
          if (selectedMeetingId) {
            handleReschedule(selectedMeetingId);
          }
        }}
      />
    </div>
  );
}
