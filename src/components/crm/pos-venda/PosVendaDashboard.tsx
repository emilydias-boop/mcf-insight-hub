import { useMemo, useState } from 'react';
import { Activity, AlertTriangle, Calendar, Info, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getPeriodRange, PeriodType } from '@/components/crm/FunilDashboard';
import { usePosVendaOverview, PosVendaMetrics } from '@/hooks/usePosVendaOverview';

const HINTS: Record<keyof PosVendaMetrics, string> = {
  entraram: 'Clientes que entraram na etapa "Novos licenciados" no período (card criado nessa etapa ou movido para ela).',
  trabalhados: 'Clientes com contato no período: ligação com mais de 60 segundos, nota, nota de contato, WhatsApp ou envio registrado no card.',
  semToque: 'Clientes que estão hoje em "Novos licenciados" e ainda não foram encaminhados para Consórcio ou Crédito.',
  avancados: 'Clientes encaminhados no período para Consórcio ou Crédito Imobiliário (botão de envio ao concluir a viabilidade).',
  abertos: 'Clientes hoje em "Reunião de Viabilidade 1" sem nenhuma nota e sem anexos de entregáveis.',
  parados: 'Clientes sem nenhuma atividade feita por pessoa (ligação, nota, mudança de etapa…). Anamnese, entrada automática e etiquetas não contam.',
  envelhecidos: 'Clientes não encaminhados cujo último contato (ou a entrada, se nunca houve contato) foi há mais de 15 dias.',
  tempoMedioSemMovHoras: 'Média de tempo desde a última mudança de etapa dos clientes ainda não encaminhados.',
  agendadas: 'Reuniões da Agenda de Reuniões — Viabilidade no período com status "Agendada", pelo gerente marcado na reunião.',
  realizadas: 'Reuniões da Agenda de Viabilidade no período com status "Realizada".',
  noShow: 'Reuniões da Agenda de Viabilidade no período com status "No-show".',
  reagendamentos: 'Reuniões canceladas na Agenda de Viabilidade em que o mesmo cliente ganhou uma nova reunião depois.',
  concluidas: 'Clientes levados para "Viabilidade Concluída" no período, contados para quem moveu o card.',
};

const Hint = ({ k }: { k: keyof PosVendaMetrics }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button type="button" aria-label="De onde vem o dado" className="inline-flex shrink-0 items-center">
        <Info className="h-[13px] w-[13px] shrink-0 text-muted-foreground" />
      </button>
    </TooltipTrigger>
    <TooltipContent
      side="top"
      sideOffset={6}
      className="max-w-[340px] min-w-[220px] whitespace-normal px-3 py-2 text-[11px] leading-[1.45]"
    >
      {HINTS[k]}
    </TooltipContent>
  </Tooltip>
);

const fmtTempo = (h: number) => (h < 24 ? `${h}h` : `${Math.round(h / 24)}d`);

function Kpi({ k, label, value, cls = 'text-foreground' }: { k: keyof PosVendaMetrics; label: string; value: string | number; cls?: string }) {
  return (
    <div className="text-center p-2 rounded-md bg-muted/50">
      <p className={`text-2xl font-bold ${cls}`}>{value}</p>
      <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">{label} <Hint k={k} /></p>
    </div>
  );
}

const COLS: { k: keyof PosVendaMetrics; label: string }[] = [
  { k: 'entraram', label: 'Entraram' }, { k: 'trabalhados', label: 'Trabalhados' }, { k: 'semToque', label: 'Sem toque' },
  { k: 'avancados', label: 'Avançados' }, { k: 'abertos', label: 'Abertos' }, { k: 'parados', label: 'Parados' },
  { k: 'envelhecidos', label: 'Envelhecidos' }, { k: 'agendadas', label: 'Agendadas' }, { k: 'realizadas', label: 'Realizadas' },
  { k: 'noShow', label: 'No-show' }, { k: 'reagendamentos', label: 'Reagend.' }, { k: 'concluidas', label: 'Viab. concluídas' },
];

export function PosVendaDashboard() {
  const [period, setPeriod] = useState<PeriodType>('week');
  const [porGerente, setPorGerente] = useState(false);
  const { start, end, label } = useMemo(() => getPeriodRange(period), [period]);
  const { data, isLoading } = usePosVendaOverview(start, end);
  const t = data?.total;

  return (
    <TooltipProvider delayDuration={100}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Período:</span>
            <span className="text-sm text-muted-foreground">{label}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant={porGerente ? 'default' : 'outline'} onClick={() => setPorGerente((v) => !v)}>
              <Users className="h-4 w-4 mr-1" /> Visão por gerente
            </Button>
            <div className="flex items-center bg-muted rounded-lg p-1 gap-0.5">
              {(['today', 'week', 'month'] as PeriodType[]).map((p) => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${period === p ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                  {p === 'today' ? 'Hoje' : p === 'week' ? 'Semana' : 'Mês'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {isLoading || !t ? <Skeleton className="h-64 w-full rounded-lg" /> : porGerente ? (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" />Produtividade por gerente</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Gerente</TableHead>
                  {COLS.map((c) => <TableHead key={c.k} className="text-center whitespace-nowrap"><span className="inline-flex items-center gap-1">{c.label}<Hint k={c.k} /></span></TableHead>)}
                </TableRow></TableHeader>
                <TableBody>
                  {data!.gerentes.map((g) => (
                    <TableRow key={g.email}>
                      <TableCell className="whitespace-nowrap font-medium">{g.nome}</TableCell>
                      {COLS.map((c) => <TableCell key={c.k} className="text-center">{g[c.k]}</TableCell>)}
                    </TableRow>
                  ))}
                  <TableRow className="font-bold">
                    <TableCell>Total</TableCell>
                    {COLS.map((c) => <TableCell key={c.k} className="text-center">{t[c.k]}</TableCell>)}
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" />Saúde da Pipeline</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">No período</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Kpi k="entraram" label="Entraram" value={t.entraram} />
                  <Kpi k="trabalhados" label="Já trabalhados" value={t.trabalhados} cls="text-primary" />
                  <Kpi k="semToque" label="Sem toque" value={t.semToque} cls="text-warning" />
                  <Kpi k="avancados" label="Avançados" value={t.avancados} cls="text-accent-foreground" />
                </div>
              </div>
              <div className="border-t border-border pt-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Saúde geral</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Kpi k="abertos" label="Abertos (Viab. 1)" value={t.abertos} />
                  <Kpi k="parados" label="Parados" value={t.parados} cls="text-warning" />
                  <Kpi k="envelhecidos" label="Envelhecidos (15d+)" value={t.envelhecidos} cls="text-destructive" />
                  <Kpi k="tempoMedioSemMovHoras" label="Tempo Médio s/ Mov." value={fmtTempo(t.tempoMedioSemMovHoras)} />
                </div>
              </div>
              {data!.travadosPorEtapa.length > 0 && (
                <div className="border-t border-border pt-3">
                  <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5"><AlertTriangle className="h-4 w-4 text-warning" />Travados por Etapa (3d+)</p>
                  <div className="flex flex-wrap gap-2">
                    {data!.travadosPorEtapa.map((i) => <Badge key={i.stageName} variant="secondary" className="text-xs">{i.stageName}: <span className="font-bold ml-1">{i.count}</span></Badge>)}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
}
