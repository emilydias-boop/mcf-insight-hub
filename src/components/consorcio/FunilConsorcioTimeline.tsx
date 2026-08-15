import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, Mail, CheckCheck, Inbox, BadgeCheck, Wallet, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRealizadas, useProposals } from '@/hooks/useConsorcioPostMeeting';
import { usePendingRegistrations } from '@/hooks/useConsorcioPendingRegistrations';
import { useConsorcioCards } from '@/hooks/useConsorcio';

const STEP_ICONS: LucideIcon[] = [Clock, Mail, CheckCheck, Inbox, BadgeCheck, Wallet];

export type FunilPage = 'pos-reuniao' | 'consorcio';

const MONTH_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const offset = 12 - i; // +12 futuro ... -11 passado
  const date = offset >= 0 ? addMonths(new Date(), offset) : subMonths(new Date(), -offset);
  return {
    value: format(date, 'yyyy-MM'),
    label: format(date, 'MMMM yyyy', { locale: ptBR }),
  };
});

export function parseMesKey(mes: string): Date {
  const [y, m] = mes.split('-').map(Number);
  if (!y || !m) return startOfMonth(new Date());
  return startOfMonth(new Date(y, m - 1, 1));
}

export function mesLabel(mes: string): string {
  return format(parseMesKey(mes), 'MMMM yyyy', { locale: ptBR });
}

interface Step {
  key: string;
  page: FunilPage;
  label: string;
  hint: string;
  count: number | null;
}

interface FunilConsorcioTimelineProps {
  page: FunilPage;
  activeTab: string;
  onTabChange: (tab: string) => void;
  mes: string;
  onMesChange: (mes: string) => void;
  /** Contagem de Cotas já calculada na página /consorcio (mesma lista exibida). */
  cotasCount?: number | null;
}

export function FunilConsorcioTimeline({
  page,
  activeTab,
  onTabChange,
  mes,
  onMesChange,
  cotasCount,
}: FunilConsorcioTimelineProps) {
  const navigate = useNavigate();

  const { data: realizadas, isLoading: loadingRealizadas } = useRealizadas();
  const { data: proposals, isLoading: loadingProposals } = useProposals();
  const { data: pendentes } = usePendingRegistrations(['aguardando_abertura']);
  const { data: cadastradas } = usePendingRegistrations(['cadastrada']);

  const mesDate = parseMesKey(mes);
  const ownCards = useConsorcioCards(
    cotasCount === undefined
      ? { startDate: startOfMonth(mesDate), endDate: endOfMonth(mesDate) }
      : {}
  );

  const negociadas = useMemo(
    () => (proposals || []).filter((p: any) => !p.completa && !p.cadastro_completo).length,
    [proposals]
  );
  const concluidas = useMemo(
    () => (proposals || []).filter((p: any) => p.completa || p.cadastro_completo).length,
    [proposals]
  );

  const steps: Step[] = [
    {
      key: 'realizadas',
      page: 'pos-reuniao',
      label: 'Reuniões Realizadas',
      hint: 'aguardando ação',
      count: loadingRealizadas ? null : (realizadas?.length ?? 0),
    },
    {
      key: 'propostas',
      page: 'pos-reuniao',
      label: 'Cartas Negociadas',
      hint: 'em negociação',
      count: loadingProposals ? null : negociadas,
    },
    {
      key: 'concluidas',
      page: 'pos-reuniao',
      label: 'Concluídas Operacional',
      hint: 'cadastro completo',
      count: loadingProposals ? null : concluidas,
    },
    {
      key: 'pendentes',
      page: 'consorcio',
      label: 'Cadastros Pendentes',
      hint: 'aguardando abertura',
      count: pendentes ? pendentes.length : null,
    },
    {
      key: 'cadastradas',
      page: 'consorcio',
      label: 'Cadastradas',
      hint: 'marcadas',
      count: cadastradas ? cadastradas.length : null,
    },
    {
      key: 'cotas',
      page: 'consorcio',
      label: 'Cotas',
      hint: mesLabel(mes),
      count:
        cotasCount !== undefined
          ? cotasCount
          : ownCards.isLoading
            ? null
            : (ownCards.data?.length ?? 0),
    },
  ];

  const activeIndex = Math.max(
    0,
    steps.findIndex(s => s.page === page && s.key === activeTab)
  );

  const goTo = (step: Step) => {
    if (step.page === page) {
      onTabChange(step.key);
      return;
    }
    const base = step.page === 'pos-reuniao' ? '/consorcio/crm/pos-reuniao' : '/consorcio';
    navigate(`${base}?tab=${step.key}&mes=${mes}`);
  };

  const rate = (i: number): string | null => {
    const prev = steps[i - 1]?.count;
    const curr = steps[i]?.count;
    if (prev == null || curr == null || prev === 0) return null;
    return `${((curr / prev) * 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}%`;
  };

  return (
    <Card className="border-border/60 bg-card/60 p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Funil Consórcio
          </p>
          <p className="text-[11px] text-muted-foreground/80">
            6 etapas — do desfecho da reunião até a cota contratada
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Select value={mes} onValueChange={onMesChange}>
            <SelectTrigger className="h-8 w-44 text-xs capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value} className="capitalize">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-[10px] text-muted-foreground/70">
            aplica-se a Cotas; as demais etapas mostram o estoque atual
          </span>
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <ol className="flex min-w-[720px] items-start gap-0">
          {steps.map((step, i) => {
            const isActive = i === activeIndex;
            const isDone = i < activeIndex;
            const conv = i > 0 ? rate(i) : null;
            return (
              <li key={step.key} className="flex flex-1 items-start">
                {i > 0 && (
                  <div className="relative mt-5 h-1 flex-1 rounded-full bg-muted">
                    <div
                      className={cn(
                        'absolute inset-y-0 left-0 rounded-full bg-primary/70 transition-all',
                        i <= activeIndex ? 'w-full' : 'w-0'
                      )}
                    />
                    {conv && (
                      <span className="absolute -top-4 left-1/2 hidden -translate-x-1/2 rounded-full border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground md:block">
                        {conv}
                      </span>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => goTo(step)}
                  aria-current={isActive ? 'step' : undefined}
                  className="group flex w-[104px] shrink-0 flex-col items-center gap-1.5 text-center md:w-[128px]"
                >
                  <span
                    className={cn(
                      'flex items-center justify-center rounded-full border-2 font-bold transition-all',
                      isActive
                        ? 'h-12 w-12 border-primary bg-primary text-primary-foreground text-base shadow-[0_0_0_6px_hsl(var(--primary)/0.18)]'
                        : isDone
                          ? 'h-10 w-10 border-primary/50 bg-primary/25 text-primary text-sm'
                          : 'h-10 w-10 border-border bg-muted/40 text-muted-foreground text-sm group-hover:border-primary/40'
                    )}
                  >
                    {step.count == null ? '—' : step.count}
                  </span>
                  <span
                    className={cn(
                      'text-[11px] font-semibold leading-tight',
                      isActive ? 'text-primary' : 'text-foreground/80'
                    )}
                  >
                    {step.label}
                  </span>
                  <span className="hidden text-[10px] capitalize text-muted-foreground md:block">
                    {step.hint}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </Card>
  );
}
