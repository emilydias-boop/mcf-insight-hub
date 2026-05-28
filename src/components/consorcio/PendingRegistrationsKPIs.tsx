import { useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileClock, Layers, Wallet, CalendarRange, HandCoins } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/consorcioCalculos';
import type { EnrichedPendingRegistration } from '@/hooks/useConsorcioPendingRegistrations';

interface Props {
  registrations: EnrichedPendingRegistration[];
}

export function PendingRegistrationsKPIs({ registrations }: Props) {
  const stats = useMemo(() => {
    const totalCotas = registrations.length;
    const totalParcelas = registrations.reduce(
      (s, r) => s + (r.parcelas_empresa?.length || 0),
      0,
    );
    const totalCredito = registrations.reduce(
      (s, r) => s + (Number(r.valor_credito) || 0),
      0,
    );
    // Entrada = apenas a 1ª parcela da cota (menor número entre as parcelas da empresa)
    const totalEntrada = registrations.reduce((s, r) => {
      if (!r.parcelas_empresa?.length) return s;
      const primeira = [...r.parcelas_empresa].sort((a, b) => a.numero - b.numero)[0];
      return s + (Number(primeira?.valor) || 0);
    }, 0);

    // Mês com maior déficit (mais cadastros pendentes)
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
    let topMonthSub = 'Nenhum pendente';
    if (topMonth) {
      const [y, m] = topMonth.key.split('-').map(Number);
      const dt = new Date(y, m - 1, 1);
      const mes = format(dt, 'MMM/yyyy', { locale: ptBR });
      topMonthLabel = mes.charAt(0).toUpperCase() + mes.slice(1);
      topMonthSub = `${topMonth.count} cota${topMonth.count > 1 ? 's' : ''}`;
    }

    return { totalCotas, totalParcelas, totalCredito, totalEntrada, topMonthLabel, topMonthSub };
  }, [registrations]);

  const items = [
    {
      icon: FileClock,
      label: 'Cotas a cadastrar',
      value: String(stats.totalCotas),
      sub: 'pendentes de abertura',
    },
    {
      icon: Layers,
      label: 'Parcelas (empresa)',
      value: String(stats.totalParcelas),
      sub: 'a cadastrar',
    },
    {
      icon: HandCoins,
      label: 'Entrada a pagar',
      value: formatCurrency(stats.totalEntrada),
      sub: 'soma da 1ª parcela de cada cota',
    },
    {
      icon: Wallet,
      label: 'Crédito pendente',
      value: formatCurrency(stats.totalCredito),
      sub: 'valor total a cadastrar',
    },
    {
      icon: CalendarRange,
      label: 'Mês com maior déficit',
      value: stats.topMonthLabel,
      sub: stats.topMonthSub,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
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