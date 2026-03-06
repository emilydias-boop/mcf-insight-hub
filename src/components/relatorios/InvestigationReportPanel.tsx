import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DatePickerCustom } from '@/components/ui/DatePickerCustom';
import { Search, Download, Users, CheckCircle, XCircle, FileCheck, Calendar, User, ShoppingCart, Tag } from 'lucide-react';
import { useGestorClosers } from '@/hooks/useGestorClosers';
import { useInvestigationByCloser, useInvestigationByLead, InvestigationAttendee, LeadProfile, LeadFinancials } from '@/hooks/useInvestigationReport';
import { formatMeetingStatus } from '@/utils/formatMeetingStatus';
import { BusinessUnit } from '@/hooks/useMyBU';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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

function MetricCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
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

export function InvestigationReportPanel({ bu }: InvestigationReportPanelProps) {
  const [tab, setTab] = useState('closer');
  const [closerId, setCloserId] = useState<string | null>(null);
  const [date, setDate] = useState<Date | null>(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const { data: closers = [] } = useGestorClosers();
  const closerQuery = useInvestigationByCloser(tab === 'closer' ? closerId : null, tab === 'closer' ? date : null);
  const leadQuery = useInvestigationByLead(tab === 'lead' ? searchTerm : '');

  const activeData = tab === 'closer' ? closerQuery.data : leadQuery.data;
  const isLoading = tab === 'closer' ? closerQuery.isLoading : leadQuery.isLoading;
  const metrics = activeData?.metrics;
  const attendees = activeData?.attendees || [];
  const leadProfile = activeData?.leadProfile || null;
  const financials = activeData?.financials || null;
  const isLeadTab = tab === 'lead';

  const handleLeadSearch = () => {
    setSearchTerm(searchInput.trim());
  };

  const selectedCloserName = closers.find(c => c.id === closerId)?.name || 'closer';
  const exportFilename = tab === 'closer'
    ? `investigacao_${selectedCloserName}_${date ? format(date, 'yyyy-MM-dd') : ''}`
    : `investigacao_lead_${searchTerm}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Investigação
        </CardTitle>
        <CardDescription>
          Consulta detalhada por closer/SDR (dia específico) ou busca por lead
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
                <label className="text-sm font-medium text-muted-foreground mb-1 block">Closer</label>
                <Select value={closerId || ''} onValueChange={setCloserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um closer" />
                  </SelectTrigger>
                  <SelectContent>
                    {closers.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full sm:w-[220px]">
                <label className="text-sm font-medium text-muted-foreground mb-1 block">Data</label>
                <DatePickerCustom
                  mode="single"
                  selected={date || undefined}
                  onSelect={(d) => setDate(d as Date)}
                  placeholder="Selecione a data"
                />
              </div>
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

        {/* Metrics */}
        {metrics && metrics.total > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <MetricCard icon={Users} label="Total Leads" value={metrics.total} color="bg-primary/10 text-primary" />
            <MetricCard icon={CheckCircle} label="Realizadas" value={metrics.completed} color="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" />
            <MetricCard icon={XCircle} label="No-Shows" value={metrics.noShow} color="bg-destructive/10 text-destructive" />
            <MetricCard icon={FileCheck} label="Contrato Pago" value={metrics.contractPaid} color="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" />
            <MetricCard icon={Calendar} label="Agendadas" value={metrics.scheduled} color="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" />
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="text-center py-8 text-muted-foreground">Carregando dados...</div>
        )}

        {/* Results */}
        {!isLoading && attendees.length > 0 && (
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
        {!isLoading && attendees.length === 0 && ((tab === 'closer' && closerId && date) || (tab === 'lead' && searchTerm.length >= 3)) && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Search className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Nenhum resultado encontrado</p>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}
