import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, AlertTriangle } from 'lucide-react';
import { SdrStatusBadge } from '@/components/sdr-fechamento/SdrStatusBadge';
import { formatCurrency } from '@/lib/formatters';
import { useActiveMetricsForSdr } from '@/hooks/useActiveMetricsForSdr';
import { useSdrMonthKpi } from '@/hooks/useSdrFechamento';
import { useCalculatedVariavel } from '@/hooks/useCalculatedVariavel';
import { SdrCompPlan } from '@/types/sdr-fechamento';

interface PayoutTableRowProps {
  payout: any;
  compPlan: any;
  anoMes: string;
  effectiveBu: string;
  selectedMonth: string;
  nivel: number;
  ote: number;
  buInfo: { label: string; isFromHR: boolean; hasWarning: boolean };
  roleLabel: string;
  roleType: string;
  onCalculated: (payoutId: string, variavel: number, totalConta: number) => void;
}

export function PayoutTableRow({
  payout,
  compPlan,
  anoMes,
  effectiveBu,
  selectedMonth,
  nivel,
  ote,
  buInfo,
  roleLabel,
  roleType,
  onCalculated,
}: PayoutTableRowProps) {
  const navigate = useNavigate();

  const { metricas } = useActiveMetricsForSdr(payout.sdr_id, anoMes);
  const { data: kpi } = useSdrMonthKpi(payout.sdr_id, anoMes);

  const diasUteisMes = payout.dias_uteis_mes || compPlan?.dias_uteis || 22;
  const sdrMetaDiaria = payout.sdr?.meta_diaria || 3;
  const variavelTotal = compPlan?.variavel_total || 400;

  const { total: calculatedVariavel } = useCalculatedVariavel({
    metricas,
    kpi: kpi || null,
    payout,
    compPlan: compPlan || null,
    diasUteisMes,
    sdrMetaDiaria,
    variavelTotal,
  });

  const fixo = payout.valor_fixo || 0;
  const calculatedTotalConta = fixo + calculatedVariavel;

  // Report calculated values to parent for totalizers
  const prevRef = useRef({ variavel: -1, total: -1 });
  useEffect(() => {
    if (
      metricas.length > 0 &&
      (prevRef.current.variavel !== calculatedVariavel || prevRef.current.total !== calculatedTotalConta)
    ) {
      prevRef.current = { variavel: calculatedVariavel, total: calculatedTotalConta };
      onCalculated(payout.id, calculatedVariavel, calculatedTotalConta);
    }
  }, [calculatedVariavel, calculatedTotalConta, metricas.length, payout.id, onCalculated]);

  // Use calculated values when available, fallback to DB
  const displayVariavel = metricas.length > 0 ? calculatedVariavel : (payout.valor_variavel_total || 0);
  const displayTotalConta = metricas.length > 0 ? calculatedTotalConta : (payout.total_conta || 0);

  const dbVariavel = payout.valor_variavel_total || 0;
  const hasDivergence = metricas.length > 0 && Math.abs(displayVariavel - dbVariavel) > 1;

  return (
    <TableRow>
      <TableCell className="font-medium">{payout.sdr?.name || 'SDR'}</TableCell>
      <TableCell className="text-center">
        <Badge variant={roleType === 'closer' ? 'secondary' : 'outline'} className="font-normal">
          {roleLabel}
        </Badge>
      </TableCell>
      <TableCell className="text-center">
        <div
          className="flex items-center justify-center gap-1"
          title={buInfo.hasWarning ? 'SDR sem vínculo RH' : undefined}
        >
          <span className={`text-sm ${buInfo.isFromHR ? 'text-foreground' : 'text-muted-foreground'}`}>
            {buInfo.label}
          </span>
          {buInfo.hasWarning && <AlertTriangle className="h-3 w-3 text-yellow-500" />}
        </div>
      </TableCell>
      <TableCell className="text-center">
        <Badge variant="outline" className="font-mono">
          N{nivel}
        </Badge>
      </TableCell>
      <TableCell className="text-right">{formatCurrency(ote)}</TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          {formatCurrency(displayVariavel)}
          {hasDivergence && payout.status === 'DRAFT' && (
            <span title={`Banco: ${formatCurrency(dbVariavel)} — Valor recalculado localmente`}>
              <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right font-semibold">{formatCurrency(displayTotalConta)}</TableCell>
      <TableCell className="text-right">{formatCurrency(payout.total_ifood || 0)}</TableCell>
      <TableCell className="text-center">
        <SdrStatusBadge status={payout.status} />
      </TableCell>
      <TableCell className="text-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/fechamento-sdr/${payout.id}?from=${selectedMonth}&bu=${effectiveBu}`)}
        >
          <Eye className="h-4 w-4 mr-1" />
          Ver
        </Button>
      </TableCell>
    </TableRow>
  );
}
