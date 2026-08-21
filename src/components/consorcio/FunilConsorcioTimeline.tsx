import { useMemo } from 'react';
import { CalendarClock, CheckCheck, Mail, Inbox, BadgeCheck, Wallet, AlertTriangle, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useProposals, isPropostaSemValor } from '@/hooks/useConsorcioPostMeeting';
import { usePendingRegistrations } from '@/hooks/useConsorcioPendingRegistrations';
import { useConsorcioCards } from '@/hooks/useConsorcio';
import { useConsorcioR1Funnel } from '@/hooks/useConsorcioR1Funnel';
import {
  useConsorcioCotasOrigem,
  useConsorcioCotasReservadas,
  useConsorcioReservasAguardando,
  diasParados,
  medianDias,
} from '@/hooks/useConsorcioCotasOrigem';
import { ConsorcioPeriodFilter, type DateRangeFilter } from '@/components/consorcio/ConsorcioPeriodFilter';

const STEP_ICONS: LucideIcon[] = [CalendarClock, CheckCheck, Mail, Inbox, BadgeCheck, Wallet];

/** Todos os status possíveis de um cadastro pendente (etapa 4 mede evento, não status). */
export const PENDING_REGISTRATION_ALL_STATUSES = [
  'aguardando_abertura',
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
  | 'reservadas'
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
  /** Índice da etapa usada como denominador da taxa (default: etapa anterior). */
  rateBaseIndex?: number;
  /**
   * Registros desta etapa que vieram de coorte anterior (evento em mês diferente
   * da etapa base). Explica taxa > 100% sem precisar de alarme.
   */
  rateCohort?: number;
  /** Tooltip da taxa de conversão que chega nesta etapa. */
  rateTooltip?: string;
  /** Selos clicáveis abaixo do número (estoque atual / recorte). */
  badges?: Array<{
    label: string;
    filter?: FunilQuickFilter;
    tooltip: string;
    tone?: 'default' | 'amber';
    icon?: boolean;
  }> | null;
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
  // Estoque GLOBAL de reservas em aberto (ignora o período de propósito) — sinal
  // que antes só existia dentro da aba 5.
  const { data: reservasAbertas } = useConsorcioReservasAguardando();

  // Etapa 3 — TODAS as propostas criadas no período (evento, não status).
  // Eixo de data: proposal_date ?? created_at (convenção do BIConsorcio).
  const propostasPeriodo = useMemo(
    () =>
      (proposals || []).filter(
        (p: any) =>
          !p.carta_excluida &&
          // Proposta pendente sem valor de crédito ainda não é carta negociada.
          !isPropostaSemValor(p) &&
          isInPeriod(p.proposal_date || p.created_at, range),
      ),
    [proposals, period.startDate, period.endDate],
  );
  const propostasCount = propostasPeriodo.length;
  /**
   * Contagem de CARTAS do período — unidade real desta etapa e denominador
   * correto da conversão para "Cotas a Fazer" (1 carta → 1 cadastro).
   * Fallback: `qtd_cartas` da proposta e, na falta dele, 1 (propostas legadas).
   */
  const negociadas = useMemo(
    () =>
      propostasPeriodo.reduce(
        (acc: number, p: any) => acc + (p.cartas?.length || p.qtd_cartas || 1),
        0,
      ),
    [propostasPeriodo],
  );
  /** Estoque atual: propostas criadas no período e que HOJE seguem sem aceite. */
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

  // Etapa 5 — "Cotas Cadastradas" = cotas RESERVADAS na Embracon no período, restritas
  // às que têm origem no funil (cadastro pendente vinculado).
  //
  // ATENÇÃO (processo, não código): esta etapa só descreve o cadastramento/pagamento
  // real na Embracon se a equipe abrir a cota como RESERVA e converter em contratação
  // quando a administradora confirmar. Se `data_reserva` e `data_contratacao` forem
  // gravadas no mesmo instante, a etapa 5 vira espelho da etapa 6.
  const cadastradasCount = loadingReservadas ? null : (reservadas?.length ?? 0);
  const medianaReserva = medianDias(reservadas || []);

  const reservasEmAberto = reservasAbertas?.length ?? 0;
  const reservasParadas15 = (reservasAbertas || []).filter((c) => {
    const d = diasParados(c.data_reserva);
    return d != null && d > 15;
  }).length;

  /**
   * Cadastros do período cujo aceite caiu em mês diferente da proposta vinculada:
   * travessia de coorte. É a explicação normal para a etapa 4 ficar maior que a 3.
   */
  const cadastrosDeCoorteAnterior = useMemo(() => {
    if (!cadastrosPeriodo || !proposals) return 0;
    const porId = new Map((proposals as any[]).map((p) => [p.id, p]));
    const ym = (v?: string | null) => (v ? String(v).slice(0, 7) : null);
    return cadastrosPeriodo.filter((r: any) => {
      const p = r.proposal_id ? porId.get(r.proposal_id) : null;
      const mesProposta = ym(p?.proposal_date || p?.created_at);
      const mesCadastro = ym(r.aceite_date || r.created_at);
      return !!mesProposta && !!mesCadastro && mesProposta !== mesCadastro;
    }).length;
  }, [cadastrosPeriodo, proposals]);

  const pct = (n: number, total: number) =>
    total > 0
      ? `${((n / total) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
      : '—';

  // Etapa 6 — composição das cotas contratadas no período.
  const cotas = ownCards.data ?? [];
  const cotasTotal = ownCards.isLoading ? null : cotas.length;
  const cotasFunil = funnelCardIds ? cotas.filter((c: any) => funnelCardIds.has(c.id)).length : null;
  const cotasExternas =
    cotasTotal != null && cotasFunil != null ? cotasTotal - cotasFunil : null;

  const steps: Step[] = [
    {
      key: 'r1-agendadas',
      label: CONSORCIO_LABELS.reunioesAgendadas,
      hint: 'agendadas para o período',
      count: loadingR1 ? null : (r1?.agendadas ?? 0),
      badges: r1
        ? [
            {
              label: `No-show ${r1.noShow}`,
              filter: 'no-show' as FunilQuickFilter,
              tooltip: `No-show do período: ${r1.noShow} de ${r1.agendadas} agendadas (${pct(
                r1.noShow,
                r1.agendadas,
              )}). Clique para ver só os no-shows, com a quebra por motivo.`,
            },
            {
              label: `Sem desfecho ${r1.semDesfecho}`,
              filter: 'sem-desfecho' as FunilQuickFilter,
              tone: 'amber' as const,
              icon: true,
              tooltip: `Reuniões sem desfecho: ${r1.semDesfecho} de ${r1.agendadas} agendadas (${pct(
                r1.semDesfecho,
                r1.agendadas,
              )}). Já passaram e continuam sem status — não entram nem em realizadas nem em no-show. Clique para abrir a fila de trabalho.`,
            },
          ]
        : null,
    },
    {
      key: 'r1-realizadas',
      label: CONSORCIO_LABELS.reunioesRealizadas,
      hint: 'marcadas pelo closer',
      count: loadingR1 ? null : (r1?.realizadas ?? 0),
    },
    {
      key: 'propostas',
      label: CONSORCIO_LABELS.termosPendentes,
      hint: `cartas em ${propostasCount} proposta${propostasCount === 1 ? '' : 's'} do período`,
      count: loadingProposals ? null : negociadas,
      badges:
        !loadingProposals && naoAceitas > 0
          ? [{
              label: `${naoAceitas} proposta${naoAceitas > 1 ? 's' : ''} ainda não aceita${naoAceitas > 1 ? 's' : ''}`,
              filter: 'nao-aceitas' as FunilQuickFilter,
              tooltip:
                'Estoque atual: propostas criadas no período que hoje seguem sem aceite do closer. O número grande da etapa conta CARTAS (uma proposta pode negociar várias); este selo conta propostas. Clique para filtrar a lista.',
            }]
          : null,
      breakdown:
        !loadingProposals
          ? [
              {
                label: 'Propostas',
                value: propostasCount,
                tooltip:
                  'Propostas criadas no período (eixo data da proposta). É esta a base da meta de crédito no BI — que segue contando propostas, não cartas.',
              },
              {
                label: 'Cartas',
                value: negociadas,
                tooltip:
                  'Soma das cartas de crédito negociadas dentro dessas propostas. Uma carta gera uma cota a fazer, por isso é este o denominador da etapa seguinte.',
              },
            ]
          : null,
    },

    {
      key: 'pendentes',
      label: CONSORCIO_LABELS.cotasAFazer,
      hint: 'criados no período',
      count: pendentesCount,
      rateCohort: cadastrosDeCoorteAnterior,
      rateTooltip:
        'Conversão calculada sobre CARTAS negociadas, não sobre propostas: cada carta deveria gerar um cadastro pendente (relação 1:1). Cadastros antigos criados fora da proposta, ou aceites de cartas de meses anteriores, ainda podem levar a taxa acima de 100%. Atenção: propostas anteriores a setembro/2026 não registravam cartas individualmente — nesses períodos a contagem de cartas é uma estimativa de backfill (1 por proposta ou qtd_cartas), então a taxa pode ficar distorcida.',

      badges:
        aguardandoAbertura > 0
          ? [{
              label: `${aguardandoAbertura} aguardando abertura`,
              filter: 'aguardando-abertura' as FunilQuickFilter,
              tooltip:
                'Estoque atual: cadastros criados no período que hoje continuam aguardando abertura de cota. Clique para filtrar a lista.',
            }]
          : null,
    },
    {
      key: 'cadastradas',
      label: CONSORCIO_LABELS.cotasCadastradas,
      hint: 'reservadas na Embracon',
      count: cadastradasCount,
      rateBaseIndex: 3,
      rateTooltip:
        'Calculada sobre os cadastros do período. A etapa Cotas Cadastradas usa a data de reserva, um eixo de data diferente, e por isso não serve de base para a etapa seguinte.',
      badges:
        cadastradasCount != null
          ? [
            ...(reservasEmAberto > 0
              ? [{
                  label: `${reservasEmAberto} reserva${reservasEmAberto === 1 ? '' : 's'} em aberto${
                    reservasParadas15 > 0 ? ` · ${reservasParadas15} há +15 dias` : ''
                  }`,
                  filter: 'reservadas' as FunilQuickFilter,
                  tone: (reservasParadas15 > 0 ? 'amber' : 'default') as 'amber' | 'default',
                  icon: reservasParadas15 > 0,
                  tooltip:
                    'Estoque GLOBAL: todas as reservas abertas e ainda sem confirmação da Embracon, de qualquer data e incluindo cotas externas. NÃO entra na contagem da bolinha da etapa 5, que mede só as reservas do funil dentro do período — são conjuntos diferentes de propósito (estoque × fluxo). Clique para abrir a fila de confirmação.',
                }]
              : []),
            {
              label:
                medianaReserva != null
                  ? `${medianaReserva} dia${medianaReserva === 1 ? '' : 's'} até contratar`
                  : '—',
              filter: 'reservadas' as FunilQuickFilter,
              tooltip:
                'Mediana de dias entre a reserva e a confirmação da Embracon, considerando apenas cotas cujas datas caíram em dias diferentes (as gravadas no mesmo instante ficam fora para não puxar a mediana a 0). Clique para abrir a fila de reservas aguardando confirmação.',
            },
          ]
          : null,
    },
    {
      key: 'cotas',
      label: 'Cotas',
      hint: 'contratadas no período',
      count: cotasTotal,
      rateCount: cotasFunil,
      rateBaseIndex: 3,
      rateTooltip:
        'Calculada sobre os cadastros do período: cotas originadas no funil ÷ cadastros criados. A etapa Cotas Cadastradas usa a data de reserva, um eixo diferente, e por isso não entra nesta conta. As cotas externas não vieram de reunião e ficam fora do numerador.',
      badges:
        cotasFunil && cotasFunil > 0
          ? [{
              label: `${cotasFunil} do funil`,
              filter: 'do-funil' as FunilQuickFilter,
              tooltip:
                'Cotas com cadastro pendente vinculado — nasceram no funil. Clique para filtrar a lista.',
            }]
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

  /**
   * Taxa de conversão que chega na etapa `i`.
   * O denominador é a etapa anterior, salvo quando a etapa declara `rateBaseIndex`
   * (etapas 5 e 6 medem contra a etapa 4 — os eixos de data são diferentes).
   * `over100` só marca alarme quando a etapa cresce ALÉM do que a travessia de
   * coorte (`rateCohort`) explica. Taxa acima de 100% explicada por cadastro de
   * mês anterior é normal e sai em tom neutro, com nota.
   */
  const rate = (i: number): { label: string; over100: boolean; nota: string | null } | null => {
    const baseIdx = steps[i]?.rateBaseIndex ?? i - 1;
    const prev = steps[baseIdx]?.count;
    const curr = steps[i]?.rateCount !== undefined ? steps[i]?.rateCount : steps[i]?.count;
    if (prev == null || curr == null || prev === 0) return null;
    const value = (curr / prev) * 100;
    const coorte = steps[i]?.rateCohort ?? 0;
    const excedente = curr - prev;
    return {
      label: `${value.toLocaleString('pt-BR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })}%`,
      over100: value > 100 && excedente > coorte,
      nota: value > 100 && coorte > 0 ? `+${coorte} de meses anteriores` : null,
    };
  };

  const OVER_100_TOOLTIP =
    'A etapa seguinte tem mais registros que a anterior — provável travessia de mês ou origem fora do funil.';
  const COORTE_TOOLTIP =
    'Acima de 100% por travessia de mês: parte dos cadastros do período veio de cartas negociadas em meses anteriores. Não é erro de dado.';

  return (
    <TooltipProvider delayDuration={150}>
      <Card className="border-border/60 bg-card/60 p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Funil Consórcio
            </p>
            <p className="text-[11px] text-muted-foreground/80">
              6 etapas — da reunião agendada até a cota contratada · período: {period.label}
            </p>
          </div>
          <ConsorcioPeriodFilter value={period} onChange={onPeriodChange} />
        </div>

        <div className="overflow-x-auto px-1 py-3">
          <ol className="flex min-w-[820px] items-stretch gap-0">
            {steps.map((step, i) => {
              const isActive = i === activeIndex;
              const isDone = activeIndex === -1 ? false : i < activeIndex;
              const conv = i > 0 ? rate(i) : null;
              const Icon = STEP_ICONS[i] ?? CalendarClock;
              return (
                <li key={step.key} className="flex flex-1 items-start">
                  {i > 0 && (
                    <div className="relative flex h-12 flex-1 items-center">
                      <div className="relative z-0 h-1 w-full rounded-full bg-muted">
                        <div
                          className={cn(
                            'absolute inset-y-0 left-0 rounded-full bg-primary/70 transition-all',
                            activeIndex === -1 ? 'w-0' : i <= activeIndex ? 'w-full' : 'w-0'
                          )}
                        />
                      </div>
                      {conv &&
                        (conv.over100 || conv.nota || step.rateTooltip ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                className={cn(
                                  'absolute left-1/2 top-1/2 z-20 hidden -translate-x-1/2 -translate-y-1/2 cursor-help items-center gap-1 whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[10px] font-medium md:flex',
                                  conv.over100
                                    ? 'border-destructive/60 bg-card text-destructive'
                                    : 'border-border bg-card text-muted-foreground',
                                )}
                              >
                                {conv.over100 && <AlertTriangle className="h-3 w-3" />}
                                {conv.label}
                                {!conv.over100 && conv.nota && (
                                  <span className="text-muted-foreground/80">· {conv.nota}</span>
                                )}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[260px]">
                              <p className="text-xs">
                                {conv.over100
                                  ? OVER_100_TOOLTIP
                                  : conv.nota
                                    ? COORTE_TOOLTIP
                                    : step.rateTooltip}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="absolute left-1/2 top-1/2 z-20 hidden -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground md:block">
                            {conv.label}
                          </span>
                        ))}
                    </div>
                  )}
                  <div className="flex w-[112px] shrink-0 flex-col items-center md:w-[132px]">
                    <button
                      type="button"
                      onClick={() => onTabChange(step.key)}
                      aria-current={isActive ? 'step' : undefined}
                      className="group flex w-full flex-col items-center gap-1 text-center"
                    >
                      {/* faixa de altura fixa (48px) — mantém a linha sempre no mesmo eixo */}
                      <span className="relative z-10 flex h-12 items-center justify-center">
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

                    {/* faixa de selos com altura reservada — mantém as bases alinhadas */}
                    <div className="mt-1.5 flex min-h-[42px] w-full flex-col items-center gap-1">
                      {(step.badges ?? []).map((badge) => (
                        <Tooltip key={badge.label}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => badge.filter && onQuickFilter?.(badge.filter)}
                              className={cn(
                                'flex max-w-full items-center justify-center gap-1 truncate rounded-full border px-1.5 py-0.5 text-[10px] font-medium transition-colors',
                                badge.tone === 'amber'
                                  ? 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                  : 'border-border bg-card text-muted-foreground',
                                badge.filter
                                  ? badge.tone === 'amber'
                                    ? 'hover:bg-amber-500/20'
                                    : 'hover:border-primary/50 hover:text-foreground'
                                  : 'cursor-default',
                              )}
                            >
                              {badge.icon && <AlertTriangle className="h-3 w-3 shrink-0" />}
                              <span className="truncate">{badge.label}</span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[260px]">
                            <p className="text-xs">{badge.tooltip}</p>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                      {step.breakdown && (
                        <div className="w-full space-y-0.5 rounded-md border border-border/60 bg-muted/30 px-1.5 py-1">
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
                                  className="flex items-center justify-between gap-1 px-0.5 text-[10px] leading-tight"
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
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

      </Card>
    </TooltipProvider>
  );
}
