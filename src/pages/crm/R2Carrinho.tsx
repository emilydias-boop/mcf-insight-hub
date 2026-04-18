import { useState, useMemo, useCallback } from 'react';
import { format, addWeeks, subWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, RefreshCw, ShoppingCart, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useR2CarrinhoKPIs } from '@/hooks/useR2CarrinhoKPIs';
import { useR2CarrinhoData, R2CarrinhoAttendee } from '@/hooks/useR2CarrinhoData';
import { useR2StatusOptions, useR2ThermometerOptions } from '@/hooks/useR2StatusOptions';
import { getCartWeekStart, getCartWeekEnd, getActiveCartReferenceDate, getCarrinhoMetricBoundaries } from '@/lib/carrinhoWeekBoundaries';
import { R2AprovadosList } from '@/components/crm/R2AprovadosList';
import { R2ForaDoCarrinhoList } from '@/components/crm/R2ForaDoCarrinhoList';
import { useR2ForaDoCarrinhoData } from '@/hooks/useR2ForaDoCarrinhoData';
import { R2AgendadasList } from '@/components/crm/R2AgendadasList';
import { R2MetricsPanel } from '@/components/crm/R2MetricsPanel';
import { R2VendasList } from '@/components/crm/R2VendasList';
import { useR2CarrinhoVendas } from '@/hooks/useR2CarrinhoVendas';
import { useR2MeetingsExtended } from '@/hooks/useR2MeetingsExtended';
import { useR2AccumulatedLeads } from '@/hooks/useR2AccumulatedLeads';
import { R2AccumulatedList } from '@/components/crm/R2AccumulatedList';
import { R2AccumulatedAlert } from '@/components/crm/R2AccumulatedAlert';
import { R2MeetingDetailDrawer } from '@/components/crm/R2MeetingDetailDrawer';
import { useQueryClient } from '@tanstack/react-query';
import { useActiveBU } from '@/hooks/useActiveBU';
import { useCarrinhoConfig, filterByCarrinho } from '@/hooks/useCarrinhoConfig';
import { CarrinhoConfigDialog } from '@/components/crm/CarrinhoConfigDialog';
import { R2QuickScheduleModal } from '@/components/crm/R2QuickScheduleModal';
import { useActiveR2Closers } from '@/hooks/useR2AgendaData';
import { R2AccumulatedLead } from '@/hooks/useR2AccumulatedLeads';
import { useEncaixarNoCarrinho } from '@/hooks/useEncaixarNoCarrinho';

export default function R2Carrinho() {
  const [weekDate, setWeekDate] = useState(() => getActiveCartReferenceDate(new Date()));
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedCarrinhoId, setSelectedCarrinhoId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('agendadas');
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedAccLead, setSelectedAccLead] = useState<R2AccumulatedLead | null>(null);
  const [encaixandoId, setEncaixandoId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const weekStart = useMemo(() => getCartWeekStart(weekDate), [weekDate]);
  const weekEnd = useMemo(() => getCartWeekEnd(weekDate), [weekDate]);
  const prevWeekStart = useMemo(() => subWeeks(weekStart, 1), [weekStart]);

  const { config, saveConfig, copyFromPreviousWeek } = useCarrinhoConfig(weekStart);
  const { config: prevConfig } = useCarrinhoConfig(prevWeekStart);

  // Cutoff string for queryKey reactivity
  const cutoffKey = config?.carrinhos?.[0]?.horario_corte || '12:00';
  const prevCutoffKey = prevConfig?.carrinhos?.[0]?.horario_corte || '12:00';

  // Fetch KPIs
  const { data: kpis, isLoading: kpisLoading, refetch: refetchKpis } = useR2CarrinhoKPIs(weekStart, weekEnd, config, prevConfig);
  
  // Fetch status options
  const { data: statusOptions = [] } = useR2StatusOptions();
  const { data: thermometerOptions = [] } = useR2ThermometerOptions();
  const { data: r2Closers = [] } = useActiveR2Closers();
  const encaixarMutation = useEncaixarNoCarrinho();

  // Fetch data for each tab
  const { data: rawAgendadasData = [], isLoading: agendadasLoading } = useR2CarrinhoData(weekStart, weekEnd, 'agendadas', config, prevConfig);
  const { data: rawForaCarrinhoData = [], isLoading: foraCarrinhoLoading } = useR2ForaDoCarrinhoData(weekStart, weekEnd, config, prevConfig);
  const { data: rawAprovadosData = [], isLoading: aprovadosLoading } = useR2CarrinhoData(weekStart, weekEnd, 'aprovados', config, prevConfig);
  const { data: rawVendasData = [] } = useR2CarrinhoVendas(weekStart, weekEnd, config, prevConfig);

  // Filter data by selected carrinho
  const agendadasData = useMemo(() => 
    filterByCarrinho(rawAgendadasData, config, selectedCarrinhoId, item => item.display_scheduled_at),
    [rawAgendadasData, config, selectedCarrinhoId]
  );
  const foraCarrinhoData = useMemo(() => 
    filterByCarrinho(rawForaCarrinhoData, config, selectedCarrinhoId, item => item.scheduled_at),
    [rawForaCarrinhoData, config, selectedCarrinhoId]
  );
  const aprovadosData = useMemo(() => 
    filterByCarrinho(rawAprovadosData, config, selectedCarrinhoId, item => item.display_scheduled_at),
    [rawAprovadosData, config, selectedCarrinhoId]
  );
  const vendasData = useMemo(() => 
    filterByCarrinho(rawVendasData, config, selectedCarrinhoId, item => item.r2_scheduled_at || item.original_scheduled_at || item.sale_date),
    [rawVendasData, config, selectedCarrinhoId]
  );

  // Compute filtered KPIs from agendadas/aprovados/fora data when a carrinho is selected
  const filteredKpis = useMemo(() => {
    if (!selectedCarrinhoId || !kpis) return kpis;
    return {
      ...kpis,
      r2Agendadas: agendadasData.filter(a => ['scheduled', 'invited', 'pending'].includes(a.meeting_status) && a.status !== 'rescheduled').length,
      r2Realizadas: agendadasData.filter(a => a.meeting_status === 'completed').length,
      foraDoCarrinho: foraCarrinhoData.length,
      aprovados: aprovadosData.length,
    };
  }, [selectedCarrinhoId, kpis, agendadasData, foraCarrinhoData, aprovadosData]);

  // Fetch extended meeting data for the drawer
  const { data: meetingsExtended = [] } = useR2MeetingsExtended(weekStart, weekEnd);

  // Fetch accumulated leads from previous weeks
  const { data: accumulatedLeads = [], isLoading: accumulatedLoading } = useR2AccumulatedLeads(weekStart, weekEnd);
  const accProximaSemanaCount = accumulatedLeads.filter(l => l.origin_type === 'proxima_semana').length;
  const accSemR2Count = accumulatedLeads.filter(l => l.origin_type === 'sem_r2').length;

  // Find the selected meeting for the drawer
  const selectedMeeting = useMemo(() => {
    if (!selectedMeetingId) return null;
    return meetingsExtended.find(m => m.id === selectedMeetingId) || null;
  }, [selectedMeetingId, meetingsExtended]);

  const handlePrevWeek = () => setWeekDate(subWeeks(weekDate, 1));
  const handleNextWeek = () => setWeekDate(addWeeks(weekDate, 1));
  const handleToday = () => setWeekDate(new Date());

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['carrinho-unified-data'] });
    queryClient.invalidateQueries({ queryKey: ['r2-carrinho-kpis'] });
    queryClient.invalidateQueries({ queryKey: ['r2-carrinho-contratos'] });
    queryClient.invalidateQueries({ queryKey: ['r2-carrinho-data'] });
    queryClient.invalidateQueries({ queryKey: ['r2-fora-carrinho-data'] });
    queryClient.invalidateQueries({ queryKey: ['r2-carrinho-vendas'] });
    queryClient.invalidateQueries({ queryKey: ['r2-meetings-extended'] });
    queryClient.invalidateQueries({ queryKey: ['carrinho-config'] });
    queryClient.invalidateQueries({ queryKey: ['r2-accumulated-leads'] });
    queryClient.invalidateQueries({ queryKey: ['r2-metrics-data'] });
  };

  const handleReschedule = (meetingId: string) => {
    window.location.href = `/crm/agenda-r2?reschedule=${meetingId}`;
  };

  const handleSelectAttendee = (attendee: R2CarrinhoAttendee) => {
    setSelectedMeetingId(attendee.meeting_id);
    setDrawerOpen(true);
  };

  const handleScheduleAccumulated = useCallback((lead: R2AccumulatedLead) => {
    setSelectedAccLead(lead);
    setScheduleModalOpen(true);
  }, []);

  const handleEncaixarAccumulated = useCallback((lead: R2AccumulatedLead) => {
    if (!lead.id) return;
    // For leads that are synthetic (sem-r2-...), we need the real attendee id
    // meeting_id presence means the lead has an existing attendee record
    setEncaixandoId(lead.id);
    encaixarMutation.mutate(
      { attendeeId: lead.id, weekStart },
      {
        onSettled: () => setEncaixandoId(null),
      }
    );
  }, [encaixarMutation, weekStart]);

  const weekLabel = useMemo(() => {
    return `${format(weekStart, 'dd/MM', { locale: ptBR })} - ${format(weekEnd, 'dd/MM/yyyy', { locale: ptBR })}`;
  }, [weekStart, weekEnd]);

  const displayKpis = filteredKpis ?? kpis;

  const kpiCards = [
    { label: 'Contratos (R1)', value: displayKpis?.contratosPagos ?? 0, color: 'bg-blue-500' },
    { label: 'R2 Agendadas', value: displayKpis?.r2Agendadas ?? 0, color: 'bg-indigo-500' },
    { label: 'R2 Realizadas', value: displayKpis?.r2Realizadas ?? 0, color: 'bg-green-500' },
    { label: 'Fora do Carrinho', value: displayKpis?.foraDoCarrinho ?? 0, color: 'bg-red-500' },
    { label: 'Aprovados', value: displayKpis?.aprovados ?? 0, color: 'bg-emerald-500' },
  ];

  const selectedCarrinhoLabel = selectedCarrinhoId 
    ? config.carrinhos.find(c => c.id === selectedCarrinhoId)?.label 
    : null;

  const handleCopyFromPrevious = () => {
    copyFromPreviousWeek.mutate(undefined, {
      onSuccess: () => {
        setConfigDialogOpen(false);
        setTimeout(() => setConfigDialogOpen(true), 100);
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCart className="h-6 w-6" />
            Carrinho R2
            {selectedCarrinhoLabel && (
              <span className="text-base font-medium text-muted-foreground ml-1">
                — {selectedCarrinhoLabel}
              </span>
            )}
          </h1>
          <p className="text-muted-foreground">
            Safra: Contratos de {format(weekStart, 'dd/MM', { locale: ptBR })} a {format(weekEnd, 'dd/MM/yyyy', { locale: ptBR })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Carrinho selector */}
          {config.carrinhos.length > 1 && (
            <div className="flex items-center border border-border rounded-md overflow-hidden mr-2">
              <Button
                variant={selectedCarrinhoId === null ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none border-0"
                onClick={() => setSelectedCarrinhoId(null)}
              >
                Todos
              </Button>
              {config.carrinhos.map(c => (
                <Button
                  key={c.id}
                  variant={selectedCarrinhoId === c.id ? 'default' : 'ghost'}
                  size="sm"
                  className="rounded-none border-0"
                  onClick={() => setSelectedCarrinhoId(c.id)}
                >
                  {c.label}
                </Button>
              ))}
            </div>
          )}

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

          <Button
            variant="outline"
            size="icon"
            onClick={() => setConfigDialogOpen(true)}
            title="Configurar Carrinhos"
          >
            <Settings className="h-4 w-4" />
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

      {/* Accumulated Alert */}
      <R2AccumulatedAlert
        totalCount={accumulatedLeads.length}
        proximaSemanaCount={accProximaSemanaCount}
        semR2Count={accSemR2Count}
        onGoToTab={() => setActiveTab('acumulados')}
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="w-full">
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
          {accumulatedLeads.length > 0 && (
            <TabsTrigger value="acumulados" className="flex items-center gap-2">
              ⚠️ Acumulados
              <span className="text-xs bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100 px-2 py-0.5 rounded-full">
                {accumulatedLeads.length}
              </span>
            </TabsTrigger>
          )}
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
            aprovadosAttendees={aprovadosData}
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

        <TabsContent value="acumulados">
          <R2AccumulatedList
            leads={accumulatedLeads}
            isLoading={accumulatedLoading}
            onSchedule={handleScheduleAccumulated}
            onEncaixar={handleEncaixarAccumulated}
            isEncaixando={encaixarMutation.isPending}
            encaixandoId={encaixandoId}
          />
        </TabsContent>

        <TabsContent value="aprovados">
          <R2AprovadosList 
            attendees={aprovadosData} 
            isLoading={aprovadosLoading}
            weekStart={weekStart}
            weekEnd={weekEnd}
          />
        </TabsContent>

        <TabsContent value="vendas">
          <R2VendasList 
            weekStart={weekStart} 
            weekEnd={weekEnd}
            filteredVendas={selectedCarrinhoId ? vendasData : undefined}
            carrinhoConfig={config}
          />
        </TabsContent>

        <TabsContent value="metricas">
          <R2MetricsPanel weekStart={weekStart} weekEnd={weekEnd} carrinhoConfig={config} previousConfig={prevConfig} aprovadosOverride={kpis?.aprovados} />
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

      {/* Carrinho Config Dialog */}
      <CarrinhoConfigDialog
        open={configDialogOpen}
        onOpenChange={setConfigDialogOpen}
        config={config}
        onSave={(newConfig) => saveConfig.mutate(newConfig)}
        isSaving={saveConfig.isPending}
        weekStart={weekStart}
        weekEnd={weekEnd}
        onCopyFromPrevious={handleCopyFromPrevious}
        isCopying={copyFromPreviousWeek.isPending}
      />

      {/* Quick Schedule Modal for accumulated leads */}
      <R2QuickScheduleModal
        open={scheduleModalOpen}
        onOpenChange={(open) => {
          setScheduleModalOpen(open);
          if (!open) setSelectedAccLead(null);
        }}
        closers={r2Closers}
        statusOptions={statusOptions}
        thermometerOptions={thermometerOptions}
        preselectedDeal={selectedAccLead?.deal_id ? {
          id: selectedAccLead.deal_id,
          name: selectedAccLead.deal_name || selectedAccLead.attendee_name || '',
          contact: selectedAccLead.contact_id ? {
            id: selectedAccLead.contact_id,
            name: selectedAccLead.attendee_name || '',
            phone: selectedAccLead.attendee_phone || selectedAccLead.contact_phone || null,
            email: selectedAccLead.contact_email || null,
          } : null,
        } : undefined}
      />
    </div>
  );
}
