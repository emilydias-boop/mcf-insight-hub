import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DatePickerCustom } from '@/components/ui/DatePickerCustom';
import { Search, Download, Users, CheckCircle, XCircle, FileCheck, Calendar, User, ShoppingCart, Tag, Percent, TrendingUp, Target } from 'lucide-react';
import { useGestorClosers } from '@/hooks/useGestorClosers';
import { useGestorSDRs } from '@/hooks/useGestorSDRs';
import { useInvestigationByCloser, useInvestigationByLead, InvestigationAttendee, LeadProfile, LeadFinancials } from '@/hooks/useInvestigationReport';
import { useInvestigationByPeriod } from '@/hooks/useInvestigationByPeriod';
import { useCloserComparison } from '@/hooks/useCloserComparison';
import { useSdrTeamTargets, SdrTarget } from '@/hooks/useSdrTeamTargets';
import { InvestigationEvolutionChart, DailyTargets } from '@/components/relatorios/InvestigationEvolutionChart';
import { InvestigationRankingChart } from '@/components/relatorios/InvestigationRankingChart';
import { InvestigationDistributionChart } from '@/components/relatorios/InvestigationDistributionChart';
import { InvestigationComparisonTable } from '@/components/relatorios/InvestigationComparisonTable';
import { MetricProgressCell } from '@/components/sdr/MetricProgressCell';
import { formatMeetingStatus } from '@/utils/formatMeetingStatus';
import { BusinessUnit } from '@/hooks/useMyBU';
import { format, startOfMonth, endOfMonth, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import * as XLSX from 'xlsx';
interface InvestigationReportPanelProps {
  bu: BusinessUnit;
}

function StatusBadge({ status }: { status: string | null }) {
  const label = formatMeetingStatus(status);
  const variant = status === 'contract_paid' ? 'default' 
    : status === 'completed' ? 'secondary'
    : status === 'no_show' ? 'destructive'
    : 'outline';
  return <Badge variant={variant}>{label}</Badge>;
}

function StageBadge({ name, color }: { name: string | null; color: string | null }) {
  if (!name) return <span className="text-muted-foreground text-xs">-</span>;
  return (
    <Badge variant="outline" style={{ borderColor: color || undefined, color: color || undefined }}>
      {name}
    </Badge>
  );
}

function MetricCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number | string; color: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function LeadProfileCard({ profile }: { profile: LeadProfile }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4 space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <User className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Perfil do Lead</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <div><span className="text-muted-foreground">Nome:</span> {profile.name || '-'}</div>
          <div><span className="text-muted-foreground">Email:</span> {profile.email || '-'}</div>
          <div><span className="text-muted-foreground">Telefone:</span> {profile.phone || '-'}</div>
          <div><span className="text-muted-foreground">Organização:</span> {profile.organization || '-'}</div>
          <div><span className="text-muted-foreground">Origem:</span> {profile.origin_name || '-'}</div>
          <div><span className="text-muted-foreground">Entrada no CRM:</span> {profile.created_at ? format(new Date(profile.created_at), 'dd/MM/yyyy', { locale: ptBR }) : '-'}</div>
        </div>
        {profile.tags && profile.tags.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap mt-1">
            <Tag className="h-3 w-3 text-muted-foreground" />
            {profile.tags.map(t => (
              <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FinancialsCard({ financials }: { financials: LeadFinancials }) {
  const formattedTotal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(financials.total_invested / 100);
  return (
    <Card>
      <CardContent className="pt-4 pb-4 space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <ShoppingCart className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Histórico Financeiro (Hubla)</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <div><span className="text-muted-foreground">Compras:</span> <span className="font-bold">{financials.purchase_count}</span></div>
          <div><span className="text-muted-foreground">Total investido:</span> <span className="font-bold">{formattedTotal}</span></div>
        </div>
        {financials.products.length > 0 && (
          <div className="text-xs text-muted-foreground mt-1">
            Produtos: {financials.products.join(', ')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AttendeeTable({ attendees, showCloser, showEnriched }: { attendees: InvestigationAttendee[]; showCloser?: boolean; showEnriched?: boolean }) {
  const nonPartner = attendees.filter(a => !a.is_partner);

  if (nonPartner.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Search className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>Nenhum resultado encontrado</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Horário</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              {showCloser && <TableHead>Closer</TableHead>}
              <TableHead>SDR</TableHead>
              {showEnriched && <TableHead>Estágio</TableHead>}
              {showEnriched && <TableHead>Origem</TableHead>}
              <TableHead>Tipo</TableHead>
              <TableHead>Obs</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {nonPartner.map(att => (
              <TableRow key={att.id}>
                <TableCell className="whitespace-nowrap text-xs">
                  {att.scheduled_at ? format(new Date(att.scheduled_at), 'dd/MM HH:mm', { locale: ptBR }) : '-'}
                </TableCell>
                <TableCell className="font-medium">{att.attendee_name || '-'}</TableCell>
                <TableCell className="text-xs">{att.attendee_phone || '-'}</TableCell>
                <TableCell className="text-xs">{att.contact_email || '-'}</TableCell>
                <TableCell><StatusBadge status={att.status} /></TableCell>
                {showCloser && <TableCell className="text-xs">{att.closer_name}</TableCell>}
                <TableCell className="text-xs">{att.sdr_name || '-'}</TableCell>
                {showEnriched && <TableCell><StageBadge name={att.deal_stage} color={att.deal_stage_color} /></TableCell>}
                {showEnriched && <TableCell className="text-xs">{att.origin_name || '-'}</TableCell>}
                <TableCell className="text-xs">{att.lead_type || '-'}</TableCell>
                <TableCell className="text-xs max-w-[150px] truncate" title={att.notes || att.closer_notes || ''}>
                  {att.closer_notes || att.notes || '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function exportToExcel(attendees: InvestigationAttendee[], filename: string, enriched?: boolean) {
  const nonPartner = attendees.filter(a => !a.is_partner);
  const rows = nonPartner.map(a => {
    const base: Record<string, string> = {
      'Data/Hora': a.scheduled_at ? format(new Date(a.scheduled_at), 'dd/MM/yyyy HH:mm') : '',
      'Nome': a.attendee_name || '',
      'Telefone': a.attendee_phone || '',
      'Email': a.contact_email || '',
      'Status': formatMeetingStatus(a.status),
      'Closer': a.closer_name,
      'SDR': a.sdr_name || '',
    };
    if (enriched) {
      base['Estágio'] = a.deal_stage || '';
      base['Origem'] = a.origin_name || '';
      base['Deal'] = a.deal_name || '';
    }
    base['Tipo'] = a.lead_type || '';
    base['Observações'] = a.closer_notes || a.notes || '';
    return base;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Investigação');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

function exportDailyToExcel(daily: import('@/hooks/useInvestigationByPeriod').DailyMetric[], filename: string) {
  const rows = daily.map(d => ({
    'Data': format(new Date(d.date + 'T12:00:00'), 'dd/MM/yyyy'),
    'Agendadas': d.agendadas,
    'Realizadas': d.realizadas,
    'No-Shows': d.noShows,
    'Contratos Pagos': d.contratosPagos,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Dia a Dia');
  XLSX.writeFile(wb, `${filename}-dia-a-dia.xlsx`);
}

export function InvestigationReportPanel({ bu }: InvestigationReportPanelProps) {
  const [tab, setTab] = useState('closer');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'closer' | 'sdr'>('closer');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [singleDate, setSingleDate] = useState<Date | null>(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const { data: closers = [] } = useGestorClosers();
  const { data: sdrs = [] } = useGestorSDRs();
  const { data: teamTargets = [] } = useSdrTeamTargets('sdr_');

  const isAll = selectedId === '__all__';

  // Extract daily targets from team_targets (team-level)
  const teamDailyTargets = useMemo((): DailyTargets => {
    const findTarget = (type: string): number | undefined => {
      const t = teamTargets.find((tt: SdrTarget) => tt.target_type === type);
      return t && t.target_value > 0 ? t.target_value : undefined;
    };
    return {
      agendadas: findTarget('sdr_agendamento_dia'),
      realizadas: findTarget('sdr_r1_realizada_dia'),
      contratosPagos: findTarget('sdr_contrato_dia'),
    };
  }, [teamTargets]);

  // Calculate individual daily targets by dividing by member count
  const memberCount = selectedType === 'closer' ? closers.length : sdrs.length;
  const dailyTargets = useMemo((): DailyTargets => {
    if (isAll || memberCount === 0) return teamDailyTargets;
    return {
      agendadas: teamDailyTargets.agendadas ? Number((teamDailyTargets.agendadas / memberCount).toFixed(2)) : undefined,
      realizadas: teamDailyTargets.realizadas ? Number((teamDailyTargets.realizadas / memberCount).toFixed(2)) : undefined,
      contratosPagos: teamDailyTargets.contratosPagos ? Number((teamDailyTargets.contratosPagos / memberCount).toFixed(2)) : undefined,
    };
  }, [teamDailyTargets, isAll, memberCount]);

  // Calculate days in period for target scaling
  const daysInPeriod = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return 1;
    return differenceInCalendarDays(dateRange.to, dateRange.from) + 1;
  }, [dateRange]);

  // Period target = daily target * days
  const periodTargets = useMemo(() => ({
    agendadas: dailyTargets.agendadas ? dailyTargets.agendadas * daysInPeriod : 0,
    realizadas: dailyTargets.realizadas ? dailyTargets.realizadas * daysInPeriod : 0,
    contratosPagos: dailyTargets.contratosPagos ? dailyTargets.contratosPagos * daysInPeriod : 0,
  }), [dailyTargets, daysInPeriod]);

  // Original single-day query for table data (only for individual closers)
  const closerQuery = useInvestigationByCloser(
    tab === 'closer' && selectedType === 'closer' && !isAll ? selectedId : null,
    tab === 'closer' && !isAll ? singleDate : null
  );
  const leadQuery = useInvestigationByLead(tab === 'lead' ? searchTerm : '');

  // Period-based queries for charts
  const periodQuery = useInvestigationByPeriod(
    tab === 'closer' ? selectedId : null,
    selectedType,
    dateRange?.from || null,
    dateRange?.to || null
  );
  const comparisonQuery = useCloserComparison(
    tab === 'closer' ? dateRange?.from || null : null,
    tab === 'closer' ? dateRange?.to || null : null,
    selectedId,
    selectedType
  );

  const activeData = tab === 'closer' ? closerQuery.data : leadQuery.data;
  const isLoading = tab === 'closer' ? closerQuery.isLoading : leadQuery.isLoading;
  const metrics = activeData?.metrics;
  const attendees = activeData?.attendees || [];
  const leadProfile = activeData?.leadProfile || null;
  const financials = activeData?.financials || null;
  const isLeadTab = tab === 'lead';

  const periodData = periodQuery.data;
  const comparisonData = comparisonQuery.data || [];
  const handleLeadSearch = () => {
    setSearchTerm(searchInput.trim());
  };

  const handlePersonSelect = (value: string) => {
    const [type, ...rest] = value.split(':');
    const id = rest.join(':');
    setSelectedType(type as 'closer' | 'sdr');
    setSelectedId(id);
  };

  const selectedValue = selectedId ? `${selectedType}:${selectedId}` : '';
  const selectedName = isAll
    ? (selectedType === 'closer' ? 'Todos os Closers' : 'Todos os SDRs')
    : selectedType === 'closer'
      ? closers.find(c => c.id === selectedId)?.name
      : sdrs.find(s => s.id === selectedId)?.name;

  const exportFilename = tab === 'closer'
    ? `investigacao_${selectedName || 'closer'}_${singleDate ? format(singleDate, 'yyyy-MM-dd') : ''}`
    : `investigacao_lead_${searchTerm}`;

  const showPeriodData = !isLeadTab && selectedId && periodData && periodData.summary.total > 0;
  const rankingTitle = selectedType === 'closer' ? 'Ranking de Closers' : 'Ranking de SDRs';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Investigação
        </CardTitle>
        <CardDescription>
          Performance por closer/SDR com evolução no período, ou busca por lead
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="closer">Por Closer / SDR</TabsTrigger>
            <TabsTrigger value="lead">Por Lead</TabsTrigger>
          </TabsList>

          <TabsContent value="closer" className="space-y-4 mt-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="text-sm font-medium text-muted-foreground mb-1 block">Closer / SDR</label>
                <Select value={selectedValue} onValueChange={handlePersonSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um closer, SDR ou todos" />
                  </SelectTrigger>
                  <SelectContent>
                    {closers.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>Closers</SelectLabel>
                        <SelectItem value="closer:__all__">
                          <span className="font-semibold">📊 Todos os Closers</span>
                        </SelectItem>
                        {closers.map(c => (
                          <SelectItem key={`closer:${c.id}`} value={`closer:${c.id}`}>{c.name}</SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                    {sdrs.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>SDRs</SelectLabel>
                        <SelectItem value="sdr:__all__">
                          <span className="font-semibold">📊 Todos os SDRs</span>
                        </SelectItem>
                        {sdrs.map(s => (
                          <SelectItem key={`sdr:${s.id}`} value={`sdr:${s.id}`}>{s.name}</SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full sm:w-[300px]">
                <label className="text-sm font-medium text-muted-foreground mb-1 block">Período</label>
                <DatePickerCustom
                  mode="range"
                  selected={dateRange}
                  onSelect={(d) => setDateRange(d as DateRange)}
                  placeholder="Selecione o período"
                />
              </div>
              {!isAll && selectedType === 'closer' && (
                <div className="w-full sm:w-[200px]">
                  <label className="text-sm font-medium text-muted-foreground mb-1 block">Dia (tabela)</label>
                  <DatePickerCustom
                    mode="single"
                    selected={singleDate || undefined}
                    onSelect={(d) => setSingleDate(d as Date)}
                    placeholder="Selecione o dia"
                  />
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="lead" className="space-y-4 mt-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-sm font-medium text-muted-foreground mb-1 block">Buscar lead (nome ou telefone)</label>
                <Input
                  placeholder="Digite o nome ou telefone do lead..."
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLeadSearch()}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={handleLeadSearch} disabled={searchInput.trim().length < 3}>
                  <Search className="h-4 w-4 mr-2" />
                  Buscar
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Lead Profile & Financials Cards */}
        {isLeadTab && (leadProfile || financials) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {leadProfile && <LeadProfileCard profile={leadProfile} />}
            {financials && <FinancialsCard financials={financials} />}
          </div>
        )}

        {/* Period KPIs + Charts (closer/sdr tab only) */}
        {showPeriodData && (
          <div className="space-y-4">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              <MetricCard icon={Users} label="Total Leads" value={periodData.summary.total} color="bg-primary/10 text-primary" />
              <MetricCard icon={CheckCircle} label="Realizadas" value={periodData.summary.realizadas} color="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" />
              <MetricCard icon={XCircle} label="No-Shows" value={periodData.summary.noShows} color="bg-destructive/10 text-destructive" />
              <MetricCard icon={FileCheck} label="Contrato Pago" value={periodData.summary.contratosPagos} color="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" />
              <MetricCard icon={Calendar} label="Agendadas" value={periodData.summary.agendadas} color="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" />
              <MetricCard icon={Percent} label="Comparecimento" value={`${periodData.summary.taxaComparecimento.toFixed(1)}%`} color="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" />
              <MetricCard icon={TrendingUp} label="Conversão" value={`${periodData.summary.taxaConversao.toFixed(1)}%`} color="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" />
              <MetricCard icon={XCircle} label="Taxa No-Show" value={`${periodData.summary.taxaNoShow.toFixed(1)}%`} color="bg-destructive/10 text-destructive" />
            </div>

            {/* Target Progress Cards */}
            {(dailyTargets.agendadas || dailyTargets.realizadas || dailyTargets.contratosPagos) && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Atingimento de Meta {isAll ? '(Time)' : '(Individual)'} — {daysInPeriod === 1 ? 'Diária' : `${daysInPeriod} dias`}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {dailyTargets.agendadas && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium">Agendadas</p>
                        <MetricProgressCell value={periodData.summary.total} target={periodTargets.agendadas} />
                      </div>
                    )}
                    {dailyTargets.realizadas && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium">Realizadas</p>
                        <MetricProgressCell value={periodData.summary.realizadas + periodData.summary.contratosPagos} target={periodTargets.realizadas} />
                      </div>
                    )}
                    {dailyTargets.contratosPagos && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium">Contratos Pagos</p>
                        <MetricProgressCell value={periodData.summary.contratosPagos} target={periodTargets.contratosPagos} />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Export daily + Charts Grid: Evolution + Distribution */}
            {periodData.daily.length > 0 && (
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => exportDailyToExcel(periodData.daily, `dia-a-dia_${selectedType}_${format(dateRange?.from || new Date(), 'yyyy-MM-dd')}`)}>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar Dia a Dia
                </Button>
              </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <InvestigationEvolutionChart data={periodData.daily} dailyTargets={dailyTargets} isIndividual={!isAll} />
              </div>
              <div>
                <InvestigationDistributionChart summary={periodData.summary} />
              </div>
            </div>

            {/* Comparison Table */}
            {comparisonData.length > 0 && (
              <InvestigationComparisonTable
                data={comparisonData}
                highlightId={isAll ? null : selectedId}
                title={`Comparativo - ${selectedType === 'closer' ? 'Closers' : 'SDRs'}`}
                dailyTargets={dailyTargets}
                daysInPeriod={daysInPeriod}
              />
            )}

            {/* Ranking Chart */}
            {comparisonData.length > 1 && (
              <InvestigationRankingChart
                data={comparisonData}
                highlightId={isAll ? null : selectedId}
                title={rankingTitle}
              />
            )}
          </div>
        )}

        {/* Period loading */}
        {!isLeadTab && selectedId && periodQuery.isLoading && (
          <div className="text-center py-4 text-muted-foreground text-sm">Carregando dados do período...</div>
        )}

        {/* Metrics for single-day table (individual closer only) */}
        {!isLeadTab && !isAll && selectedType === 'closer' && metrics && metrics.total > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">
              Detalhamento do dia {singleDate ? format(singleDate, 'dd/MM/yyyy', { locale: ptBR }) : ''}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <MetricCard icon={Users} label="Total Leads" value={metrics.total} color="bg-primary/10 text-primary" />
              <MetricCard icon={CheckCircle} label="Realizadas" value={metrics.completed} color="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" />
              <MetricCard icon={XCircle} label="No-Shows" value={metrics.noShow} color="bg-destructive/10 text-destructive" />
              <MetricCard icon={FileCheck} label="Contrato Pago" value={metrics.contractPaid} color="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" />
              <MetricCard icon={Calendar} label="Agendadas" value={metrics.scheduled} color="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" />
            </div>
          </div>
        )}

        {/* Lead tab metrics */}
        {isLeadTab && metrics && metrics.total > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <MetricCard icon={Users} label="Total Leads" value={metrics.total} color="bg-primary/10 text-primary" />
            <MetricCard icon={CheckCircle} label="Realizadas" value={metrics.completed} color="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" />
            <MetricCard icon={XCircle} label="No-Shows" value={metrics.noShow} color="bg-destructive/10 text-destructive" />
            <MetricCard icon={FileCheck} label="Contrato Pago" value={metrics.contractPaid} color="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" />
            <MetricCard icon={Calendar} label="Agendadas" value={metrics.scheduled} color="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" />
          </div>
        )}

        {/* Loading */}
        {isLoading && !isAll && (
          <div className="text-center py-8 text-muted-foreground">Carregando dados...</div>
        )}

        {/* Results Table (individual closer only) */}
        {!isLoading && !isAll && attendees.length > 0 && (
          <>
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => exportToExcel(attendees, exportFilename, isLeadTab)}>
                <Download className="h-4 w-4 mr-2" />
                Exportar Excel
              </Button>
            </div>
            <AttendeeTable attendees={attendees} showCloser={isLeadTab} showEnriched={isLeadTab} />
          </>
        )}

        {/* Empty state */}
        {!isLoading && !isAll && attendees.length === 0 && ((tab === 'closer' && selectedId && singleDate && selectedType === 'closer') || (tab === 'lead' && searchTerm.length >= 3)) && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Search className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Nenhum resultado encontrado para o dia selecionado</p>
            </CardContent>
          </Card>
        )}

        {/* Empty period state */}
        {!isLeadTab && selectedId && !periodQuery.isLoading && periodData && periodData.summary.total === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Nenhum dado encontrado no período selecionado</p>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}
