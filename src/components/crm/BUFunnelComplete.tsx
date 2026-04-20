import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Info,
  TrendingDown,
  TrendingUp,
  Users,
  Columns2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toggle } from '@/components/ui/toggle';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { BUFunnelByChannel, BUFunnelData } from '@/hooks/useBUFunnelComplete';

interface Props {
  data: BUFunnelByChannel | null;
  isLoading: boolean;
}

type Tone = 'neutral' | 'positive' | 'negative';

interface StageRow {
  key: keyof BUFunnelData;
  label: string;
  tooltip: string;
  tone: Tone;
  indent?: boolean;
}

const STAGES: StageRow[] = [
  { key: 'universo', label: 'Universo (oportunidades únicas)', tooltip: 'Total de leads únicos por contato no escopo (BU + filtros).', tone: 'neutral' },
  { key: 'qualificados', label: 'Qualificados', tooltip: 'Leads em estágios contendo "qualificado".', tone: 'positive' },
  { key: 'semInteresse', label: 'Sem Interesse', tooltip: 'Leads em estágios "sem interesse", "perdido" ou "desqualificado".', tone: 'negative' },
  { key: 'agendadosR1', label: 'Agendados (R1)', tooltip: 'Contatos únicos com R1 agendada no período (meeting_slots type=r1).', tone: 'positive' },
  { key: 'r1Realizada', label: 'R1 Realizada', tooltip: 'R1 com status realizada/completed.', tone: 'positive', indent: true },
  { key: 'noShowR1', label: 'No-Show R1', tooltip: 'R1 com status no_show.', tone: 'negative', indent: true },
  { key: 'contratoPago', label: 'Contrato Pago', tooltip: 'Attendees com contract_paid_at OU estágio "Contrato Pago".', tone: 'positive' },
  { key: 'r2Realizada', label: 'R2 Realizada', tooltip: 'R2 com status realizada/completed.', tone: 'positive' },
  { key: 'vendasFinais', label: 'Vendas Finais', tooltip: 'hubla_transactions completed product_category=parceria, atribuída ao canal do lead.', tone: 'positive' },
];

function pct(n: number, base: number): string {
  if (!base) return '—';
  return `${((n / base) * 100).toFixed(1)}%`;
}

const CHANNEL_LABEL: Record<string, string> = {
  A010: 'A010',
  ANAMNESE: 'ANAMNESE',
  'ANAMNESE-INSTA': 'ANAMNESE-INSTA',
  LIVE: 'LIVE',
  OUTSIDE: 'OUTSIDE',
  'LANÇAMENTO': 'LANÇAMENTO',
  'BIO-INSTAGRAM': 'BIO-INSTAGRAM',
  'LEAD-FORM': 'LEAD-FORM',
  HUBLA: 'HUBLA',
  'BASE CLINT': 'BASE CLINT',
  CSV: 'CSV',
  WEBHOOK: 'WEBHOOK',
  OUTRO: 'Outros',
};

function FunnelRows({ data, baseUniverso }: { data: BUFunnelData; baseUniverso?: number }) {
  const universoRef = baseUniverso ?? data.universo;
  return (
    <div className="space-y-1.5">
      {STAGES.map((s) => {
        const value = data[s.key];
        const isTop = s.key === 'universo';
        const pctTopo = isTop && !baseUniverso ? '100%' : pct(value, universoRef);
        const widthPct = universoRef
          ? Math.max(value > 0 ? 8 : 0, Math.min(100, (value / universoRef) * 100))
          : 0;
        return (
          <div
            key={s.key}
            className={cn(
              'relative flex items-center gap-3 rounded-md border bg-card px-3 py-2',
              s.indent && 'ml-6',
            )}
          >
            <div
              className={cn(
                'absolute inset-y-0 left-0 rounded-md opacity-15',
                s.tone === 'positive' && 'bg-primary',
                s.tone === 'negative' && 'bg-destructive',
                s.tone === 'neutral' && 'bg-muted-foreground',
              )}
              style={{ width: `${widthPct}%` }}
            />
            <div className="relative flex-1 min-w-0 flex items-center gap-2">
              <span className={cn('text-sm font-medium truncate', isTop && 'text-base font-semibold')}>
                {s.label}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground/60 cursor-help shrink-0" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">{s.tooltip}</p>
                </TooltipContent>
              </Tooltip>
              {s.tone === 'positive' && !isTop && <TrendingUp className="h-3 w-3 text-primary shrink-0" />}
              {s.tone === 'negative' && <TrendingDown className="h-3 w-3 text-destructive shrink-0" />}
            </div>
            <div className="relative flex items-baseline gap-3 shrink-0">
              <span className={cn('text-lg font-bold tabular-nums', isTop && 'text-xl')}>
                {value.toLocaleString('pt-BR')}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums w-14 text-right">
                {pctTopo}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CompareGrid({ data }: { data: BUFunnelByChannel }) {
  // Show A010 vs ANAMNESE (or top-2 channels) plus Total
  const preferred = ['A010', 'ANAMNESE'].filter((c) => data.byChannel[c]);
  const remaining = data.channels.filter((c) => !preferred.includes(c));
  const cols = [...preferred, ...remaining].slice(0, 3);
  const universoRef = data.total.universo;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left p-2 font-medium text-muted-foreground">Etapa</th>
            {cols.map((c) => (
              <th key={c} className="text-right p-2 font-medium">{CHANNEL_LABEL[c] || c}</th>
            ))}
            <th className="text-right p-2 font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {STAGES.map((s) => {
            const totalVal = data.total[s.key];
            return (
              <tr key={s.key} className={cn('border-b last:border-0', s.indent && 'bg-muted/20')}>
                <td className={cn('p-2', s.indent && 'pl-6')}>
                  <div className="flex items-center gap-1.5">
                    <span className={cn('font-medium', s.key === 'universo' && 'font-semibold')}>{s.label}</span>
                    {s.tone === 'negative' && <TrendingDown className="h-3 w-3 text-destructive" />}
                  </div>
                </td>
                {cols.map((c) => {
                  const v = data.byChannel[c]?.[s.key] ?? 0;
                  return (
                    <td key={c} className="text-right p-2 tabular-nums">
                      <span className="font-semibold">{v.toLocaleString('pt-BR')}</span>
                      <span className="text-xs text-muted-foreground ml-1">
                        ({pct(v, universoRef)})
                      </span>
                    </td>
                  );
                })}
                <td className="text-right p-2 tabular-nums font-bold">
                  {totalVal.toLocaleString('pt-BR')}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function BUFunnelComplete({ data, isLoading }: Props) {
  const [open, setOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [compare, setCompare] = useState(false);

  const channels = data?.channels || [];
  const showTabs = channels.length > 0;
  const currentChannelData =
    activeTab === 'all' || !data ? data?.total : data.byChannel[activeTab];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Funil completo da BU
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">
                  Funil end-to-end deduplicado por contato e segmentado por canal de aquisição
                  (A010, ANAMNESE etc.). A soma vertical não é uma partição — um lead pode
                  aparecer em múltiplas etapas ao longo do tempo.
                </p>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
          <div className="flex items-center gap-2">
            {showTabs && (
              <Toggle
                size="sm"
                pressed={compare}
                onPressedChange={setCompare}
                aria-label="Comparar canais"
              >
                <Columns2 className="h-4 w-4 mr-1" />
                Comparar
              </Toggle>
            )}
            <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        {open && showTabs && !compare && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
            <TabsList>
              <TabsTrigger value="all">
                Todos ({data!.total.universo.toLocaleString('pt-BR')})
              </TabsTrigger>
              {channels.map((c) => (
                <TabsTrigger key={c} value={c}>
                  {CHANNEL_LABEL[c] || c} ({data!.byChannel[c].universo.toLocaleString('pt-BR')})
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
      </CardHeader>
      {open && (
        <CardContent>
          {isLoading || !data ? (
            <div className="space-y-2">
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : compare ? (
            <CompareGrid data={data} />
          ) : currentChannelData ? (
            <>
              {activeTab !== 'all' && (
                <div className="mb-3 text-xs text-muted-foreground">
                  Canal <span className="font-semibold text-foreground">{CHANNEL_LABEL[activeTab] || activeTab}</span>
                  {' '}representa{' '}
                  <span className="font-semibold text-foreground">
                    {pct(currentChannelData.universo, data.total.universo)}
                  </span>{' '}do universo total ({data.total.universo.toLocaleString('pt-BR')}).
                </div>
              )}
              <FunnelRows
                data={currentChannelData}
                baseUniverso={activeTab === 'all' ? undefined : data.total.universo}
              />
            </>
          ) : (
            <div className="text-sm text-muted-foreground">Sem dados para o canal selecionado.</div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
