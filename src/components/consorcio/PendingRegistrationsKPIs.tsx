import { useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileClock, Layers, Wallet, CalendarRange, HandCoins, Activity } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/consorcioCalculos';
import type { EnrichedPendingRegistration } from '@/hooks/useConsorcioPendingRegistrations';

interface Props {
  /**
   * Conjunto do PERÍODO, com todos os status e ANTES do filtro de status:
   * o card "No período" mede o evento; os demais medem a fila (sem cota).
   */
  registrations: EnrichedPendingRegistration[];
  variant?: 'pendentes' | 'declinadas';
}

const VARIANT_LABELS = {
  pendentes: {
    cotas: 'Cotas sem cota aberta',
    credito: 'Crédito pendente',
    creditoSub: 'sem cota aberta',
    mes: 'Mês com mais cadastros',
  },
  declinadas: {
    cotas: 'Cotas declinadas',
    cotasSub: 'arquivadas',
    credito: 'Crédito declinado',
    creditoSub: 'valor total',
    mes: 'Mês com maior volume',
  },
} as const;

/** Registros que ainda NÃO viraram cota — a fila real de trabalho. */
const SEM_COTA_STATUS = ['aguardando_abertura'];

export function PendingRegistrationsKPIs({ registrations, variant = 'pendentes' }: Props) {
  const labels = VARIANT_LABELS[variant];
  const stats = useMemo(() => {
    const totalPeriodo = registrations.length;
    // Nas abas de status fixo o próprio conjunto já é o recorte.
    const fila =
      variant === 'pendentes'
        ? registrations.filter((r) => SEM_COTA_STATUS.includes(r.status) && !r.consortium_card_id)
        : registrations;
    const totalCotas = fila.length;
    const aguardando = fila.filter((r) => r.status === 'aguardando_abertura').length;
    const totalParcelas = fila.reduce(
      (s, r) => s + (r.parcelas_empresa?.length || 0),
      0,
    );
    const totalCredito = fila.reduce(
      (s, r) => s + (Number(r.valor_credito) || 0),
      0,
    );
    // Entrada = apenas a 1ª parcela da cota (menor número entre as parcelas da empresa)
    const totalEntrada = fila.reduce((s, r) => {
      if (!r.parcelas_empresa?.length) return s;
      const primeira = [...r.parcelas_empresa].sort((a, b) => a.numero - b.numero)[0];
      return s + (Number(primeira?.valor) || 0);
    }, 0);

    // Mês com mais cadastros criados
    const byMonth = new Map<string, number>();
    registrations.forEach((r) => {
      const base = r.aceite_date || r.created_at?.slice(0, 10);
      if (!base) return;
      const [y, m] = base.split('-').map(Number);
      if (!y || !m) return;
      const key = `${y}-${String(m).padStart(2, '0')}`;
      byMonth.set(key, (byMonth.get(key) || 0) + 1);
    });
    let topMonth: { key: string; count: number } | null = null;
    byMonth.forEach((count, key) => {
      if (!topMonth || count > topMonth.count) topMonth = { key, count };
    });
    let topMonthLabel = '—';
    let topMonthSub = 'Nenhum cadastro';
    if (topMonth) {
      const [y, m] = topMonth.key.split('-').map(Number);
      const dt = new Date(y, m - 1, 1);
      const mes = format(dt, 'MMM/yyyy', { locale: ptBR });
      topMonthLabel = mes.charAt(0).toUpperCase() + mes.slice(1);
      topMonthSub = `${topMonth.count} cota${topMonth.count > 1 ? 's' : ''}`;
    }

    return {
      totalPeriodo, totalCotas, aguardando,
      totalParcelas, totalCredito, totalEntrada, topMonthLabel, topMonthSub,
    };
  }, [registrations, variant]);

  const items = [
    {
      icon: FileClock,
      label: labels.cotas,
      value: String(stats.totalCotas),
      sub:
        variant === 'pendentes'
          ? `${stats.aguardando} aguardando abertura`
          : (labels as { cotasSub?: string }).cotasSub ?? '',
    },
    {
      icon: Layers,
      label: 'Parcelas (empresa) a cadastrar',
      value: String(stats.totalParcelas),
      sub: 'só cadastros sem cota aberta',
    },
    {
      icon: HandCoins,
      label: 'Entrada a pagar',
      value: formatCurrency(stats.totalEntrada),
      sub: 'estimativa (crédito ÷ prazo)',
    },
    {
      icon: Wallet,
      label: labels.credito,
      value: formatCurrency(stats.totalCredito),
      sub: labels.creditoSub,
    },
    {
      icon: CalendarRange,
      label: labels.mes,
      value: stats.topMonthLabel,
      sub: stats.topMonthSub,
    },
    ...(variant === 'pendentes'
      ? [{
          icon: Activity,
          label: 'No período',
          value: String(stats.totalPeriodo),
          // Universo explícito: este card não é o mesmo número do título da
          // tabela (que conta os filtros atuais) nem inclui vendas travadas.
          sub: 'cadastros criados · todos os status · exceto aguardando assinatura',
        }]
      : []),
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
      {items.map((it) => (
        <Card key={it.label}>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <it.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{it.label}</p>
              <p className="text-xl font-semibold leading-tight mt-0.5 truncate">{it.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{it.sub}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}