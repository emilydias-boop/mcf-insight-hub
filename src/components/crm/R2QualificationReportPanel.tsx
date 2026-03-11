import { useState, useMemo, useCallback } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { FileSpreadsheet, Loader2, BarChart3, Copy, History, Check, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DatePickerCustom } from '@/components/ui/DatePickerCustom';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';

import { useR2QualificationReport, useR2Closers, R2QualificationReportRow } from '@/hooks/useR2QualificationReport';
import { useUpdateDealCustomFields } from '@/hooks/useUpdateDealCustomFields';
import { R2ReportLeadHistoryDialog } from '@/components/crm/R2ReportLeadHistoryDialog';
import { ESTADO_OPTIONS, PROFISSAO_OPTIONS } from '@/components/crm/qualification/QualificationFields';
import { RENDA_OPTIONS, JA_CONSTROI_OPTIONS, TERRENO_OPTIONS, IMOVEL_OPTIONS, TEMPO_CONHECE_MCF_OPTIONS } from '@/types/r2Agenda';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const COLORS = ['#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#6366F1', '#14B8A6', '#F97316', '#06B6D4', '#84CC16'];

function groupBy<T>(arr: T[], key: keyof T): Record<string, number> {
  return arr.reduce((acc, item) => {
    const value = String(item[key] || 'Não informado');
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

function toChartData(grouped: Record<string, number>): { name: string; value: number }[] {
  return Object.entries(grouped)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendada',
  completed: 'Realizada',
  no_show: 'No-show',
  rescheduled: 'Reagendada',
  contract_paid: 'Contrato Pago',
  canceled: 'Cancelada',
  refunded: 'Reembolso',
};

// Qualification column filter options
interface QualificationColumnFilters {
  estado: string;
  renda: string;
  profissao: string;
  jaConstroi: string;
  terreno: string;
  imovel: string;
  tempoMcf: string;
}

const EMPTY_FILTERS: QualificationColumnFilters = {
  estado: 'all',
  renda: 'all',
  profissao: 'all',
  jaConstroi: 'all',
  terreno: 'all',
  imovel: 'all',
  tempoMcf: 'all',
};

// Editable cell component
function EditableSelectCell({
  value,
  options,
  dealId,
  fieldKey,
  onSave,
}: {
  value: string | null;
  options: { value: string; label: string }[];
  dealId: string | null;
  fieldKey: string;
  onSave: (dealId: string, key: string, val: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (!dealId) return <span className="text-muted-foreground">-</span>;

  if (editing) {
    return (
      <Select
        defaultValue={value || ''}
        onValueChange={(v) => {
          onSave(dealId, fieldKey, v);
          setEditing(false);
        }}
      >
        <SelectTrigger className="h-7 text-xs w-[130px]">
          <SelectValue placeholder="Selecione" />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="text-left hover:bg-accent/50 rounded px-1 py-0.5 cursor-pointer transition-colors w-full text-xs"
      title="Clique para editar"
    >
      {value || <span className="text-muted-foreground">-</span>}
    </button>
  );
}

function EditableTextCell({
  value,
  dealId,
  fieldKey,
  onSave,
}: {
  value: string | null;
  dealId: string | null;
  fieldKey: string;
  onSave: (dealId: string, key: string, val: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value || '');

  if (!dealId) return <span className="text-muted-foreground">-</span>;

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="h-7 text-xs w-[100px]"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onSave(dealId, fieldKey, text);
              setEditing(false);
            }
            if (e.key === 'Escape') setEditing(false);
          }}
        />
        <button onClick={() => { onSave(dealId, fieldKey, text); setEditing(false); }} className="text-green-600"><Check className="h-3 w-3" /></button>
        <button onClick={() => setEditing(false)} className="text-red-600"><X className="h-3 w-3" /></button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="text-left hover:bg-accent/50 rounded px-1 py-0.5 cursor-pointer transition-colors w-full text-xs"
      title="Clique para editar"
    >
      {value || <span className="text-muted-foreground">-</span>}
    </button>
  );
}

export function R2QualificationReportPanel() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [closerFilter, setCloserFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [colFilters, setColFilters] = useState<QualificationColumnFilters>(EMPTY_FILTERS);
  const [historyDeal, setHistoryDeal] = useState<{ dealId: string; name: string | null; email: string | null } | null>(null);

  const { data: closers = [] } = useR2Closers();
  const { data: rawData = [], isLoading, isFetching, dataUpdatedAt } = useR2QualificationReport({
    startDate: dateRange?.from || startOfMonth(new Date()),
    endDate: dateRange?.to || endOfMonth(new Date()),
    closerId: closerFilter !== 'all' ? closerFilter : undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  });

  const updateDeal = useUpdateDealCustomFields();

  const handleFieldSave = useCallback((dealId: string, fieldKey: string, value: string) => {
    updateDeal.mutate({ dealId, customFields: { [fieldKey]: value } }, {
      onSuccess: () => toast.success('Campo atualizado'),
    });
  }, [updateDeal]);

  // Apply column filters
  const data = useMemo(() => {
    return rawData.filter((row) => {
      if (colFilters.estado !== 'all' && row.estado !== colFilters.estado) return false;
      if (colFilters.renda !== 'all' && row.renda !== colFilters.renda) return false;
      if (colFilters.profissao !== 'all' && row.profissao !== colFilters.profissao) return false;
      if (colFilters.jaConstroi !== 'all' && row.jaConstroi !== colFilters.jaConstroi) return false;
      if (colFilters.terreno !== 'all' && row.terreno !== colFilters.terreno) return false;
      if (colFilters.imovel !== 'all' && row.imovel !== colFilters.imovel) return false;
      if (colFilters.tempoMcf !== 'all' && row.tempoMcf !== colFilters.tempoMcf) return false;
      return true;
    });
  }, [rawData, colFilters]);

  const hasActiveColFilters = Object.values(colFilters).some((v) => v !== 'all');

  // Aggregations
  const estadoStats = useMemo(() => toChartData(groupBy(data, 'estado')), [data]);
  const rendaStats = useMemo(() => toChartData(groupBy(data, 'renda')), [data]);
  const profissaoStats = useMemo(() => toChartData(groupBy(data, 'profissao')), [data]);
  const jaConstruiStats = useMemo(() => toChartData(groupBy(data, 'jaConstroi')), [data]);
  const terrenoStats = useMemo(() => toChartData(groupBy(data, 'terreno')), [data]);

  const totalLeads = data.length;
  const completedCount = data.filter((r) => r.status === 'completed' || r.status === 'contract_paid').length;
  const noShowCount = data.filter((r) => r.status === 'no_show').length;
  const conversionRate = totalLeads > 0 ? ((completedCount / totalLeads) * 100).toFixed(1) : '0';

  // Export filtered data
  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(
      data.map((row) => ({
        Nome: row.leadName,
        Telefone: row.phone,
        Email: row.email,
        'Data Reunião': format(new Date(row.scheduledAt), 'dd/MM/yyyy'),
        Horário: format(new Date(row.scheduledAt), 'HH:mm'),
        Status: STATUS_LABELS[row.status] || row.status,
        'Sócio R2': row.closerName,
        'SDR Responsável': row.sdrName,
        Estado: row.estado,
        Profissão: row.profissao,
        Renda: row.renda,
        Idade: row.idade,
        'Já Constrói': row.jaConstroi,
        'Tem Terreno': row.terreno,
        'Tem Imóvel': row.imovel,
        'Conhece MCF': row.tempoMcf,
        'Tem Sócio': row.temSocio === true ? 'Sim' : row.temSocio === false ? 'Não' : '',
        'Nome Sócio': row.nomeSocio,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Qualificação R2');
    XLSX.writeFile(wb, `qualificacao_r2_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const handleCopy = () => {
    const lines = data.map((r) => `${r.leadName || '-'}\t${r.phone || '-'}\t${r.email || '-'}`);
    const header = 'Nome\tTelefone\tEmail';
    navigator.clipboard.writeText([header, ...lines].join('\n'));
    toast.success(`${data.length} leads copiados para o clipboard`);
  };

  // Select filter helper
  const ColFilter = ({ field, options, label }: { field: keyof QualificationColumnFilters; options: { value: string; label: string }[]; label: string }) => (
    <Select value={colFilters[field]} onValueChange={(v) => setColFilters((prev) => ({ ...prev, [field]: v }))}>
      <SelectTrigger className="h-8 text-xs w-[130px]">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const estadoOpts = ESTADO_OPTIONS.map((s) => ({ value: s, label: s }));
  const profissaoOpts = PROFISSAO_OPTIONS.map((s) => ({ value: s, label: s }));
  const rendaOpts = RENDA_OPTIONS.map((o) => ({ value: o.label, label: o.label }));
  const jaConstruiOpts = JA_CONSTROI_OPTIONS.map((o) => ({ value: o.label, label: o.label }));
  const terrenoOpts = TERRENO_OPTIONS.map((o) => ({ value: o.label, label: o.label }));
  const imovelOpts = IMOVEL_OPTIONS.map((o) => ({ value: o.label, label: o.label }));
  const tempoMcfOpts = TEMPO_CONHECE_MCF_OPTIONS.map((o) => ({ value: o.label, label: o.label }));

  return (
    <div className="space-y-6">
      {/* Main Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Período</label>
              <DatePickerCustom
                mode="range"
                selected={dateRange}
                onSelect={(value) => setDateRange(value as DateRange)}
                placeholder="Selecione o período"
              />
            </div>
            <div className="min-w-[180px]">
              <label className="text-sm font-medium mb-2 block">Sócio R2</label>
              <Select value={closerFilter} onValueChange={setCloserFilter}>
                <SelectTrigger><SelectValue placeholder="Filtrar closer" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {closers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[150px]">
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="scheduled">Agendadas</SelectItem>
                  <SelectItem value="completed">Realizadas</SelectItem>
                  <SelectItem value="no_show">No-show</SelectItem>
                  <SelectItem value="contract_paid">Contrato Pago</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              {isFetching && !isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              <span className="text-xs text-muted-foreground">
                {format(new Date(dataUpdatedAt), 'HH:mm:ss', { locale: ptBR })}
              </span>
              <Button size="sm" variant="outline" onClick={handleCopy} disabled={data.length === 0}>
                <Copy className="h-4 w-4 mr-1" /> Copiar
              </Button>
              <Button size="sm" onClick={handleExport} disabled={data.length === 0}>
                <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{totalLeads}</div><div className="text-sm text-muted-foreground">Total de Leads</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-green-600">{completedCount}</div><div className="text-sm text-muted-foreground">Realizadas</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-red-600">{noShowCount}</div><div className="text-sm text-muted-foreground">No-shows</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-purple-600">{conversionRate}%</div><div className="text-sm text-muted-foreground">Taxa Conversão</div></CardContent></Card>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-[300px] w-full" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      ) : (
        <>
          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Por Estado</CardTitle></CardHeader>
              <CardContent>
                {estadoStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={estadoStats} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={false}>
                        {estadoStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <div className="h-[200px] flex items-center justify-center text-muted-foreground">Sem dados</div>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Por Renda</CardTitle></CardHeader>
              <CardContent>
                {rendaStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={rendaStats} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} /><Tooltip />
                      <Bar dataKey="value" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="h-[200px] flex items-center justify-center text-muted-foreground">Sem dados</div>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Por Profissão</CardTitle></CardHeader>
              <CardContent>
                {profissaoStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={profissaoStats} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} /><Tooltip />
                      <Bar dataKey="value" fill="#EC4899" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="h-[200px] flex items-center justify-center text-muted-foreground">Sem dados</div>}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Já Constrói?</CardTitle></CardHeader>
              <CardContent>
                {jaConstruiStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={jaConstruiStats} cx="50%" cy="50%" outerRadius={60} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                        {jaConstruiStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie><Tooltip /><Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <div className="h-[180px] flex items-center justify-center text-muted-foreground">Sem dados</div>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Tem Terreno?</CardTitle></CardHeader>
              <CardContent>
                {terrenoStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={terrenoStats} cx="50%" cy="50%" outerRadius={60} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                        {terrenoStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie><Tooltip /><Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <div className="h-[180px] flex items-center justify-center text-muted-foreground">Sem dados</div>}
              </CardContent>
            </Card>
          </div>

          {/* Column Filters */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Dados Detalhados ({data.length} registros{hasActiveColFilters ? ` — filtrado de ${rawData.length}` : ''})
                </CardTitle>
                {hasActiveColFilters && (
                  <Button size="sm" variant="ghost" onClick={() => setColFilters(EMPTY_FILTERS)} className="text-xs">
                    Limpar filtros
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-3">
                <ColFilter field="estado" options={estadoOpts} label="Estado" />
                <ColFilter field="renda" options={rendaOpts} label="Renda" />
                <ColFilter field="profissao" options={profissaoOpts} label="Profissão" />
                <ColFilter field="jaConstroi" options={jaConstruiOpts} label="Já Constrói" />
                <ColFilter field="terreno" options={terrenoOpts} label="Terreno" />
                <ColFilter field="imovel" options={imovelOpts} label="Imóvel" />
                <ColFilter field="tempoMcf" options={tempoMcfOpts} label="Tempo MCF" />
              </div>

              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sócio R2</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Renda</TableHead>
                      <TableHead>Profissão</TableHead>
                      <TableHead>Já Constrói</TableHead>
                      <TableHead>Terreno</TableHead>
                      <TableHead>Imóvel</TableHead>
                      <TableHead>Tempo MCF</TableHead>
                      <TableHead>Idade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={14} className="text-center text-muted-foreground py-8">
                          Nenhum dado encontrado para os filtros selecionados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="p-1">
                            {row.dealId && (
                              <button
                                onClick={() => setHistoryDeal({ dealId: row.dealId!, name: row.leadName, email: row.email })}
                                className="p-1 rounded hover:bg-accent transition-colors"
                                title="Ver histórico"
                              >
                                <History className="h-3.5 w-3.5 text-muted-foreground" />
                              </button>
                            )}
                          </TableCell>
                          <TableCell className="font-medium text-xs">{row.leadName || '-'}</TableCell>
                          <TableCell className="text-xs">{row.phone || '-'}</TableCell>
                          <TableCell className="text-xs">
                            {format(new Date(row.scheduledAt), 'dd/MM/yy HH:mm', { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={
                              row.status === 'completed' ? 'bg-green-500/10 text-green-600 border-green-500/20'
                                : row.status === 'no_show' ? 'bg-red-500/10 text-red-600 border-red-500/20'
                                  : row.status === 'contract_paid' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                    : 'bg-purple-500/10 text-purple-600 border-purple-500/20'
                            }>
                              {STATUS_LABELS[row.status] || row.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">{row.closerName || '-'}</TableCell>
                          <TableCell>
                            <EditableSelectCell value={row.estado} options={estadoOpts} dealId={row.dealId} fieldKey="estado" onSave={handleFieldSave} />
                          </TableCell>
                          <TableCell>
                            <EditableSelectCell value={row.renda} options={rendaOpts} dealId={row.dealId} fieldKey="renda" onSave={handleFieldSave} />
                          </TableCell>
                          <TableCell>
                            <EditableSelectCell value={row.profissao} options={profissaoOpts} dealId={row.dealId} fieldKey="profissao" onSave={handleFieldSave} />
                          </TableCell>
                          <TableCell>
                            <EditableSelectCell value={row.jaConstroi} options={jaConstruiOpts} dealId={row.dealId} fieldKey="ja_constroi" onSave={handleFieldSave} />
                          </TableCell>
                          <TableCell>
                            <EditableSelectCell value={row.terreno} options={terrenoOpts} dealId={row.dealId} fieldKey="terreno" onSave={handleFieldSave} />
                          </TableCell>
                          <TableCell>
                            <EditableSelectCell value={row.imovel} options={imovelOpts} dealId={row.dealId} fieldKey="possui_imovel" onSave={handleFieldSave} />
                          </TableCell>
                          <TableCell>
                            <EditableSelectCell value={row.tempoMcf} options={tempoMcfOpts} dealId={row.dealId} fieldKey="tempo_conhece_mcf" onSave={handleFieldSave} />
                          </TableCell>
                          <TableCell>
                            <EditableTextCell value={row.idade} dealId={row.dealId} fieldKey="idade" onSave={handleFieldSave} />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      )}

      {/* History Dialog */}
      {historyDeal && (
        <R2ReportLeadHistoryDialog
          open={!!historyDeal}
          onOpenChange={(open) => !open && setHistoryDeal(null)}
          dealId={historyDeal.dealId}
          leadName={historyDeal.name}
          contactEmail={historyDeal.email}
        />
      )}
    </div>
  );
}
