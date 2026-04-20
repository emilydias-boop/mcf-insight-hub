import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Info,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { BUFunnelData } from '@/hooks/useBUFunnelComplete';

interface Props {
  data: BUFunnelData | null;
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
  {
    key: 'universo',
    label: 'Universo (oportunidades únicas)',
    tooltip: 'Total de leads únicos por contato no escopo (BU + filtros).',
    tone: 'neutral',
  },
  {
    key: 'qualificados',
    label: 'Qualificados',
    tooltip: 'Leads em estágios contendo "qualificado".',
    tone: 'positive',
  },
  {
    key: 'semInteresse',
    label: 'Sem Interesse',
    tooltip: 'Leads em estágios "sem interesse", "perdido" ou "desqualificado".',
    tone: 'negative',
  },
  {
    key: 'agendadosR1',
    label: 'Agendados (R1)',
    tooltip: 'Contatos únicos com R1 agendada no período (meeting_slots type=r1).',
    tone: 'positive',
  },
  {
    key: 'r1Realizada',
    label: 'R1 Realizada',
    tooltip: 'R1 com status realizada/completed.',
    tone: 'positive',
    indent: true,
  },
  {
    key: 'noShowR1',
    label: 'No-Show R1',
    tooltip: 'R1 com status no_show.',
    tone: 'negative',
    indent: true,
  },
  {
    key: 'contratoPago',
    label: 'Contrato Pago',
    tooltip: 'Attendees com contract_paid_at OU estágio "Contrato Pago".',
    tone: 'positive',
  },
  {
    key: 'r2Realizada',
    label: 'R2 Realizada',
    tooltip: 'R2 com status realizada/completed.',
    tone: 'positive',
  },
  {
    key: 'vendasFinais',
    label: 'Vendas Finais',
    tooltip: 'hubla_transactions completed com product_category contendo "parceria".',
    tone: 'positive',
  },
];

function pct(n: number, base: number): string {
  if (!base) return '—';
  return `${((n / base) * 100).toFixed(1)}%`;
}

export function BUFunnelComplete({ data, isLoading }: Props) {
  const [open, setOpen] = useState(true);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Funil completo da BU
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">
                  Funil end-to-end deduplicado por contato. O topo é o universo
                  de oportunidades únicas. Cada etapa mostra quantos contatos
                  passaram por ela no período — não é uma partição (um lead pode
                  estar em múltiplas etapas ao longo do tempo).
                </p>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>
            {open ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent>
          {isLoading || !data ? (
            <div className="space-y-2">
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-1.5">
              {STAGES.map((s) => {
                const value = data[s.key];
                const isTop = s.key === 'universo';
                const pctTopo = isTop ? '100%' : pct(value, data.universo);
                const widthPct = data.universo
                  ? Math.max(8, Math.min(100, (value / data.universo) * 100))
                  : 0;
                return (
                  <div
                    key={s.key}
                    className={cn(
                      'relative flex items-center gap-3 rounded-md border bg-card px-3 py-2',
                      s.indent && 'ml-6',
                    )}
                  >
                    {/* barra de fundo proporcional */}
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
                      <span
                        className={cn(
                          'text-sm font-medium truncate',
                          isTop && 'text-base font-semibold',
                        )}
                      >
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
                      {s.tone === 'positive' && !isTop && (
                        <TrendingUp className="h-3 w-3 text-primary shrink-0" />
                      )}
                      {s.tone === 'negative' && (
                        <TrendingDown className="h-3 w-3 text-destructive shrink-0" />
                      )}
                    </div>
                    <div className="relative flex items-baseline gap-3 shrink-0">
                      <span
                        className={cn(
                          'text-lg font-bold tabular-nums',
                          isTop && 'text-xl',
                        )}
                      >
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
          )}
        </CardContent>
      )}
    </Card>
  );
}