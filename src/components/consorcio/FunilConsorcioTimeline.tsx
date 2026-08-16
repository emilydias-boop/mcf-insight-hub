import { useMemo } from 'react';
import { CalendarClock, CheckCheck, Mail, Inbox, BadgeCheck, Wallet, AlertTriangle, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useProposals } from '@/hooks/useConsorcioPostMeeting';
import { usePendingRegistrations } from '@/hooks/useConsorcioPendingRegistrations';
import { useConsorcioCards } from '@/hooks/useConsorcio';
import { useConsorcioR1Funnel } from '@/hooks/useConsorcioR1Funnel';
import {
  useConsorcioCotasOrigem,
  useConsorcioCotasReservadas,
  medianDias,
} from '@/hooks/useConsorcioCotasOrigem';
import { ConsorcioPeriodFilter, type DateRangeFilter } from '@/components/consorcio/ConsorcioPeriodFilter';

const STEP_ICONS: LucideIcon[] = [CalendarClock, CheckCheck, Mail, Inbox, BadgeCheck, Wallet];

/** Todos os status possíveis de um cadastro pendente (etapa 4 mede evento, não status). */
export const PENDING_REGISTRATION_ALL_STATUSES = [
  'aguardando_abertura',
  'cadastrada',
  'cota_aberta',
  'vinculada',
  'declinada',
] as const;

/** Filtros rápidos disparados pelos selos da timeline. */
export type FunilQuickFilter =
  | 'sem-desfecho'
  | 'no-show'
  | 'nao-aceitas'
  | 'aguardando-abertura'
  | 'do-funil'
  | 'externas';

/** Verifica se uma data (ISO ou YYYY-MM-DD) cai dentro do período selecionado. */
export function isInPeriod(
  value: string | null | undefined,
  range: { startDate?: Date; endDate?: Date },
): boolean {
  if (!range.startDate && !range.endDate) return true;
  if (!value) return false;
  const d = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(d.getTime())) return false;
  if (range.startDate) {
    const start = new Date(range.startDate);
    start.setHours(0, 0, 0, 0);
    if (d < start) return false;
  }
  if (range.endDate) {
    const end = new Date(range.endDate);
    end.setHours(23, 59, 59, 999);
    if (d > end) return false;
  }
  return true;
}

interface Step {
  key: string;
  label: string;
  hint: string;
  count: number | null;
  /** Base usada no cálculo da taxa de conversão desta etapa (default: count). */
  rateCount?: number | null;
  /** Tooltip da taxa de conversão que chega nesta etapa. */
  rateTooltip?: string;
  /** Selo clicável abaixo do número (estoque atual / recorte). */
  badge?: { label: string; filter: FunilQuickFilter; tooltip: string } | null;
  /** Mini-blocos de composição exibidos dentro do card da etapa. */
  breakdown?: Array<{ label: string; value: number; filter?: FunilQuickFilter; tooltip?: string }> | null;
}

interface FunilConsorcioTimelineProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  period: DateRangeFilter;
  onPeriodChange: (value: DateRangeFilter) => void;
  /** Filtro rápido disparado pelos selos da timeline. */
  onQuickFilter?: (filter: FunilQuickFilter) => void;
}

export function FunilConsorcioTimeline({
  activeTab,
  onTabChange,
  period,
  onPeriodChange,
  onQuickFilter,
}: FunilConsorcioTimelineProps) {
  const range = { startDate: period.startDate, endDate: period.endDate };

  const { data: r1, isLoading: loadingR1 } = useConsorcioR1Funnel(range);
  const { data: proposals, isLoading: loadingProposals } = useProposals();
  const { data: pendentes } = usePendingRegistrations([...PENDING_REGISTRATION_ALL_STATUSES]);
  const ownCards = useConsorcioCards({ startDate: range.startDate, endDate: range.endDate });
  const { data: funnelCardIds } = useConsorcioCotasOrigem();
  const { data: reservadas, isLoading: loadingReservadas } = useConsorcioCotasReservadas(range);

  // Etapa 3 — TODAS as propostas criadas no período (evento, não status).
  // Eixo de data: proposal_date ?? created_at (convenção do BIConsorcio).
  const propostasPeriodo = useMemo(
    () =>
      (proposals || []).filter(
        (p: any) =>
          !p.carta_excluida &&
          isInPeriod(p.proposal_date || p.created_at, range),
      ),
    [proposals, period.startDate, period.endDate],
  );
  const negociadas = propostasPeriodo.length;
  /** Estoque atual: criadas no período e que HOJE seguem sem aceite. */
  const naoAceitas = propostasPeriodo.filter((p: any) => p.status !== 'aceita').length;

  // Etapa 4 — TODOS os cadastros criados no período (evento, não status).
  // Eixo aceite_date ?? created_at.
  const cadastrosPeriodo = useMemo(
    () =>
      pendentes
        ? pendentes.filter((r: any) => isInPeriod(r.aceite_date || r.created_at, range))
        : null,
    [pendentes, period.startDate, period.endDate],
  );
  const pendentesCount = cadastrosPeriodo ? cadastrosPeriodo.length : null;
  /** Estoque atual da fila da equipe de acompanhamento. */
  const aguardandoAbertura = cadastrosPeriodo
    ? cadastrosPeriodo.filter((r: any) => r.status === 'aguardando_abertura').length
    : 0;

  // Etapa 5 — "Cadastradas" = cotas RESERVADAS na Embracon no período, restritas
  // às que têm origem no funil (cadastro pendente vinculado).
  //
  // ATENÇÃO (processo, não código): esta etapa só descreve o cadastramento/pagamento
  // real na Embracon se a equipe abrir a cota como RESERVA e converter em contratação
  // quando a administradora confirmar. Se `data_reserva` e `data_contratacao` forem
  // gravadas no mesmo instante, a etapa 5 vira espelho da etapa 6.
  const cadastradasCount = loadingReservadas ? null : (reservadas?.length ?? 0);
  const medianaReserva = medianDias(reservadas || []);

  // Etapa 6 — composição das cotas contratadas no período.
  const cotas = ownCards.data ?? [];
  const cotasTotal = ownCards.isLoading ? null : cotas.length;
  const cotasFunil = funnelCardIds ? cotas.filter((c: any) => funnelCardIds.has(c.id)).length : null;
  const cotasExternas =
    cotasTotal != null && cotasFunil != null ? cotasTotal - cotasFunil : null;

  const steps: Step[] = [
    {
      key: 'r1-agendadas',
      label: 'R1 Agendadas',
      hint: 'agendadas para o período',
      count: loadingR1 ? null : (r1?.agendadas ?? 0),
    },
    {
      key: 'r1-realizadas',
      label: 'R1 Realizadas',
      hint: 'marcadas pelo closer',
      count: loadingR1 ? null : (r1?.realizadas ?? 0),
    },
    {
      key: 'propostas',
      label: 'Cartas Negociadas',
      hint: 'criadas no período',
      count: loadingProposals ? null : negociadas,
      badge:
        !loadingProposals && naoAceitas > 0
          ? {
              label: `${naoAceitas} ainda não aceita${naoAceitas > 1 ? 's' : ''}`,
              filter: 'nao-aceitas',
              tooltip:
                'Estoque atual: propostas criadas no período que hoje seguem sem aceite do closer. Clique para filtrar a lista.',
            }
          : null,
    },
    {
      key: 'pendentes',
      label: 'Cadastros Pendentes',
      hint: 'criados no período',
      count: pendentesCount,
      badge:
        aguardandoAbertura > 0
          ? {
              label: `${aguardandoAbertura} aguardando abertura`,
              filter: 'aguardando-abertura',
              tooltip:
                'Estoque atual: cadastros criados no período que hoje continuam aguardando abertura de cota. Clique para filtrar a lista.',
            }
          : null,
    },
    {
      key: 'cadastradas',
      label: 'Cadastradas',
      hint: 'reservadas na Embracon',
      count: cadastradasCount,
      badge:
        cadastradasCount != null
          ? {
              label:
                medianaReserva != null
                  ? `${medianaReserva} dia${medianaReserva === 1 ? '' : 's'} até contratar`
                  : '—',
              filter: 'do-funil',
              tooltip:
                'Mediana de dias entre a reserva e a contratação das cotas do período. Mediana 0 indica que reserva e contratação foram gravadas no mesmo dia — nesse caso a etapa espelha as Cotas.',
            }
          : null,
    },
    {
      key: 'cotas',
      label: 'Cotas',
      hint: 'contratadas no período',
      count: cotasTotal,
      rateCount: cotasFunil,
      rateTooltip:
        'Calculada sobre as cotas originadas no funil; as externas não vieram de reunião.',
      badge:
        cotasFunil && cotasFunil > 0
          ? {
              label: `${cotasFunil} do funil`,
              filter: 'do-funil',
              tooltip:
                'Cotas com cadastro pendente vinculado — nasceram no funil. Clique para filtrar a lista.',
            }
          : null,
      breakdown:
        cotasTotal != null && cotasFunil != null && cotasExternas != null
          ? [
              {
                label: 'Do funil',
                value: cotasFunil,
                filter: 'do-funil' as FunilQuickFilter,
                tooltip: 'Cotas com cadastro pendente vinculado. Clique para filtrar a lista.',
              },
              {
                label: 'Externas',
                value: cotasExternas,
                filter: 'externas' as FunilQuickFilter,
                tooltip:
                  'Cotas criadas direto pelo "+ Adicionar Cota", sem vínculo com o funil. Clique para conferir na lista.',
              },
              { label: 'Total', value: cotasTotal },
            ]
          : null,
    },
  ];

  const matchedIndex = steps.findIndex(s => s.key === activeTab);
  const activeIndex = matchedIndex === -1 ? -1 : matchedIndex;

  const rate = (i: number): string | null => {
    const prev = steps[i - 1]?.count;
    const curr = steps[i]?.rateCount !== undefined ? steps[i]?.rateCount : steps[i]?.count;
    if (prev == null || curr == null || prev === 0) return null;
    return `${((curr / prev) * 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}%`;
  };

  const pct = (n: number, total: number) =>
    total > 0
      ? `${((n / total) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
      : '—';

  return (
    <TooltipProvider delayDuration={150}>
      <Card className="border-border/60 bg-card/60 p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Funil Consórcio
            </p>
            <p className="text-[11px] text-muted-foreground/80">
              6 etapas — da R1 agendada até a cota contratada · período: {period.label}
            </p>
          </div>
          <ConsorcioPeriodFilter value={period} onChange={onPeriodChange} />
        </div>

        <div className="overflow-x-auto pb-1">
          <ol className="flex min-w-[820px] items-start gap-0">
            {steps.map((step, i) => {
              const isActive = i === activeIndex;
              const isDone = activeIndex === -1 ? false : i < activeIndex;
              const conv = i > 0 ? rate(i) : null;
              const Icon = STEP_ICONS[i] ?? CalendarClock;
              const showHealth = i === 1 && r1;
              return (
                <li key={step.key} className="flex flex-1 items-start">
                  {i > 0 && (
                    <div className="relative mt-5 h-1 flex-1 rounded-full bg-muted">
                      <div
                        className={cn(
                          'absolute inset-y-0 left-0 rounded-full bg-primary/70 transition-all',
                          activeIndex === -1 ? 'w-0' : i <= activeIndex ? 'w-full' : 'w-0'
                        )}
                      />
                      {conv && (
                        step.rateTooltip ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="absolute -top-4 left-1/2 hidden -translate-x-1/2 cursor-help whitespace-nowrap rounded-full border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground md:block">
                                {conv}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[260px]">
                              <p className="text-xs">{step.rateTooltip}</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="absolute -top-4 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-full border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground md:block">
                            {conv}
                          </span>
                        )
                      )}
                      {showHealth && (
                        <div className="absolute left-1/2 top-3 hidden -translate-x-1/2 flex-col items-center gap-1 md:flex">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => onQuickFilter?.('no-show')}
                                className="whitespace-nowrap rounded-full border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                              >
                                No-show {r1!.noShow} · {pct(r1!.noShow, r1!.agendadas)}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[260px]">
                              <p className="text-xs">
                                Clique para ver só os no-shows do período, com a quebra por motivo.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => onQuickFilter?.('sem-desfecho')}
                                className="flex items-center gap-1 whitespace-nowrap rounded-full border border-amber-500/50 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 transition-colors hover:bg-amber-500/20 dark:text-amber-400"
                              >
                                <AlertTriangle className="h-3 w-3" />
                                Sem desfecho {r1!.semDesfecho} · {pct(r1!.semDesfecho, r1!.agendadas)}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[260px]">
                              <p className="text-xs">
                                Reuniões que já passaram e continuam sem status — não entram nem em
                                realizadas nem em no-show. Clique para abrir a fila de trabalho.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex w-[112px] shrink-0 flex-col items-center gap-1 md:w-[132px]">
                  <button
                    type="button"
                    onClick={() => onTabChange(step.key)}
                    aria-current={isActive ? 'step' : undefined}
                    className="group flex w-full flex-col items-center gap-1 text-center"
                  >
                    <span
                      className={cn(
                        'flex items-center justify-center rounded-full border-2 transition-all',
                        isActive
                          ? 'h-12 w-12 border-primary bg-primary text-primary-foreground shadow-[0_0_0_6px_hsl(var(--primary)/0.18)]'
                          : isDone
                            ? 'h-10 w-10 border-primary/50 bg-primary/25 text-primary'
                            : 'h-10 w-10 border-border bg-muted/40 text-muted-foreground group-hover:border-primary/40'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span
                      className={cn(
                        'text-[11px] font-semibold leading-tight',
                        isActive ? 'text-primary' : 'text-foreground/80'
                      )}
                    >
                      {step.label}
                    </span>
                    <span
                      className={cn(
                        'text-[18px] font-bold leading-none tracking-tight tabular-nums',
                        isActive ? 'text-foreground' : 'text-muted-foreground'
                      )}
                    >
                      {step.count == null ? '—' : step.count.toLocaleString('pt-BR')}
                    </span>
                    <span className="hidden text-[10px] text-muted-foreground md:block">
                      {step.hint}
                    </span>
                  </button>
                  {step.badge && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => onQuickFilter?.(step.badge!.filter)}
                          className="max-w-full truncate rounded-full border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                        >
                          {step.badge.label}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[260px]">
                        <p className="text-xs">{step.badge.tooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {step.breakdown && (
                    <div className="mt-1 w-full space-y-0.5 rounded-md border border-border/60 bg-muted/30 px-1.5 py-1">
                      {step.breakdown.map((b) => {
                        const row = (
                          <>
                            <span className="text-muted-foreground">{b.label}</span>
                            <span className="font-semibold tabular-nums text-foreground">
                              {b.value.toLocaleString('pt-BR')}
                            </span>
                          </>
                        );
                        if (!b.filter) {
                          return (
                            <div
                              key={b.label}
                              className="flex items-center justify-between gap-1 text-[10px] leading-tight"
                            >
                              {row}
                            </div>
                          );
                        }
                        return (
                          <Tooltip key={b.label}>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => onQuickFilter?.(b.filter!)}
                                className="flex w-full items-center justify-between gap-1 rounded px-0.5 text-[10px] leading-tight transition-colors hover:bg-primary/10 hover:text-foreground"
                              >
                                {row}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[260px]">
                              <p className="text-xs">{b.tooltip}</p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Mobile: os selos de saúde da etapa R1 ficam empilhados abaixo da timeline */}
        {r1 && (
          <div className="mt-3 flex flex-wrap gap-2 md:hidden">
            <button
              type="button"
              onClick={() => onQuickFilter?.('no-show')}
              className="whitespace-nowrap rounded-full border border-border bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground"
            >
              No-show {r1.noShow} · {pct(r1.noShow, r1.agendadas)}
            </button>
            <button
              type="button"
              onClick={() => onQuickFilter?.('sem-desfecho')}
              className="flex items-center gap-1 whitespace-nowrap rounded-full border border-amber-500/50 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-600 dark:text-amber-400"
            >
              <AlertTriangle className="h-3 w-3" />
              Sem desfecho {r1.semDesfecho} · {pct(r1.semDesfecho, r1.agendadas)}
            </button>
          </div>
        )}
      </Card>
    </TooltipProvider>
  );
}
